#pragma once

#include "../collector_interface.hpp"
#include <windows.h>
#include <vector>
#include <string>

namespace interviewos {

struct MonitorInfo {
    std::string device_name;
    int left;
    int top;
    int right;
    int bottom;
    bool is_primary;
};

class DisplayCollector : public ICollector {
public:
    DisplayCollector() = default;
    ~DisplayCollector() override { Stop(); }

    CollectorType GetType() const override { return CollectorType::Display; }
    std::string GetName() const override { return "WindowsNativeDisplayCollector"; }
    std::string GetVersion() const override { return "1.0.0"; }

    bool Initialize() override {
        return true;
    }

    bool ValidatePermissions() override {
        return true;
    }

    bool Start(EventEmitCallback callback) override {
        callback_ = std::move(callback);
        running_ = true;
        TakeSnapshot(true);
        return true;
    }

    void Observe() override {
        if (!running_) return;
        TakeSnapshot(false);
    }

    CollectorHealthStatus ReportHealth() override {
        return CollectorHealthStatus{
            .type = CollectorType::Display,
            .healthy = last_error_.empty(),
            .last_error = last_error_,
            .events_emitted = events_emitted_,
            .last_observed_time = std::chrono::system_clock::now()
        };
    }

    void Stop() override {
        running_ = false;
        monitors_.clear();
    }

    size_t GetMonitorCount() const {
        return monitors_.size();
    }

private:
    static BOOL CALLBACK MonitorEnumProc(HMONITOR hMonitor, HDC hdcMonitor, LPRECT lprcMonitor, LPARAM dwData) {
        auto* monitors = reinterpret_cast<std::vector<MonitorInfo>*>(dwData);
        MONITORINFOEXW mi;
        mi.cbSize = sizeof(MONITORINFOEXW);
        if (GetMonitorInfoW(hMonitor, &mi)) {
            std::wstring ws(mi.szDevice);
            std::string name(ws.begin(), ws.end());
            monitors->push_back(MonitorInfo{
                .device_name = name,
                .left = mi.rcMonitor.left,
                .top = mi.rcMonitor.top,
                .right = mi.rcMonitor.right,
                .bottom = mi.rcMonitor.bottom,
                .is_primary = (mi.dwFlags & MONITORINFOF_PRIMARY) != 0
            });
        }
        return TRUE;
    }

    void TakeSnapshot(bool is_baseline) {
        std::vector<MonitorInfo> current_monitors;
        EnumDisplayMonitors(NULL, NULL, MonitorEnumProc, reinterpret_cast<LPARAM>(&current_monitors));

        int monitor_count = GetSystemMetrics(SM_CMONITORS);
        bool virtual_desktop = GetSystemMetrics(SM_REMOTESESSION) != 0;

        if (!is_baseline && callback_) {
            if (current_monitors.size() != monitors_.size()) {
                json mon_arr = json::array();
                for (const auto& m : current_monitors) {
                    mon_arr.push_back({
                        {"name", m.device_name},
                        {"width", m.right - m.left},
                        {"height", m.bottom - m.top},
                        {"is_primary", m.is_primary}
                    });
                }

                RawObservationEvent evt{
                    .event_type = "DISPLAY_TOPOLOGY_CHANGED",
                    .source_collector = CollectorType::Display,
                    .client_time = std::chrono::system_clock::now(),
                    .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                    .payload = {
                        {"display_count", current_monitors.size()},
                        {"system_metrics_count", monitor_count},
                        {"remote_session", virtual_desktop},
                        {"displays", mon_arr}
                    }
                };
                events_emitted_++;
                callback_(evt);
            }
        }

        monitors_ = std::move(current_monitors);
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
    std::vector<MonitorInfo> monitors_;
};

} // namespace interviewos
