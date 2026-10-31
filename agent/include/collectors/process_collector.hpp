#pragma once

#include "../collector_interface.hpp"
#include <windows.h>
#include <tlhelp32.h>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <iostream>

namespace interviewos {

class ProcessCollector : public ICollector {
public:
    ProcessCollector() = default;
    ~ProcessCollector() override { Stop(); }

    CollectorType GetType() const override { return CollectorType::Process; }
    std::string GetName() const override { return "WindowsNativeProcessCollector"; }
    std::string GetVersion() const override { return "1.0.0"; }

    bool Initialize() override {
        // Build classification lookup
        approved_processes_ = {
            "code.exe", "devenv.exe", "idea64.exe", "pycharm64.exe",
            "chrome.exe", "msedge.exe", "firefox.exe",
            "powershell.exe", "cmd.exe", "wt.exe", "bash.exe",
            "g++.exe", "clang++.exe", "javac.exe", "python.exe", "go.exe",
            "explorer.exe", "svchost.exe", "taskhostw.exe"
        };

        restricted_processes_ = {
            "anydesk.exe", "teamviewer.exe", "vncserver.exe", "tv_w32.exe",
            "ultraviewer.exe", "parsec.exe", "rustdesk.exe",
            "vmware.exe", "virtualbox.exe", "vboxservice.exe"
        };
        return true;
    }

    bool ValidatePermissions() override {
        // Can open process snapshot
        HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (hSnap == INVALID_HANDLE_VALUE) {
            last_error_ = "Failed to obtain TH32CS_SNAPPROCESS handle";
            return false;
        }
        CloseHandle(hSnap);
        return true;
    }

    bool Start(EventEmitCallback callback) override {
        callback_ = std::move(callback);
        running_ = true;
        TakeSnapshot(true); // Initial baseline
        return true;
    }

    void Observe() override {
        if (!running_) return;
        TakeSnapshot(false);
    }

    CollectorHealthStatus ReportHealth() override {
        return CollectorHealthStatus{
            .type = CollectorType::Process,
            .healthy = last_error_.empty(),
            .last_error = last_error_,
            .events_emitted = events_emitted_,
            .last_observed_time = std::chrono::system_clock::now()
        };
    }

    void Stop() override {
        running_ = false;
        active_processes_.clear();
    }

    std::string ClassifyProcess(const std::string& process_name) const {
        std::string lower = process_name;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);

        if (restricted_processes_.count(lower)) {
            return "RESTRICTED";
        }
        if (approved_processes_.count(lower)) {
            return "APPROVED";
        }
        return "UNCLASSIFIED";
    }

    size_t GetActiveProcessCount() const {
        return active_processes_.size();
    }

private:
    void TakeSnapshot(bool is_baseline) {
        HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (hSnap == INVALID_HANDLE_VALUE) {
            last_error_ = "CreateToolhelp32Snapshot failed";
            return;
        }

        PROCESSENTRY32W pe32;
        pe32.dwSize = sizeof(PROCESSENTRY32W);

        std::unordered_map<DWORD, std::string> current_snapshot;
        if (Process32FirstW(hSnap, &pe32)) {
            do {
                std::wstring ws(pe32.szExeFile);
                std::string exeName(ws.begin(), ws.end());
                current_snapshot[pe32.th32ProcessID] = exeName;
            } while (Process32NextW(hSnap, &pe32));
        }
        CloseHandle(hSnap);

        if (!is_baseline && callback_) {
            // Check newly created processes
            for (const auto& [pid, name] : current_snapshot) {
                if (active_processes_.find(pid) == active_processes_.end()) {
                    std::string category = ClassifyProcess(name);
                    RawObservationEvent evt{
                        .event_type = "PROCESS_STARTED",
                        .source_collector = CollectorType::Process,
                        .client_time = std::chrono::system_clock::now(),
                        .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                        .payload = {
                            {"pid", pid},
                            {"process_name", name},
                            {"classification", category},
                            {"source", "Toolhelp32_Snapshot"}
                        }
                    };
                    events_emitted_++;
                    callback_(evt);
                }
            }

            // Check terminated processes
            for (const auto& [pid, name] : active_processes_) {
                if (current_snapshot.find(pid) == current_snapshot.end()) {
                    RawObservationEvent evt{
                        .event_type = "PROCESS_TERMINATED",
                        .source_collector = CollectorType::Process,
                        .client_time = std::chrono::system_clock::now(),
                        .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                        .payload = {
                            {"pid", pid},
                            {"process_name", name},
                            {"source", "Toolhelp32_Snapshot"}
                        }
                    };
                    events_emitted_++;
                    callback_(evt);
                }
            }
        }

        active_processes_ = std::move(current_snapshot);
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
    std::unordered_map<DWORD, std::string> active_processes_;
    std::unordered_set<std::string> approved_processes_;
    std::unordered_set<std::string> restricted_processes_;
};

} // namespace interviewos

