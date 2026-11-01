#pragma once

#include "../collector_interface.hpp"
#include <windows.h>
#include <setupapi.h>
#include <devguid.h>
#include <unordered_map>
#include <unordered_set>
#include <string>
#include <vector>

namespace interviewos {

struct DeviceInfo {
    std::string device_id;
    std::string description;
    std::string device_class;
    std::string category; // USB, AUDIO, DISPLAY, BLUETOOTH, OTHER
};

class DeviceCollector : public ICollector {
public:
    DeviceCollector() = default;
    ~DeviceCollector() override { Stop(); }

    CollectorType GetType() const override { return CollectorType::Device; }
    std::string GetName() const override { return "WindowsSetupApiDeviceCollector"; }
    std::string GetVersion() const override { return "1.0.0"; }

    bool Initialize() override {
        return true;
    }

    bool ValidatePermissions() override {
        HDEVINFO hDevInfo = SetupDiGetClassDevsW(NULL, NULL, NULL, DIGCF_ALLCLASSES | DIGCF_PRESENT);
        if (hDevInfo == INVALID_HANDLE_VALUE) {
            last_error_ = "Failed to query SetupDiGetClassDevsW";
            return false;
        }
        SetupDiDestroyDeviceInfoList(hDevInfo);
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
            .type = CollectorType::Device,
            .healthy = last_error_.empty(),
            .last_error = last_error_,
            .events_emitted = events_emitted_,
            .last_observed_time = std::chrono::system_clock::now()
        };
    }

    void Stop() override {
        running_ = false;
        active_devices_.clear();
    }

    size_t GetActiveDeviceCount() const {
        return active_devices_.size();
    }

    std::vector<DeviceInfo> GetCurrentInventory() const {
        std::vector<DeviceInfo> inv;
        for (const auto& [_, dev] : active_devices_) {
            inv.push_back(dev);
        }
        return inv;
    }

private:
    std::string CategorizeClass(const std::string& devClass, const std::string& desc, const std::string& instId) {
        std::string upperInst = instId;
        for (auto& c : upperInst) c = ::toupper(c);
        std::string upperDesc = desc;
        for (auto& c : upperDesc) c = ::toupper(c);

        // Phone & Mobile Device Protocols
        if (upperInst.find("VID_18D1") != std::string::npos || // Google
            upperInst.find("VID_04E8") != std::string::npos || // Samsung
            upperInst.find("VID_2717") != std::string::npos || // Xiaomi
            upperInst.find("VID_2A70") != std::string::npos || // OnePlus
            upperDesc.find("ANDROID") != std::string::npos ||
            upperDesc.find("MTP") != std::string::npos ||
            upperDesc.find("PTP") != std::string::npos ||
            upperDesc.find("SAMSUNG MOBILE") != std::string::npos) {
            return "PHONE_ANDROID";
        }
        if (upperInst.find("VID_05AC") != std::string::npos || // Apple
            upperDesc.find("APPLE MOBILE") != std::string::npos ||
            upperDesc.find("IPHONE") != std::string::npos ||
            upperDesc.find("IPAD") != std::string::npos) {
            return "PHONE_APPLE";
        }

        // ADB / Tethering / Network adapters over USB
        if (upperDesc.find("ADB") != std::string::npos || upperDesc.find("DEBUG BRIDGE") != std::string::npos) {
            return "DEV_DEBUG_BRIDGE";
        }
        if (upperDesc.find("TETHER") != std::string::npos || upperDesc.find("RNDIS") != std::string::npos) {
            return "USB_TETHERING";
        }

        // Capture Cards / External HDMI Capture
        if (upperDesc.find("CAM LINK") != std::string::npos ||
            upperDesc.find("ELGATO") != std::string::npos ||
            upperDesc.find("VIDEO CAPTURE") != std::string::npos) {
            return "EXTERNAL_CAPTURE_HARDWARE";
        }

        // Standard categories
        if (devClass.find("DiskDrive") != std::string::npos || upperDesc.find("FLASH DISK") != std::string::npos) return "USB_STORAGE";
        if (devClass.find("USB") != std::string::npos || desc.find("USB") != std::string::npos) return "USB";
        if (devClass.find("Audio") != std::string::npos || devClass.find("Media") != std::string::npos) return "AUDIO";
        if (devClass.find("Display") != std::string::npos) return "DISPLAY";
        if (devClass.find("Bluetooth") != std::string::npos || desc.find("Bluetooth") != std::string::npos) return "BLUETOOTH";
        if (devClass.find("Net") != std::string::npos) return "NETWORK_ADAPTER";
        return "PERIPHERAL";
    }

    void TakeSnapshot(bool is_baseline) {
        HDEVINFO hDevInfo = SetupDiGetClassDevsW(NULL, NULL, NULL, DIGCF_ALLCLASSES | DIGCF_PRESENT);
        if (hDevInfo == INVALID_HANDLE_VALUE) {
            last_error_ = "SetupDiGetClassDevsW failed in TakeSnapshot";
            return;
        }

        SP_DEVINFO_DATA devInfoData;
        devInfoData.cbSize = sizeof(SP_DEVINFO_DATA);

        std::unordered_map<std::string, DeviceInfo> current_devices;

        for (DWORD i = 0; SetupDiEnumDeviceInfo(hDevInfo, i, &devInfoData); ++i) {
            WCHAR bufDesc[512] = {0};
            WCHAR bufClass[256] = {0};
            WCHAR bufInstId[512] = {0};

            SetupDiGetDeviceInstanceIdW(hDevInfo, &devInfoData, bufInstId, 512, NULL);
            SetupDiGetDeviceRegistryPropertyW(hDevInfo, &devInfoData, SPDRP_DEVICEDESC, NULL, (PBYTE)bufDesc, sizeof(bufDesc), NULL);
            SetupDiGetDeviceRegistryPropertyW(hDevInfo, &devInfoData, SPDRP_CLASS, NULL, (PBYTE)bufClass, sizeof(bufClass), NULL);

            std::wstring wsId(bufInstId);
            std::wstring wsDesc(bufDesc);
            std::wstring wsClass(bufClass);

            std::string idStr(wsId.begin(), wsId.end());
            std::string descStr(wsDesc.begin(), wsDesc.end());
            std::string classStr(wsClass.begin(), wsClass.end());

            if (idStr.empty()) continue;

            DeviceInfo dev{
                .device_id = idStr,
                .description = descStr.empty() ? "Generic Device" : descStr,
                .device_class = classStr,
                .category = CategorizeClass(classStr, descStr, idStr)
            };
            current_devices[idStr] = dev;
        }
        SetupDiDestroyDeviceInfoList(hDevInfo);

        if (!is_baseline && callback_) {
            // Hotplugs
            for (const auto& [id, dev] : current_devices) {
                if (active_devices_.find(id) == active_devices_.end()) {
                    RawObservationEvent evt{
                        .event_type = "DEVICE_CONNECTED",
                        .source_collector = CollectorType::Device,
                        .client_time = std::chrono::system_clock::now(),
                        .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                        .payload = {
                            {"device_id", dev.device_id},
                            {"description", dev.description},
                            {"device_class", dev.device_class},
                            {"category", dev.category}
                        }
                    };
                    events_emitted_++;
                    callback_(evt);
                }
            }

            // Unplugs
            for (const auto& [id, dev] : active_devices_) {
                if (current_devices.find(id) == current_devices.end()) {
                    RawObservationEvent evt{
                        .event_type = "DEVICE_DISCONNECTED",
                        .source_collector = CollectorType::Device,
                        .client_time = std::chrono::system_clock::now(),
                        .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                        .payload = {
                            {"device_id", dev.device_id},
                            {"description", dev.description},
                            {"device_class", dev.device_class},
                            {"category", dev.category}
                        }
                    };
                    events_emitted_++;
                    callback_(evt);
                }
            }
        }

        active_devices_ = std::move(current_devices);
    }

    static int64_t GetMonotonicTimestampNs() {
        LARGE_INTEGER freq, counter;
        QueryPerformanceFrequency(&freq);
        QueryPerformanceCounter(&counter);
        return (counter.QuadPart * 1000000000LL) / freq.QuadPart;
    }

    bool running_ = false;
    std::string last_error_;
    uint64_t events_emitted_ = 0;
    EventEmitCallback callback_;
    std::unordered_map<std::string, DeviceInfo> active_devices_;
};

} // namespace interviewos

