#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <iostream>
#include <nlohmann/json.hpp>
#include "journal_wal.hpp"
#include "cng_crypto.hpp"

namespace interviewos {

class SyncManager {
public:
    SyncManager(const std::string& host = "localhost", int port = 8080)
        : host_(host), port_(port) {
        hSession_ = WinHttpOpen(L"InterviewOS-NativeAgent/1.0",
                                WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                WINHTTP_NO_PROXY_NAME,
                                WINHTTP_NO_PROXY_BYPASS, 0);
    }

    ~SyncManager() {
        if (hSession_) {
            WinHttpCloseHandle(hSession_);
        }
    }

    bool FetchServerChallenge(const std::string& session_id, std::string& server_nonce) {
        std::string path = "/v1/sessions/" + session_id + "/challenge";
        std::string response;
        int status_code = 0;
        if (!SendHttpRequest("POST", path, "", response, status_code) || status_code != 200) {
            return false;
        }

        try {
            auto j = nlohmann::json::parse(response);
            server_nonce = j.value("server_nonce", "");
            return !server_nonce.empty();
        } catch (...) {
            return false;
        }
    }

    bool EnrollSession(const std::string& session_id, const std::string& candidate_id,
                       const std::string& assessment_id, const std::string& public_key_pem,
                       const std::string& client_nonce, const std::string& server_nonce,
                       const std::string& challenge_sig) {
        std::string path = "/v1/sessions/" + session_id + "/enroll";
        nlohmann::json payload = {
            {"session_id", session_id},
            {"candidate_id", candidate_id},
            {"assessment_id", assessment_id},
            {"public_key_pem", public_key_pem},
            {"key_algorithm", "ECDSA_P256_SHA256"},
            {"key_protection_type", "SOFTWARE_CNG_DPAPI"},
            {"client_nonce", client_nonce},
            {"server_challenge_nonce", server_nonce},
            {"challenge_signature", challenge_sig},
            {"os_version", "Windows 11 x86_64 Build 22631"},
            {"agent_version", "1.0.0"},
            {"enrolled_at_utc", "2026-11-01T00:00:00Z"}
        };

        std::string response;
        int status_code = 0;
        return SendHttpRequest("POST", path, payload.dump(), response, status_code) && (status_code == 200);
    }

    bool UploadBatch(const SignedBatchRecord& batch, int64_t& ack_seq) {
        std::string path = "/v1/sessions/" + batch.session_id + "/batches";
        std::string response;
        int status_code = 0;
        bool ok = SendHttpRequest("POST", path, batch.ToJson().dump(), response, status_code);
        if (ok && (status_code == 202 || status_code == 200)) {
            try {
                auto j = nlohmann::json::parse(response);
                ack_seq = j.value("acknowledged_sequence", batch.sequence_end);
                return true;
            } catch (...) {
                ack_seq = batch.sequence_end;
                return true;
            }
        }
        return false;
    }

    bool SendHeartbeat(const std::string& session_id) {
        std::string path = "/v1/sessions/" + session_id + "/heartbeat";
        std::string response;
        int status_code = 0;
        return SendHttpRequest("POST", path, "{}", response, status_code) && (status_code == 200);
    }

    bool FlushPendingBatches(JournalWal* journal) {
        if (!journal) return false;
        auto batches = journal->GetUnacknowledgedBatches();
        bool all_ok = true;
        for (const auto& b : batches) {
            int64_t ack_seq = 0;
            if (UploadBatch(b, ack_seq)) {
                journal->AcknowledgeBatch(b.batch_id, ack_seq);
            } else {
                all_ok = false;
                break; // Preserve monotonic in-order transmission
            }
        }
        return all_ok;
    }

private:
    bool SendHttpRequest(const std::string& method, const std::string& path,
                         const std::string& body, std::string& out_response, int& out_status) {
        if (!hSession_) return false;

        std::wstring wsHost(host_.begin(), host_.end());
        HINTERNET hConnect = WinHttpConnect(hSession_, wsHost.c_str(), port_, 0);
        if (!hConnect) return false;

        std::wstring wsMethod(method.begin(), method.end());
        std::wstring wsPath(path.begin(), path.end());

        HINTERNET hRequest = WinHttpOpenRequest(hConnect, wsMethod.c_str(), wsPath.c_str(),
                                                NULL, WINHTTP_NO_REFERER,
                                                WINHTTP_DEFAULT_ACCEPT_TYPES, 0);
        if (!hRequest) {
            WinHttpCloseHandle(hConnect);
            return false;
        }

        std::wstring headers = L"Content-Type: application/json\r\n";
        BOOL bResults = WinHttpSendRequest(hRequest, headers.c_str(), (DWORD)-1,
                                           (LPVOID)body.data(), (DWORD)body.size(),
                                           (DWORD)body.size(), 0);

        if (bResults) {
            bResults = WinHttpReceiveResponse(hRequest, NULL);
        }

        if (bResults) {
            DWORD dwStatusCode = 0;
            DWORD dwSize = sizeof(dwStatusCode);
            WinHttpQueryHeaders(hRequest, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                                WINHTTP_HEADER_NAME_BY_INDEX, &dwStatusCode, &dwSize, WINHTTP_NO_HEADER_INDEX);
            out_status = (int)dwStatusCode;

            DWORD dwDownloaded = 0;
            out_response.clear();
            do {
                dwSize = 0;
                WinHttpQueryDataAvailable(hRequest, &dwSize);
                if (dwSize > 0) {
                    std::vector<char> buffer(dwSize + 1);
                    if (WinHttpReadData(hRequest, buffer.data(), dwSize, &dwDownloaded)) {
                        out_response.append(buffer.data(), dwDownloaded);
                    }
                }
            } while (dwSize > 0);
        }

        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        return bResults == TRUE;
    }

    std::string host_;
    int port_;
    HINTERNET hSession_ = NULL;
};

} // namespace interviewos
