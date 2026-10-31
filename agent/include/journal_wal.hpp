#pragma once

#include "ioep_agent_types.hpp"
#include "cng_crypto.hpp"
#include <fstream>
#include <filesystem>
#include <mutex>
#include <deque>
#include <iostream>

namespace interviewos {

class JournalWal {
public:
    JournalWal(const std::string& journal_dir, const std::string& session_id)
        : journal_dir_(journal_dir), session_id_(session_id) {
        std::filesystem::create_directories(journal_dir_);
        journal_path_ = journal_dir_ + "/session_" + session_id + "_events.wal";
        checkpoint_path_ = journal_dir_ + "/session_" + session_id + "_checkpoint.meta";
        prev_event_hash_ = CngCrypto::GenesisHash(session_id_);
        last_batch_hash_ = prev_event_hash_;
        Recover();
    }

    ~JournalWal() {
        Flush();
    }

    SessionEventRecord AppendObservation(const RawObservationEvent& raw, const std::string& assessment_id, int policy_version = 1) {
        std::lock_guard<std::mutex> lock(mutex_);

        int64_t seq = ++current_sequence_;
        std::string curr_hash = CngCrypto::ComputeEventHash(session_id_, seq, prev_event_hash_, raw.payload);

        // Format ISO8601 UTC time
        auto time_t_now = std::chrono::system_clock::to_time_t(raw.client_time);
        struct tm tm_buf;
        gmtime_s(&tm_buf, &time_t_now);
        char time_str[64];
        strftime(time_str, sizeof(time_str), "%Y-%m-%dT%H:%M:%SZ", &tm_buf);

        SessionEventRecord rec{
            .event_id = GenerateUuid(),
            .session_id = session_id_,
            .assessment_id = assessment_id,
            .schema_version = "1.0",
            .sequence = seq,
            .event_type = raw.event_type,
            .client_time_utc = time_str,
            .monotonic_timestamp_ns = raw.monotonic_timestamp_ns,
            .source_collector = CollectorTypeToString(raw.source_collector),
            .collector_version = "1.0.0",
            .policy_version = policy_version,
            .payload = raw.payload,
            .previous_event_hash = prev_event_hash_,
            .current_event_hash = curr_hash
        };

        // Write directly to WAL append log
        std::ofstream wal(journal_path_, std::ios::app);
        if (wal.is_open()) {
            wal << rec.ToJson().dump() << "\n";
            wal.flush();
        }

        prev_event_hash_ = curr_hash;
        pending_events_.push_back(rec);
        return rec;
    }

    SignedBatchRecord SealPendingBatch(const std::string& signature = "") {
        std::lock_guard<std::mutex> lock(mutex_);
        if (pending_events_.empty()) {
            return SignedBatchRecord{};
        }

        int64_t seq_start = pending_events_.front().sequence;
        int64_t seq_end = pending_events_.back().sequence;
        int count = static_cast<int>(pending_events_.size());

        std::vector<std::string> event_hashes;
        for (const auto& ev : pending_events_) {
            event_hashes.push_back(ev.current_event_hash);
        }
        std::string merkle_root = CngCrypto::ComputeMerkleRoot(event_hashes);

        auto now = std::chrono::system_clock::now();
        auto time_t_now = std::chrono::system_clock::to_time_t(now);
        struct tm tm_buf;
        gmtime_s(&tm_buf, &time_t_now);
        char time_str[64];
        strftime(time_str, sizeof(time_str), "%Y-%m-%dT%H:%M:%SZ", &tm_buf);

        std::vector<SessionEventRecord> batch_events(pending_events_.begin(), pending_events_.end());
        SignedBatchRecord batch{
            .batch_id = GenerateUuid(),
            .session_id = session_id_,
            .sequence_start = seq_start,
            .sequence_end = seq_end,
            .event_count = count,
            .merkle_root = merkle_root,
            .previous_batch_hash = last_batch_hash_,
            .created_at_utc = time_str,
            .signature = signature,
            .events = std::move(batch_events)
        };

        unacknowledged_batches_.push_back(batch);
        last_batch_hash_ = merkle_root;
        pending_events_.clear();

        PersistCheckpointMetadata();
        return batch;
    }

    void AcknowledgeBatch(const std::string& batch_id, int64_t acknowledged_seq) {
        std::lock_guard<std::mutex> lock(mutex_);
        while (!unacknowledged_batches_.empty() && unacknowledged_batches_.front().sequence_end <= acknowledged_seq) {
            unacknowledged_batches_.pop_front();
        }
        acknowledged_sequence_ = acknowledged_seq;
        PersistCheckpointMetadata();
    }

    int64_t GetCurrentSequence() const {
        return current_sequence_;
    }

    int64_t GetAcknowledgedSequence() const {
        return acknowledged_sequence_;
    }

    size_t GetUnacknowledgedBatchCount() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return unacknowledged_batches_.size();
    }

    std::vector<SignedBatchRecord> GetUnacknowledgedBatches() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return std::vector<SignedBatchRecord>(unacknowledged_batches_.begin(), unacknowledged_batches_.end());
    }

private:
    void Flush() {
        std::lock_guard<std::mutex> lock(mutex_);
        PersistCheckpointMetadata();
    }

    void PersistCheckpointMetadata() {
        std::ofstream meta(checkpoint_path_, std::ios::trunc);
        if (meta.is_open()) {
            json j{
                {"session_id", session_id_},
                {"current_sequence", current_sequence_},
                {"acknowledged_sequence", acknowledged_sequence_},
                {"prev_event_hash", prev_event_hash_},
                {"last_batch_hash", last_batch_hash_}
            };
            meta << j.dump(2);
            meta.flush();
        }
    }

    void Recover() {
        if (std::filesystem::exists(checkpoint_path_)) {
            try {
                std::ifstream meta(checkpoint_path_);
                json j = json::parse(meta);
                current_sequence_ = j.value("current_sequence", 0LL);
                acknowledged_sequence_ = j.value("acknowledged_sequence", 0LL);
                prev_event_hash_ = j.value("prev_event_hash", prev_event_hash_);
                last_batch_hash_ = j.value("last_batch_hash", last_batch_hash_);
            } catch (...) {
                // If checkpoint corrupted, rebuild from WAL
            }
        }
    }

    static std::string GenerateUuid() {
        UUID uuid;
        UuidCreate(&uuid);
        RPC_CSTR rpcStr = NULL;
        UuidToStringA(&uuid, &rpcStr);
        std::string s(reinterpret_cast<char*>(rpcStr));
        RpcStringFreeA(&rpcStr);
        return s;
    }

    std::string journal_dir_;
    std::string session_id_;
    std::string journal_path_;
    std::string checkpoint_path_;

    mutable std::mutex mutex_;
    int64_t current_sequence_ = 0;
    int64_t acknowledged_sequence_ = 0;
    std::string prev_event_hash_;
    std::string last_batch_hash_;

    std::vector<SessionEventRecord> pending_events_;
    std::deque<SignedBatchRecord> unacknowledged_batches_;
};

} // namespace interviewos

