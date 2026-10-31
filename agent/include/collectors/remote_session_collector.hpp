#pragma once

#include "../collector_interface.hpp"
#include <windows.h>
#include <wtsapi32.h>
#include <string>

namespace interviewos {

class RemoteSessionCollector : public ICollector {
public:
    RemoteSessionCollector() = default;
    ~RemoteSessionCollector() override { Stop(); }

    CollectorType GetType() const override { return CollectorType::RemoteSession; }
    std::string GetName() const override { return "WindowsWtsRemoteSessionCollector"; }
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
            .type = CollectorType::RemoteSession,
            .healthy = last_error_.empty(),
            .last_error = last_error_,
            .events_emitted = events_emitted_,
            .last_observed_time = std::chrono::system_clock::now()
        };
    }

    void Stop() override {
        running_ = false;
    }

    bool IsRemoteSessionActive() const {
        return is_remote_session_;
    }

private:
    void TakeSnapshot(bool is_baseline) {
        bool remote = (GetSystemMetrics(SM_REMOTESESSION) != 0);

        LPWSTR pClientName = NULL;
        DWORD bytesReturned = 0;
        std::string client_name;
        if (WTSQuerySessionInformationW(WTS_CURRENT_SERVER_HANDLE, WTS_CURRENT_SESSION, WTSClientName, &pClientName, &bytesReturned) && pClientName) {
            std::wstring ws(pClientName);
            client_name = std::string(ws.begin(), ws.end());
            WTSFreeMemory(pClientName);
        }

        if (!is_baseline && callback_) {
            if (remote != is_remote_session_) {
                RawObservationEvent evt{
                    .event_type = "REMOTE_SESSION_STATE_CHANGED",
                    .source_collector = CollectorType::RemoteSession,
                    .client_time = std::chrono::system_clock::now(),
                    .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                    .payload = {
                        {"remote_session_active", remote},
                        {"client_name", client_name},
                        {"terminal_services_flag", remote}
                    }
                };
                events_emitted_++;
                callback_(evt);
            }
        }

        is_remote_session_ = remote;
    }

    static int64_t GetMonotonicTimestampNs() {
        LARGE_INTEGER freq, counter;
        QueryPerformanceFrequency(&freq);
        QueryPerformanceCounter(&counter);
        return (counter.QuadPart * 1000000000LL) / freq.QuadPart;
    }

    bool running_ = false;
    bool is_remote_session_ = false;
    std::string last_error_;
    uint64_t events_emitted_ = 0;
    EventEmitCallback callback_;
};

} // namespace interviewos
