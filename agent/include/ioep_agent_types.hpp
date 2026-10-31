#pragma once

#include <string>
#include <vector>
#include <cstdint>
#include <nlohmann/json.hpp>

namespace interviewos {

using json = nlohmann::json;

struct SessionEventRecord {
    std::string event_id;
    std::string session_id;
    std::string assessment_id;
    std::string schema_version = "1.0";
    int64_t sequence = 0;
    std::string event_type;
    std::string client_time_utc;
    int64_t monotonic_timestamp_ns = 0;
    std::string source_collector;
    std::string collector_version;
    int policy_version = 1;
    json payload;
    std::string previous_event_hash;
    std::string current_event_hash;

    json ToJson() const {
        return json{
            {"event_id", event_id},
            {"session_id", session_id},
            {"assessment_id", assessment_id},
            {"schema_version", schema_version},
            {"sequence", sequence},
            {"event_type", event_type},
            {"client_time_utc", client_time_utc},
            {"monotonic_timestamp_ns", monotonic_timestamp_ns},
            {"source_collector", source_collector},
            {"collector_version", collector_version},
            {"policy_version", policy_version},
            {"payload", payload},
            {"previous_event_hash", previous_event_hash},
            {"current_event_hash", current_event_hash}
        };
    }
};

struct SignedBatchRecord {
    std::string batch_id;
    std::string session_id;
    int64_t sequence_start = 0;
    int64_t sequence_end = 0;
    int event_count = 0;
    std::string merkle_root;
    std::string previous_batch_hash;
    std::string created_at_utc;
    std::string signature;
    std::vector<SessionEventRecord> events;

    json ToJson() const {
        json evts = json::array();
        for (const auto& ev : events) {
            evts.push_back(ev.ToJson());
        }
        return json{
            {"batch_id", batch_id},
            {"session_id", session_id},
            {"sequence_start", sequence_start},
            {"sequence_end", sequence_end},
            {"event_count", event_count},
            {"merkle_root", merkle_root},
            {"previous_batch_hash", previous_batch_hash},
            {"created_at_utc", created_at_utc},
            {"signature", signature},
            {"events", evts}
        };
    }
};

struct EnrollmentRequest {
    std::string session_id;
    std::string candidate_id;
    std::string assessment_id;
    std::string public_key_pem;
    std::string key_algorithm = "ECDSA_P256_SHA256";
    std::string key_protection_type = "SOFTWARE_CNG_DPAPI";
    std::string client_nonce;
    std::string server_challenge_nonce;
    std::string challenge_signature;
    std::string os_version;
    std::string agent_version = "1.0.0";
    std::string enrolled_at_utc;

    json ToJson() const {
        return json{
            {"session_id", session_id},
            {"candidate_id", candidate_id},
            {"assessment_id", assessment_id},
            {"public_key_pem", public_key_pem},
            {"key_algorithm", key_algorithm},
            {"key_protection_type", key_protection_type},
            {"client_nonce", client_nonce},
            {"server_challenge_nonce", server_challenge_nonce},
            {"challenge_signature", challenge_signature},
            {"os_version", os_version},
            {"agent_version", agent_version},
            {"enrolled_at_utc", enrolled_at_utc}
        };
    }
};

} // namespace interviewos

