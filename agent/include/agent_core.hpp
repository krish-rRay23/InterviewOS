#pragma once

#include "collector_interface.hpp"
#include "collectors/process_collector.hpp"
#include "collectors/device_collector.hpp"
#include "collectors/display_collector.hpp"
#include "collectors/network_collector.hpp"
#include "collectors/remote_session_collector.hpp"
#include "collectors/health_collector.hpp"
#include "journal_wal.hpp"
#include "cng_crypto.hpp"
#include "sync_manager.hpp"
#include <vector>
#include <memory>
#include <thread>
#include <atomic>
#include <iostream>

namespace interviewos {

class AgentCore {
public:
    AgentCore(const std::string& session_id, const std::string& assessment_id, const std::string& candidate_id, const std::string& journal_dir)
        : session_id_(session_id), assessment_id_(assessment_id), candidate_id_(candidate_id) {
        journal_ = std::make_unique<JournalWal>(journal_dir, session_id_);
    }

    ~AgentCore() {
        Stop();
    }

    bool InitializeCollectors() {
        collectors_.push_back(std::make_unique<ProcessCollector>());
        collectors_.push_back(std::make_unique<DeviceCollector>());
        collectors_.push_back(std::make_unique<DisplayCollector>());
        collectors_.push_back(std::make_unique<NetworkCollector>());
        collectors_.push_back(std::make_unique<RemoteSessionCollector>());
        collectors_.push_back(std::make_unique<HealthCollector>());

        for (auto& col : collectors_) {
            if (!col->Initialize()) {
                std::cerr << "[AgentCore] Failed to initialize " << col->GetName() << "\n";
                return false;
            }
            if (!col->ValidatePermissions()) {
                std::cerr << "[AgentCore] Permission validation failed for " << col->GetName() << "\n";
            }
        }
        return true;
    }

    bool Start(bool enable_network_sync = false) {
        running_ = true;
        enable_network_sync_ = enable_network_sync;
        sync_manager_ = std::make_unique<SyncManager>("localhost", 8080);

        auto callback = [this](const RawObservationEvent& raw) {
            this->OnObservation(raw);
        };

        for (auto& col : collectors_) {
            col->Start(callback);
        }

        observation_thread_ = std::thread([this]() {
            while (running_) {
                for (auto& col : collectors_) {
                    col->Observe();
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
            }
        });

        heartbeat_thread_ = std::thread([this]() {
            while (running_) {
                for (auto& col : collectors_) {
                    if (col->GetType() == CollectorType::Health) {
                        static_cast<HealthCollector*>(col.get())->EmitHeartbeat();
                    }
                }
                if (enable_network_sync_ && sync_manager_) {
                    sync_manager_->SendHeartbeat(session_id_);
                    sync_manager_->FlushPendingBatches(journal_.get());
                }
                std::this_thread::sleep_for(std::chrono::seconds(3));
            }
        });

        return true;
    }

    void OnObservation(const RawObservationEvent& raw) {
        auto rec = journal_->AppendObservation(raw, assessment_id_, policy_version_);
        total_events_observed_++;
    }

    SignedBatchRecord SealBatch(const std::string& signature = "SIMULATED_TEST_SIGNATURE") {
        return journal_->SealPendingBatch(signature);
    }

    void AcknowledgeBatch(const std::string& batch_id, int64_t seq_end) {
        journal_->AcknowledgeBatch(batch_id, seq_end);
        batches_synced_++;
    }

    void Stop() {
        if (!running_) return;
        running_ = false;

        for (auto& col : collectors_) {
            col->Stop();
        }

        if (observation_thread_.joinable()) observation_thread_.join();
        if (heartbeat_thread_.joinable()) heartbeat_thread_.join();
    }

    void DisplayCandidateTransparencyStatus() const {
        std::cout << "\n==========================================================\n";
        std::cout << "  INTERVIEWOS - CANDIDATE ENDPOINT TRUST STATUS\n";
        std::cout << "  (Visible Candidate Transparency Console)\n";
        std::cout << "==========================================================\n";
        std::cout << "  Session ID:               " << session_id_ << "\n";
        std::cout << "  Assessment ID:            " << assessment_id_ << "\n";
        std::cout << "  Candidate ID:             " << candidate_id_ << "\n";
        std::cout << "  Status:                   ACTIVE OBSERVATION\n";
        std::cout << "  Total Events Observed:    " << total_events_observed_ << "\n";
        std::cout << "  Current Journal Seq:      " << journal_->GetCurrentSequence() << "\n";
        std::cout << "  Server Acknowledged Seq:  " << journal_->GetAcknowledgedSequence() << "\n";
        std::cout << "  Unsynced Batches:         " << journal_->GetUnacknowledgedBatchCount() << "\n";
        std::cout << "  Active Collectors:        " << collectors_.size() << " operational\n";
        std::cout << "----------------------------------------------------------\n";
        std::cout << "  MONITORING DISCLOSURE:\n";
        std::cout << "  - Process lifecycle (names/categories only, no keystrokes)\n";
        std::cout << "  - Hardware peripherals (USB/Audio/Display connection events)\n";
        std::cout << "  - Remote desktop session state indicators\n";
        std::cout << "  - Network connectivity transitions\n";
        std::cout << "  - Privacy guarantee: No keystrokes, no file scans, no memory inspection.\n";
        std::cout << "==========================================================\n\n";
    }

    JournalWal* GetJournal() { return journal_.get(); }
    SyncManager* GetSyncManager() { return sync_manager_.get(); }
    uint64_t GetTotalEventsObserved() const { return total_events_observed_; }

private:
    std::string session_id_;
    std::string assessment_id_;
    std::string candidate_id_;
    int policy_version_ = 1;

    std::unique_ptr<JournalWal> journal_;
    std::unique_ptr<SyncManager> sync_manager_;
    std::vector<std::unique_ptr<ICollector>> collectors_;
    bool enable_network_sync_ = false;

    std::atomic<bool> running_{false};
    std::atomic<uint64_t> total_events_observed_{0};
    std::atomic<uint64_t> batches_synced_{0};

    std::thread observation_thread_;
    std::thread heartbeat_thread_;
};

} // namespace interviewos

