#pragma once

#include "../collector_interface.hpp"
#include <windows.h>
#include <psapi.h>
#include <string>

namespace interviewos {

class HealthCollector : public ICollector {
public:
    HealthCollector() = default;
    ~HealthCollector() override { Stop(); }

    CollectorType GetType() const override { return CollectorType::Health; }
    std::string GetName() const override { return "WindowsNativeHealthCollector"; }
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
        return true;
    }

    void Observe() override {
        if (!running_ || !callback_) return;

        PROCESS_MEMORY_COUNTERS pmc;
        SIZE_T workingSet = 0;
        if (GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc))) {
            workingSet = pmc.WorkingSetSize;
        }

        RawObservationEvent evt{
            .event_type = "COLLECTOR_HEALTH_REPORTED",
            .source_collector = CollectorType::Health,
            .client_time = std::chrono::system_clock::now(),
            .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
            .payload = {
                {"agent_working_set_bytes", workingSet},
                {"healthy", true},
                {"queue_drop_count", 0},
                {"etw_loss_count", 0}
            }
        };
        events_emitted_++;
        callback_(evt);
    }

    void EmitHeartbeat() {
        if (!running_ || !callback_) return;
        RawObservationEvent evt{
            .event_type = "HEARTBEAT",
            .source_collector = CollectorType::Health,
            .client_time = std::chrono::system_clock::now(),
            .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
            .payload = {
                {"status", "ONLINE"},
                {"uptime_seconds", GetTickCount64() / 1000}
            }
        };
        events_emitted_++;
        callback_(evt);
    }

    CollectorHealthStatus ReportHealth() override {
        return CollectorHealthStatus{
            .type = CollectorType::Health,
            .healthy = last_error_.empty(),
            .last_error = last_error_,
            .events_emitted = events_emitted_,
            .last_observed_time = std::chrono::system_clock::now()
        };
    }

    void Stop() override {
        running_ = false;
    }

private:
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
};

} // namespace interviewos

