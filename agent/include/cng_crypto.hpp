#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <bcrypt.h>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <memory>
#include <iostream>
#include <nlohmann/json.hpp>

namespace interviewos {

class CngCrypto {
public:
    static std::string ComputeSHA256(const std::string& input) {
        BCRYPT_ALG_HANDLE hAlg = NULL;
        BCRYPT_HASH_HANDLE hHash = NULL;
        NTSTATUS status = BCryptOpenAlgorithmProvider(&hAlg, BCRYPT_SHA256_ALGORITHM, NULL, 0);
        if (!BCRYPT_SUCCESS(status)) {
            throw std::runtime_error("BCryptOpenAlgorithmProvider failed for SHA-256");
        }

        DWORD cbHash = 0, cbData = 0;
        BCryptGetProperty(hAlg, BCRYPT_HASH_LENGTH, (PBYTE)&cbHash, sizeof(DWORD), &cbData, 0);

        std::vector<UCHAR> hashBuf(cbHash);
        status = BCryptCreateHash(hAlg, &hHash, NULL, 0, NULL, 0, 0);
        if (BCRYPT_SUCCESS(status)) {
            BCryptHashData(hHash, (PBYTE)input.data(), (ULONG)input.size(), 0);
            BCryptFinishHash(hHash, hashBuf.data(), cbHash, 0);
            BCryptDestroyHash(hHash);
        }
        BCryptCloseAlgorithmProvider(hAlg, 0);

        std::stringstream ss;
        for (UCHAR b : hashBuf) {
            ss << std::hex << std::setw(2) << std::setfill('0') << (int)b;
        }
        return ss.str();
    }

    static std::string ComputeSHA256Binary(const std::vector<uint8_t>& input) {
        BCRYPT_ALG_HANDLE hAlg = NULL;
        BCRYPT_HASH_HANDLE hHash = NULL;
        NTSTATUS status = BCryptOpenAlgorithmProvider(&hAlg, BCRYPT_SHA256_ALGORITHM, NULL, 0);
        if (!BCRYPT_SUCCESS(status)) {
            throw std::runtime_error("BCryptOpenAlgorithmProvider failed");
        }

        DWORD cbHash = 0, cbData = 0;
        BCryptGetProperty(hAlg, BCRYPT_HASH_LENGTH, (PBYTE)&cbHash, sizeof(DWORD), &cbData, 0);
        std::vector<UCHAR> hashBuf(cbHash);

        status = BCryptCreateHash(hAlg, &hHash, NULL, 0, NULL, 0, 0);
        if (BCRYPT_SUCCESS(status)) {
            BCryptHashData(hHash, (PBYTE)input.data(), (ULONG)input.size(), 0);
            BCryptFinishHash(hHash, hashBuf.data(), cbHash, 0);
            BCryptDestroyHash(hHash);
        }
        BCryptCloseAlgorithmProvider(hAlg, 0);

        std::stringstream ss;
        for (UCHAR b : hashBuf) {
            ss << std::hex << std::setw(2) << std::setfill('0') << (int)b;
        }
        return ss.str();
    }

    static std::string CanonicalizeJson(const nlohmann::json& j) {
        // nlohmann::json dump with no extra spacing produces sorted keys
        // if using ordered_json or std::map backed json
        return j.dump();
    }

    static std::string GenesisHash(const std::string& session_id) {
        return ComputeSHA256("IOEP-CHAIN-GENESIS:" + session_id);
    }

    static std::string ComputeEventHash(const std::string& session_id, int64_t sequence,
                                       const std::string& prev_hash, const nlohmann::json& payload) {
        std::string canonical_payload = CanonicalizeJson(payload);
        std::string message = "IOEP-EVENT-V1:" + session_id + ":" + std::to_string(sequence) +
                              ":" + prev_hash + ":" + canonical_payload;
        return ComputeSHA256(message);
    }

    static std::string ComputeMerkleRoot(const std::vector<std::string>& event_hashes) {
        if (event_hashes.empty()) {
            throw std::invalid_argument("Cannot compute Merkle root of empty event list");
        }

        std::vector<std::string> current_level;
        for (const auto& h_hex : event_hashes) {
            // Leaf hash: SHA-256(0x00 || hex_decoded(h_hex))
            std::vector<uint8_t> leaf_data = { 0x00 };
            for (size_t i = 0; i < h_hex.length(); i += 2) {
                std::string byteString = h_hex.substr(i, 2);
                uint8_t byte = (uint8_t)strtol(byteString.c_str(), NULL, 16);
                leaf_data.push_back(byte);
            }
            current_level.push_back(ComputeSHA256Binary(leaf_data));
        }

        while (current_level.size() > 1) {
            std::vector<std::string> next_level;
            for (size_t i = 0; i < current_level.size(); i += 2) {
                if (i + 1 < current_level.size()) {
                    std::vector<uint8_t> node_data = { 0x01 };
                    for (int side = 0; side < 2; ++side) {
                        const auto& h = (side == 0) ? current_level[i] : current_level[i + 1];
                        for (size_t k = 0; k < h.length(); k += 2) {
                            node_data.push_back((uint8_t)strtol(h.substr(k, 2).c_str(), NULL, 16));
                        }
                    }
                    next_level.push_back(ComputeSHA256Binary(node_data));
                } else {
                    // Carry forward / duplicate odd leaf
                    std::vector<uint8_t> node_data = { 0x01 };
                    for (int side = 0; side < 2; ++side) {
                        const auto& h = current_level[i];
                        for (size_t k = 0; k < h.length(); k += 2) {
                            node_data.push_back((uint8_t)strtol(h.substr(k, 2).c_str(), NULL, 16));
                        }
                    }
                    next_level.push_back(ComputeSHA256Binary(node_data));
                }
            }
            current_level = next_level;
        }

        return current_level[0];
    }
};

} // namespace interviewos
