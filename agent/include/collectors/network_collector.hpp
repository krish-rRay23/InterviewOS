#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iphlpapi.h>
#include <tcpmib.h>
#include "../collector_interface.hpp"
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>

namespace interviewos {

struct NetworkAdapterState {
    std::string adapter_name;
    std::string description;
    DWORD if_type;
    IF_OPER_STATUS oper_status;
    std::vector<std::string> unicast_addresses;
};

class NetworkCollector : public ICollector {
public:
    NetworkCollector() = default;
    ~NetworkCollector() override { Stop(); }

    CollectorType GetType() const override { return CollectorType::Network; }
    std::string GetName() const override { return "WindowsNativeNetworkCollector"; }
    std::string GetVersion() const override { return "1.0.0"; }

    bool Initialize() override {
        return true;
    }

    bool ValidatePermissions() override {
        ULONG outBufLen = 15000;
        std::vector<BYTE> buf(outBufLen);
        DWORD dwRet = GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_INCLUDE_PREFIX, NULL,
                                          reinterpret_cast<PIP_ADAPTER_ADDRESSES>(buf.data()), &outBufLen);
        return (dwRet == NO_ERROR || dwRet == ERROR_BUFFER_OVERFLOW);
    }

    bool Start(EventEmitCallback callback) override {
        callback_ = std::move(callback);
        running_ = true;
        TakeSnapshot(true);
        return true;
    }

    void Observe() override {
        if (!running_) return;
        TakeSnapshot(false);
    }

    CollectorHealthStatus ReportHealth() override {
        return CollectorHealthStatus{
            .type = CollectorType::Network,
            .healthy = last_error_.empty(),
            .last_error = last_error_,
            .events_emitted = events_emitted_,
            .last_observed_time = std::chrono::system_clock::now()
        };
    }

    void Stop() override {
        running_ = false;
        adapters_.clear();
    }

    size_t GetActiveAdapterCount() const {
        return adapters_.size();
    }

private:
    void TakeSnapshot(bool is_baseline) {
        ULONG outBufLen = 15000;
        std::vector<BYTE> buf(outBufLen);
        DWORD dwRet = GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_INCLUDE_PREFIX, NULL,
                                          reinterpret_cast<PIP_ADAPTER_ADDRESSES>(buf.data()), &outBufLen);
        if (dwRet == ERROR_BUFFER_OVERFLOW) {
            buf.resize(outBufLen);
            dwRet = GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_INCLUDE_PREFIX, NULL,
                                         reinterpret_cast<PIP_ADAPTER_ADDRESSES>(buf.data()), &outBufLen);
        }

        if (dwRet != NO_ERROR) {
            last_error_ = "GetAdaptersAddresses failed with code " + std::to_string(dwRet);
            return;
        }

        std::unordered_map<std::string, NetworkAdapterState> current_adapters;
        PIP_ADAPTER_ADDRESSES pCurr = reinterpret_cast<PIP_ADAPTER_ADDRESSES>(buf.data());

        while (pCurr) {
            std::string name(pCurr->AdapterName);
            std::wstring wsDesc(pCurr->Description);
            std::string desc(wsDesc.begin(), wsDesc.end());

            std::vector<std::string> ips;
            PIP_ADAPTER_UNICAST_ADDRESS pUnicast = pCurr->FirstUnicastAddress;
            while (pUnicast) {
                char ipStr[INET6_ADDRSTRLEN] = {0};
                if (pUnicast->Address.lpSockaddr->sa_family == AF_INET) {
                    sockaddr_in* sa_in = reinterpret_cast<sockaddr_in*>(pUnicast->Address.lpSockaddr);
                    inet_ntop(AF_INET, &(sa_in->sin_addr), ipStr, sizeof(ipStr));
                    ips.push_back(ipStr);
                }
                pUnicast = pUnicast->Next;
            }

            current_adapters[name] = NetworkAdapterState{
                .adapter_name = name,
                .description = desc,
                .if_type = pCurr->IfType,
                .oper_status = pCurr->OperStatus,
                .unicast_addresses = ips
            };

            pCurr = pCurr->Next;
        }

        if (!is_baseline && callback_) {
            // Check changes in operational status or count
            bool status_changed = false;
            for (const auto& [name, state] : current_adapters) {
                auto it = adapters_.find(name);
                if (it == adapters_.end() || it->second.oper_status != state.oper_status) {
                    status_changed = true;
                    break;
                }
            }

            if (status_changed || current_adapters.size() != adapters_.size()) {
                json adp_arr = json::array();
                for (const auto& [name, state] : current_adapters) {
                    adp_arr.push_back({
                        {"description", state.description},
                        {"oper_status", state.oper_status == IfOperStatusUp ? "UP" : "DOWN"},
                        {"ip_count", state.unicast_addresses.size()}
                    });
                }

                RawObservationEvent evt{
                    .event_type = "NETWORK_INTERFACE_CHANGED",
                    .source_collector = CollectorType::Network,
                    .client_time = std::chrono::system_clock::now(),
                    .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                    .payload = {
                        {"adapter_count", current_adapters.size()},
                        {"adapters", adp_arr}
                    }
                };
                events_emitted_++;
                callback_(evt);
            }
        }

        adapters_ = std::move(current_adapters);

        // Collect active TCP connections and remote IP associations
        ObserveConnections(is_baseline);

        // Collect ARP/ND local neighbor table
        ObserveNeighbors(is_baseline);
    }

    void ObserveConnections(bool is_baseline) {
        ULONG ulSize = 0;
        // First query size
        GetExtendedTcpTable(NULL, &ulSize, TRUE, AF_INET, TCP_TABLE_OWNER_PID_ALL, 0);
        if (ulSize == 0) return;

        std::vector<BYTE> buffer(ulSize);
        if (GetExtendedTcpTable(buffer.data(), &ulSize, TRUE, AF_INET, TCP_TABLE_OWNER_PID_ALL, 0) == NO_ERROR) {
            PMIB_TCPTABLE_OWNER_PID pTable = reinterpret_cast<PMIB_TCPTABLE_OWNER_PID>(buffer.data());
            std::unordered_set<std::string> current_conns;

            for (DWORD i = 0; i < pTable->dwNumEntries; ++i) {
                const auto& row = pTable->table[i];
                if (row.dwState == MIB_TCP_STATE_ESTAB) {
                    char localIP[INET_ADDRSTRLEN];
                    char remoteIP[INET_ADDRSTRLEN];
                    struct in_addr localAddr;
                    struct in_addr remoteAddr;
                    localAddr.S_un.S_addr = row.dwLocalAddr;
                    remoteAddr.S_un.S_addr = row.dwRemoteAddr;
                    inet_ntop(AF_INET, &localAddr, localIP, sizeof(localIP));
                    inet_ntop(AF_INET, &remoteAddr, remoteIP, sizeof(remoteIP));

                    std::string remStr(remoteIP);
                    // Filter localhost
                    if (remStr == "127.0.0.1" || remStr == "0.0.0.0") continue;

                    std::string connKey = remStr + ":" + std::to_string(ntohs((u_short)row.dwRemotePort)) + "->pid:" + std::to_string(row.dwOwningPid);
                    current_conns.insert(connKey);

                    if (!is_baseline && active_connections_.find(connKey) == active_connections_.end() && callback_) {
                        RawObservationEvent evt{
                            .event_type = "NETWORK_CONNECTION_DETECTED",
                            .source_collector = CollectorType::Network,
                            .client_time = std::chrono::system_clock::now(),
                            .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                            .payload = {
                                {"local_ip", localIP},
                                {"local_port", ntohs((u_short)row.dwLocalPort)},
                                {"remote_ip", remoteIP},
                                {"remote_port", ntohs((u_short)row.dwRemotePort)},
                                {"protocol", "TCP"},
                                {"owning_pid", row.dwOwningPid},
                                {"state", "ESTABLISHED"}
                            }
                        };
                        events_emitted_++;
                        callback_(evt);
                    }
                }
            }
            active_connections_ = std::move(current_conns);
        }
    }

    void ObserveNeighbors(bool is_baseline) {
        ULONG outLen = 0;
        GetIpNetTable(NULL, &outLen, FALSE);
        if (outLen == 0) return;

        std::vector<BYTE> buf(outLen);
        PMIB_IPNETTABLE pNetTable = reinterpret_cast<PMIB_IPNETTABLE>(buf.data());
        if (GetIpNetTable(pNetTable, &outLen, FALSE) == NO_ERROR) {
            std::unordered_set<std::string> current_neighbors;

            for (DWORD i = 0; i < pNetTable->dwNumEntries; ++i) {
                const auto& row = pNetTable->table[i];
                // Ignore invalid or broadcast/multicast entries
                if (row.dwType == MIB_IPNET_TYPE_DYNAMIC || row.dwType == MIB_IPNET_TYPE_STATIC) {
                    struct in_addr ipAddr;
                    ipAddr.S_un.S_addr = row.dwAddr;
                    char ipStr[INET_ADDRSTRLEN];
                    inet_ntop(AF_INET, &ipAddr, ipStr, sizeof(ipStr));

                    char macStr[32];
                    snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
                             row.bPhysAddr[0], row.bPhysAddr[1], row.bPhysAddr[2],
                             row.bPhysAddr[3], row.bPhysAddr[4], row.bPhysAddr[5]);

                    std::string neighborKey = std::string(ipStr) + "[" + macStr + "]";
                    current_neighbors.insert(neighborKey);

                    if (!is_baseline && known_neighbors_.find(neighborKey) == known_neighbors_.end() && callback_) {
                        RawObservationEvent evt{
                            .event_type = "NETWORK_NEIGHBOR_OBSERVED",
                            .source_collector = CollectorType::Network,
                            .client_time = std::chrono::system_clock::now(),
                            .monotonic_timestamp_ns = GetMonotonicTimestampNs(),
                            .payload = {
                                {"ip_address", ipStr},
                                {"mac_address", macStr},
                                {"entry_type", (row.dwType == MIB_IPNET_TYPE_DYNAMIC) ? "DYNAMIC_ARP" : "STATIC_ARP"},
                                {"source", "Windows_IP_Helper_Neighbor_Table"},
                                {"disclaimer", "Local ARP/ND neighbor table does not guarantee total LAN enumeration"}
                            }
                        };
                        events_emitted_++;
                        callback_(evt);
                    }
                }
            }
            known_neighbors_ = std::move(current_neighbors);
        }
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
    std::unordered_map<std::string, NetworkAdapterState> adapters_;
    std::unordered_set<std::string> active_connections_;
    std::unordered_set<std::string> known_neighbors_;
};

} // namespace interviewos
