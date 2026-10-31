# Native Windows Endpoint Agent Architecture

## 1. Overview
The InterviewOS Windows Endpoint Agent is implemented in **modern C++20**, targeting Windows 11 x86_64 systems with architectural compatibility for Windows 10 LTSC.

## 2. Collector Specifications

### 2.1 Process Collector
- **API**: `CreateToolhelp32Snapshot`, `Process32FirstW`, `Process32NextW` alongside ETW provider hooks.
- **Classification Engine**:
  - `APPROVED`: Standard developer IDEs (`code.exe`, `devenv.exe`, `idea64.exe`), compilers (`g++.exe`, `clang++.exe`, `javac.exe`), browsers (`chrome.exe`, `msedge.exe`), and terminal emulators.
  - `RESTRICTED`: Remote control / screen share software (`anydesk.exe`, `teamviewer.exe`, `vncserver.exe`), hypervisor utilities (`vmware.exe`, `vboxservice.exe`).
  - `UNCLASSIFIED`: Other active background processes.
- **Privacy Boundary**: Captures executable image names and timestamps only. Keystroke logging, memory dumping, and unrelated file content extraction are strictly prohibited.

### 2.2 Device Collector
- **API**: `SetupDiGetClassDevsW`, `SetupDiEnumDeviceInfo`, `SetupDiGetDeviceRegistryPropertyW` (`SPDRP_DEVICEDESC`, `SPDRP_CLASS`).
- **Functionality**: Establishes initial hardware peripheral inventory at session start. Discovers hotplugs and disconnections of USB storage drives, audio interfaces, and external hardware devices. Emits `DEVICE_CONNECTED` and `DEVICE_DISCONNECTED`.

### 2.3 Display Collector
- **API**: `EnumDisplayMonitors`, `GetMonitorInfoW`, `GetSystemMetrics(SM_CMONITORS)`.
- **Functionality**: Monitors active monitor count, display resolution rectangles, and virtual desktop flags. Emits `DISPLAY_TOPOLOGY_CHANGED` when external monitors or virtual displays are toggled.

### 2.4 Network Collector
- **API**: `GetAdaptersAddresses` from `iphlpapi.h`.
- **Functionality**: Tracks network adapter count, operational status (`IfOperStatusUp`), and unicast IPv4 addresses. Emits `NETWORK_INTERFACE_CHANGED` upon network transitions.

### 2.5 Remote Session Collector
- **API**: `WTSQuerySessionInformationW` from `wtsapi32.h` and `GetSystemMetrics(SM_REMOTESESSION)`.
- **Functionality**: Identifies active Terminal Services / RDP client connections.

### 2.6 Health Collector
- **API**: `GetProcessMemoryInfo` from `psapi.h` and monotonic timers.
- **Functionality**: Emits periodic `HEARTBEAT` events and memory working set telemetry.

---

## 3. Cryptographic Storage & Local Journal WAL
- **Hash Chaining**:
  $$H_i = \text{SHA-256}(\text{"IOEP-EVENT-V1:"} \parallel SessionId \parallel i \parallel H_{i-1} \parallel \text{Canonical}(e_i.\text{payload}))$$
- **Checkpointing**: Every $K$ events, the agent constructs a binary Merkle tree compliant with RFC 9162 and signs the root using ECDSA P-256.
- **WAL Persistence**: Writes immediately to disk with append-only sync flushing, surviving sudden process termination or network failure.
