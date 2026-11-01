#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <bthsdpdef.h>
#include <bluetoothapis.h>
#include "../collector_interface.hpp"
#include <vector>
#include <string>
#include <unordered_map>
#include <iomanip>
#include <sstream>

#pragma comment(lib, "bthprops.lib")

namespace interviewos {

struct BluetoothDeviceState {
    std::string address;
    std::string name;
    ULONG device_class;
    bool connected;
    bool remembered;
    bool authenticated;
    std::chrono::system_clock::time_point last_seen;
};

class BluetoothCollector : public ICollector {
public:
    BluetoothCollector() = default;
    ~BluetoothCollector() override { Stop(); }

    CollectorType GetType() const override { return CollectorType::Bluetooth; }
    std::string GetName() const override { return "WindowsNativeBluetoothCollector"; }
    std::string GetVersion() const override { return "2.0.0"; }

    bool Initialize() override {
        return true;
    }

    bool ValidatePermissions() override {
        // Test if Bluetooth radio is present or APIs can query without crashing
        BLUETOOTH_FIND_RADIO_PARAMS radioParams = { sizeof(BLUETOOTH_FIND_RADIO_PARAMS) };
        HANDLE hRadio = NULL;
        HBLUETOOTH_RADIO_FIND hFind = BluetoothFindFirstRadio(&radioParams, &hRadio);
        if (hFind != NULL) {
            CloseHandle(hRadio);
            BluetoothFindRadioClose(hFind);
            has_radio_ = true;
        } else {
            has_radio_ = false; // Graceful fallback: radio may be absent on desktop VM
        }
        return true;
    }

    bool Start(EventEmitCallback callback) override {
        callback_ = std::move(callback);
        running_ = true;
        TakeSnapshot(true); // initial baseline
        return true;
    }

    void Observe() override {
        if (!running_) return;
        TakeSnapshot(false);
    }

    CollectorHealthStatus ReportHealth() override {
        return CollectorHealthStatus{
            .type = CollectorType::Bluetooth,
            .healthy = last_error_.empty(),
            .last_error = last_error_,
            .events_emitted = events_emitted_,
            .last_observed_time = std::chrono::system_clock::now()
        };
    }

    void Stop() override {
        running_ = false;
        known_devices_.clear();
    }

    size_t GetDiscoveredDeviceCount() const {
        return known_devices_.size();
    }

    bool HasRadio() const {
        return has_radio_;
    }

private:
    static std::string FormatBthAddress(const BTH_ADDR& addr) {
        std::ostringstream ss;
        ss << std::hex << std::setfill('0');
        for (int i = 5; i >= 0; --i) {
            ss << std::setw(2) << ((addr >> (i * 8)) & 0xFF);
            if (i > 0) ss << ":";
        }
        return ss.str();
    }

    void TakeSnapshot(bool is_baseline) {
        if (!has_radio_) {
            // Documented limitation: Radio not present or disabled
            return;
        }

        BLUETOOTH_DEVICE_SEARCH_PARAMS searchParams = {
            sizeof(BLUETOOTH_DEVICE_SEARCH_PARAMS),
            1, // fReturnAuthenticated
            1, // fReturnRemembered
            1, // fReturnUnknown
            1, // fReturnConnected
            1, // fIssueInquiry (scan for nearby visible devices)
            2, // cTimeoutMultiplier (2 * 1.28s)
            NULL // hRadio (all radios)
        };

        BLUETOOTH_DEVICE_INFO devInfo = { sizeof(BLUETOOTH_DEVICE_INFO) };
        HBLUETOOTH_DEVICE_FIND hFind = BluetoothFindFirstDevice(&searchParams, &devInfo);

        std::unordered_map<std::string, BluetoothDeviceState> current_devices;

        if (hFind != NULL) {
            do {
                std::string addrStr = FormatBthAddress(devInfo.Address.ullLong);
                std::wstring wsName(devInfo.szName);
                std::string name(wsName.begin(), wsName.end());
                if (name.empty()) name = "Unknown Bluetooth Device";

                current_devices[addrStr] = BluetoothDeviceState{
                    .address = addrStr,
                    .name = name,
                    .device_class = devInfo.ulClassofDevice,
                    .connected = (devInfo.fConnected != FALSE),
                    .remembered = (devInfo.fRemembered != FALSE),
                    .authenticated = (devInfo.fAuthenticated != FALSE),
                    .last_seen = std::chrono::system_clock::now()
                };
            } while (BluetoothFindNextDevice(hFind, &devInfo));

            BluetoothFindDeviceClose(hFind);
        }

        if (!is_baseline && callback_) {
            // Check newly appeared or connected devices
            for (const auto& [addr, state] : current_devices) {
                auto it = known_devices_.find(addr);
                bool is_new = (it == known_devices_.end());
                bool connection_changed = (!is_new && it->second.connected != state.connected);

                if (is_new || connection_changed) {
                    RawObservationEvent evt{
                        .event_type = state.connected ? "BLUETOOTH_DEVICE_CONNECTED" : "BLUETOOTH_DEVICE_DISCOVERED",
                        .source_collector = CollectorType::Bluetooth,
                        .client_time = std::chrono::system_clock::now(),
                        .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                        .payload = {
                            {"mac_address", state.address},
                            {"device_name", state.name},
                            {"device_class", state.device_class},
                            {"is_connected", state.connected},
                            {"is_authenticated", state.authenticated},
                            {"is_remembered", state.remembered},
                            {"visibility_scope", "ASSESSMENT_LOCAL_RADIO"}
                        }
                    };
                    events_emitted_++;
                    callback_(evt);
                }
            }

            // Check disconnected devices
            for (const auto& [addr, old_state] : known_devices_) {
                if (current_devices.find(addr) == current_devices.end() && old_state.connected) {
                    RawObservationEvent evt{
                        .event_type = "BLUETOOTH_DEVICE_DISCONNECTED",
                        .source_collector = CollectorType::Bluetooth,
                        .client_time = std::chrono::system_clock::now(),
                        .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                        .payload = {
                            {"mac_address", addr},
                            {"device_name", old_state.name},
                            {"is_connected", false}
                        }
                    };
                    events_emitted_++;
                    callback_(evt);
                }
            }
        }

        known_devices_ = std::move(current_devices);
    }

    static int64_t GetMonotonicTimestampNs() {
        LARGE_INTEGER freq, counter;
        QueryPerformanceFrequency(&freq);
        QueryPerformanceCounter(&counter);
        return (counter.QuadPart * 1000000000LL) / freq.QuadPart;
    }

    bool running_ = false;
    bool has_radio_ = false;
    std::string last_error_;
    uint64_t events_emitted_ = 0;
    EventEmitCallback callback_;
    std::unordered_map<std::string, BluetoothDeviceState> known_devices_;
};

} // namespace interviewos
