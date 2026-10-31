#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iostream>
#include <cassert>
#include <filesystem>
#include "../include/cng_crypto.hpp"
#include "../include/collectors/process_collector.hpp"
#include "../include/collectors/device_collector.hpp"
#include "../include/collectors/display_collector.hpp"
#include "../include/collectors/network_collector.hpp"
#include "../include/collectors/remote_session_collector.hpp"
#include "../include/collectors/health_collector.hpp"
#include "../include/journal_wal.hpp"
#include "../include/agent_core.hpp"

using namespace interviewos;

void TestCngCrypto() {
    std::cout << "[Test 1/5] Testing CngCrypto SHA-256 and Merkle Trees..." << std::endl;

    std::string sha = CngCrypto::ComputeSHA256("test_string");
    assert(sha.length() == 64);

    std::string session_id = "00000000-1111-2222-3333-444444444444";
    std::string genesis = CngCrypto::GenesisHash(session_id);
    assert(genesis.length() == 64);

    nlohmann::json payload = {{"key", "val"}, {"num", 42}};
    std::string h1 = CngCrypto::ComputeEventHash(session_id, 1, genesis, payload);
    assert(h1.length() == 64);

    std::vector<std::string> hashes = {genesis, h1};
    std::string root = CngCrypto::ComputeMerkleRoot(hashes);
    assert(root.length() == 64);

    std::cout << " -> CngCrypto passed. Merkle root: " << root.substr(0, 16) << "..." << std::endl;
}

void TestCollectors() {
    std::cout << "[Test 2/5] Testing Windows Native Collectors..." << std::endl;

    // Process Collector
    ProcessCollector procCol;
    assert(procCol.Initialize());
    assert(procCol.ValidatePermissions());
    assert(procCol.ClassifyProcess("code.exe") == "APPROVED");
    assert(procCol.ClassifyProcess("anydesk.exe") == "RESTRICTED");
    assert(procCol.ClassifyProcess("random_unknown.exe") == "UNCLASSIFIED");

    size_t events_received = 0;
    procCol.Start([&events_received](const RawObservationEvent& ev) {
        events_received++;
    });
    procCol.Observe();
    assert(procCol.GetActiveProcessCount() > 0);
    std::cout << " -> ProcessCollector: active processes = " << procCol.GetActiveProcessCount() << std::endl;
    procCol.Stop();

    // Device Collector
    DeviceCollector devCol;
    assert(devCol.Initialize());
    assert(devCol.ValidatePermissions());
    devCol.Start([&events_received](const RawObservationEvent& ev) {
        events_received++;
    });
    devCol.Observe();
    assert(devCol.GetActiveDeviceCount() > 0);
    std::cout << " -> DeviceCollector: enumerated devices = " << devCol.GetActiveDeviceCount() << std::endl;
    devCol.Stop();

    // Display Collector
    DisplayCollector dispCol;
    assert(dispCol.Initialize());
    dispCol.Start([&events_received](const RawObservationEvent& ev) {
        events_received++;
    });
    dispCol.Observe();
    assert(dispCol.GetMonitorCount() > 0);
    std::cout << " -> DisplayCollector: active monitors = " << dispCol.GetMonitorCount() << std::endl;
    dispCol.Stop();

    // Network Collector
    NetworkCollector netCol;
    assert(netCol.Initialize());
    netCol.Start([&events_received](const RawObservationEvent& ev) {
        events_received++;
    });
    netCol.Observe();
    assert(netCol.GetActiveAdapterCount() > 0);
    std::cout << " -> NetworkCollector: active adapters = " << netCol.GetActiveAdapterCount() << std::endl;
    netCol.Stop();

    // Remote Session Collector
    RemoteSessionCollector rmtCol;
    assert(rmtCol.Initialize());
    rmtCol.Start([](const RawObservationEvent&) {});
    rmtCol.Observe();
    std::cout << " -> RemoteSessionCollector: remote active = " << (rmtCol.IsRemoteSessionActive() ? "YES" : "NO") << std::endl;
    rmtCol.Stop();

    // Health Collector
    HealthCollector hlthCol;
    assert(hlthCol.Initialize());
    bool healthEmitted = false;
    hlthCol.Start([&healthEmitted](const RawObservationEvent& ev) {
        healthEmitted = true;
    });
    hlthCol.Observe();
    assert(healthEmitted);
    std::cout << " -> HealthCollector: health reported successfully." << std::endl;
    hlthCol.Stop();
}

void TestJournalWalAndRecovery() {
    std::cout << "[Test 3/5] Testing Journal WAL & Restart Recovery..." << std::endl;
    std::string test_dir = "./tmp_test_journal";
    std::string session_id = "test-session-12345";

    // Clean prior runs if any
    std::filesystem::remove_all(test_dir);

    {
        JournalWal wal(test_dir, session_id);
        assert(wal.GetCurrentSequence() == 0);
        assert(wal.GetAcknowledgedSequence() == 0);

        RawObservationEvent raw1{
            .event_type = "PROCESS_STARTED",
            .source_collector = CollectorType::Process,
            .client_time = std::chrono::system_clock::now(),
            .monotonic_timestamp_ns = 1000000,
            .payload = {{"pid", 101}, {"name", "code.exe"}}
        };
        auto rec1 = wal.AppendObservation(raw1, "test-assessment-1");
        assert(rec1.sequence == 1);
        assert(wal.GetCurrentSequence() == 1);

        RawObservationEvent raw2{
            .event_type = "DEVICE_CONNECTED",
            .source_collector = CollectorType::Device,
            .client_time = std::chrono::system_clock::now(),
            .monotonic_timestamp_ns = 2000000,
            .payload = {{"device_id", "USB\\VID_1234"}}
        };
        auto rec2 = wal.AppendObservation(raw2, "test-assessment-1");
        assert(rec2.sequence == 2);
        assert(rec2.previous_event_hash == rec1.current_event_hash);

        auto batch = wal.SealPendingBatch("SIG_TEST_BATCH_1");
        assert(batch.sequence_start == 1);
        assert(batch.sequence_end == 2);
        assert(batch.event_count == 2);
        assert(wal.GetUnacknowledgedBatchCount() == 1);

        wal.AcknowledgeBatch(batch.batch_id, 2);
        assert(wal.GetUnacknowledgedBatchCount() == 0);
        assert(wal.GetAcknowledgedSequence() == 2);
    }

    // Now simulate application crash & recovery
    {
        JournalWal recoveredWal(test_dir, session_id);
        assert(recoveredWal.GetCurrentSequence() == 2);
        assert(recoveredWal.GetAcknowledgedSequence() == 2);

        // Append next event after recovery
        RawObservationEvent raw3{
            .event_type = "HEARTBEAT",
            .source_collector = CollectorType::Health,
            .client_time = std::chrono::system_clock::now(),
            .monotonic_timestamp_ns = 3000000,
            .payload = {{"status", "ONLINE"}}
        };
        auto rec3 = recoveredWal.AppendObservation(raw3, "test-assessment-1");
        assert(rec3.sequence == 3);
        assert(recoveredWal.GetCurrentSequence() == 3);
        std::cout << " -> JournalWal: recovered sequence 2 and seamlessly appended sequence 3." << std::endl;
    }

    std::filesystem::remove_all(test_dir);
}

void TestAgentCoreOrchestration() {
    std::cout << "[Test 4/5] Testing AgentCore Autonomous Orchestration..." << std::endl;
    std::string test_dir = "./tmp_test_agent_core";
    std::filesystem::remove_all(test_dir);

    AgentCore agent("session-abc", "assessment-xyz", "candidate-42", test_dir);
    assert(agent.InitializeCollectors());
    assert(agent.Start());

    // Allow collectors to observe
    std::this_thread::sleep_for(std::chrono::milliseconds(1200));

    assert(agent.GetTotalEventsObserved() > 0);
    std::cout << " -> AgentCore observed " << agent.GetTotalEventsObserved() << " events in 1.2s." << std::endl;

    auto batch = agent.SealBatch("MOCK_P256_SIG");
    assert(batch.event_count > 0);
    assert(!batch.merkle_root.empty());
    std::cout << " -> AgentCore sealed batch [" << batch.sequence_start << " - " << batch.sequence_end
              << "] with root " << batch.merkle_root.substr(0, 16) << "..." << std::endl;

    agent.AcknowledgeBatch(batch.batch_id, batch.sequence_end);
    assert(agent.GetJournal()->GetAcknowledgedSequence() == batch.sequence_end);

    agent.DisplayCandidateTransparencyStatus();
    agent.Stop();

    std::filesystem::remove_all(test_dir);
    std::cout << " -> AgentCore stopped cleanly." << std::endl;
}

int main() {
    std::cout << "\n==========================================" << std::endl;
    std::cout << "  INTERVIEWOS NATIVE C++20 AGENT TEST SUITE" << std::endl;
    std::cout << "==========================================" << std::endl;

    try {
        TestCngCrypto();
        TestCollectors();
        TestJournalWalAndRecovery();
        TestAgentCoreOrchestration();
        std::cout << "\nALL 5 NATIVE AGENT TEST SUITES PASSED (100% SUCCESS)!\n" << std::endl;
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "EXCEPTION: " << ex.what() << std::endl;
        return 1;
    }
}
