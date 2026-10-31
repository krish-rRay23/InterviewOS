#pragma once

#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <functional>
#include <nlohmann/json.hpp>

namespace interviewos {

using json = nlohmann::json;

enum class CollectorType {
    Process,
    Device,
    Display,
    Network,
    RemoteSession,
    Virtualization,
    Health
};

inline std::string CollectorTypeToString(CollectorType type) {
    switch (type) {
        case CollectorType::Process: return "PROCESS_COLLECTOR";
        case CollectorType::Device: return "DEVICE_COLLECTOR";
        case CollectorType::Display: return "DISPLAY_COLLECTOR";
        case CollectorType::Network: return "NETWORK_COLLECTOR";
        case CollectorType::RemoteSession: return "REMOTE_SESSION_COLLECTOR";
        case CollectorType::Virtualization: return "VIRTUALIZATION_COLLECTOR";
        case CollectorType::Health: return "HEALTH_COLLECTOR";
        default: return "UNKNOWN_COLLECTOR";
    }
}

struct CollectorHealthStatus {
    CollectorType type;
    bool healthy;
    std::string last_error;
    uint64_t events_emitted;
    std::chrono::system_clock::time_point last_observed_time;
};

struct RawObservationEvent {
    std::string event_type;
    CollectorType source_collector;
    std::chrono::system_clock::time_point client_time;
    int64_t monotonic_timestamp_ns;
    json payload;
};

using EventEmitCallback = std::function<void(const RawObservationEvent&)>;

class ICollector {
public:
    virtual ~ICollector() = default;

    virtual CollectorType GetType() const = 0;
    virtual std::string GetName() const = 0;
    virtual std::string GetVersion() const = 0;

    virtual bool Initialize() = 0;
    virtual bool ValidatePermissions() = 0;
    virtual bool Start(EventEmitCallback callback) = 0;
    virtual void Observe() = 0;
    virtual CollectorHealthStatus ReportHealth() = 0;
    virtual void Stop() = 0;
};

} // namespace interviewos

