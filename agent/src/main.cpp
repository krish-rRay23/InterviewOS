#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iostream>
#include <csignal>
#include "../include/agent_core.hpp"

std::unique_ptr<interviewos::AgentCore> g_agent;

void SignalHandler(int signum) {
    std::cout << "\n[InterviewOS] Received shutdown signal (" << signum << "). Stopping gracefully...\n";
    if (g_agent) {
        g_agent->Stop();
    }
    exit(signum);
}

int main(int argc, char* argv[]) {
    std::string session_id = "session-demo-001";
    std::string assessment_id = "assessment-demo-001";
    std::string candidate_id = "candidate-demo-001";
    std::string journal_dir = "./evidence_journal";

    if (argc >= 4) {
        session_id = argv[1];
        assessment_id = argv[2];
        candidate_id = argv[3];
    }
    if (argc >= 5) {
        journal_dir = argv[4];
    }

    signal(SIGINT, SignalHandler);
    signal(SIGTERM, SignalHandler);

    std::cout << "Starting InterviewOS Native Windows Endpoint Agent...\n";
    g_agent = std::make_unique<interviewos::AgentCore>(session_id, assessment_id, candidate_id, journal_dir);

    if (!g_agent->InitializeCollectors()) {
        std::cerr << "Collector initialization failed.\n";
        return 1;
    }

    if (!g_agent->Start()) {
        std::cerr << "Failed to start agent observation.\n";
        return 1;
    }

    g_agent->DisplayCandidateTransparencyStatus();
    std::cout << "Agent is observing and journaling evidence. Press Ctrl+C to terminate.\n";

    // Run for demo or keep running
    for (int i = 0; i < 10; ++i) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        if (i % 3 == 0) {
            auto batch = g_agent->SealBatch("LOCAL_TEST_SIGNATURE");
            if (batch.event_count > 0) {
                std::cout << "[IOEP Journal] Sealed batch [" << batch.sequence_start << ".." << batch.sequence_end
                          << "] Merkle Root: " << batch.merkle_root.substr(0, 16) << "...\n";
                g_agent->AcknowledgeBatch(batch.batch_id, batch.sequence_end);
            }
        }
    }

    g_agent->DisplayCandidateTransparencyStatus();
    g_agent->Stop();
    std::cout << "InterviewOS Agent shut down cleanly.\n";
    return 0;
}

