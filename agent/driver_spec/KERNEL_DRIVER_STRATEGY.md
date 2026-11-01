# Technical Specification: Windows Kernel-Mode Endpoint Driver Strategy

**Status**: Technical Architecture & Security Evaluation  
**Target Environment**: Windows 11 x64 (22H2 / 23H2 / 24H2)  
**Security Standard**: HVCI (Hypervisor-Protected Code Integrity) & Microsoft WHQL Signing  

---

## 1. Guiding Principle: Documented User-Mode First

As established in the InterviewOS Product Definition:
> *Do not build a custom operating system or immediately introduce a large privileged kernel driver simply to make the product appear more advanced. First establish what can be implemented reliably using documented Windows user-mode facilities.*

The native user-mode runtime currently delivers:
1. **Process Tracking**: `CreateToolhelp32Snapshot` with periodic reconciliation and planned ETW kernel event session consumption.
2. **Device PnP Telemetry**: SetupAPI and CM Register Notifications for USB, capture hardware, and tethering detection.
3. **Bluetooth Discovery**: Windows Bluetooth Radio APIs for paired/connected device classification.
4. **Network Telemetry**: Windows IP Helper extended TCP table and ARP neighbor table enumeration.
5. **Display & Session State**: `QueryDisplayConfig` and Windows Terminal Services (`WTSEnumerateSessionsW`).

---

## 2. Technical Justification for Kernel-Mode Components

A kernel-mode component is technically justified **only** for capabilities that user-mode APIs mathematically cannot guarantee:

| Security Requirement | User-Mode Limitation | Kernel-Mode Mechanism | Justification Status |
|---|---|---|---|
| **Zero-Window Process Creation Interception** | Snapshot polling has a 500ms window; short-lived ephemeral processes can spawn and terminate unobserved. | `PsSetCreateProcessNotifyRoutineEx` | High Priority for Managed High-Stakes Assessments |
| **Tamper Resistance against Process Suspension** | User-mode processes running at `Medium Integrity` can be suspended by local Administrators (`PROCESS_SUSPEND_RESUME`). | `ObRegisterCallbacks` (Pre-operation process handle strip) | Medium Priority (Restricted to High-Stakes Exam Labs) |
| **Raw Packet / Network Filter Enforcement** | User-mode IP Helper can only read established connections after socket bind. | Windows Filtering Platform (WFP) Kernel-Mode Callout Driver | High Priority for Full Network Isolation Mode |

---

## 3. Strict Driver Security & Compliance Architecture

Any future kernel driver implemented for InterviewOS must strictly comply with Microsoft Driver Security Requirements:

1. **HVCI & Memory Integrity Compatibility**:
   - Zero executable pool allocations (`NonPagedPoolNx` only).
   - Compatibility with Virtualization-Based Security (VBS) and Hypervisor Code Integrity.
2. **IOCTL Security & Access Control**:
   - Device objects created with `FILE_DEVICE_SECURE_OPEN`.
   - Access control restricted via strict SDDL allowing communication **only** from the authenticated InterviewOS Windows Service running as `NT AUTHORITY\SYSTEM`.
   - All input buffers validated using `METHOD_BUFFERED` to eliminate Time-of-Check to Time-of-Use (TOCTOU) race conditions.
3. **Non-Blocking Callbacks**:
   - Process creation callbacks must perform immediate asynchronous queueing without blocking the caller thread.
4. **No Rootkit / Anti-Analysis Tactics**:
   - The driver will **never** attempt to hide itself from Task Manager, bypass Windows security controls, or interfere with third-party endpoint protection (EDR/AV).
5. **Production Deployment & Signing**:
   - Requires EV (Extended Validation) Code Signing Certificate and submission to the Microsoft Hardware Developer Center (WHQL) for attestation signing.
