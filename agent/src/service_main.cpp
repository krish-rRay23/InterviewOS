#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <tchar.h>
#include <iostream>
#include <memory>
#include "../include/agent_core.hpp"

#define SERVICE_NAME _T("InterviewOSEndpointTrustService")
#define SERVICE_DISPLAY_NAME _T("InterviewOS Endpoint Trust Service")

SERVICE_STATUS g_ServiceStatus = {0};
SERVICE_STATUS_HANDLE g_StatusHandle = NULL;
HANDLE g_ServiceStopEvent = INVALID_HANDLE_VALUE;
std::unique_ptr<interviewos::AgentCore> g_AgentInstance;

VOID WINAPI ServiceMain(DWORD argc, LPTSTR *argv);
VOID WINAPI ServiceCtrlHandler(DWORD request);

void InstallService() {
    SC_HANDLE schSCManager = OpenSCManager(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    if (!schSCManager) {
        std::cerr << "OpenSCManager failed. Error: " << GetLastError() << "\n";
        return;
    }

    TCHAR szPath[MAX_PATH];
    if (!GetModuleFileName(NULL, szPath, MAX_PATH)) {
        CloseServiceHandle(schSCManager);
        return;
    }

    SC_HANDLE schService = CreateService(
        schSCManager,
        SERVICE_NAME,
        SERVICE_DISPLAY_NAME,
        SERVICE_ALL_ACCESS,
        SERVICE_WIN32_OWN_PROCESS,
        SERVICE_AUTO_START,
        SERVICE_ERROR_NORMAL,
        szPath,
        NULL, NULL, NULL, NULL, NULL
    );

    if (!schService) {
        std::cerr << "CreateService failed. Error: " << GetLastError() << "\n";
    } else {
        std::cout << "Service installed successfully.\n";
        CloseServiceHandle(schService);
    }
    CloseServiceHandle(schSCManager);
}

void UninstallService() {
    SC_HANDLE schSCManager = OpenSCManager(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    if (!schSCManager) return;

    SC_HANDLE schService = OpenService(schSCManager, SERVICE_NAME, SERVICE_STOP | DELETE);
    if (schService) {
        SERVICE_STATUS status;
        ControlService(schService, SERVICE_CONTROL_STOP, &status);
        if (DeleteService(schService)) {
            std::cout << "Service uninstalled successfully.\n";
        }
        CloseServiceHandle(schService);
    }
    CloseServiceHandle(schSCManager);
}

int _tmain(int argc, _TCHAR* argv[]) {
    if (argc > 1) {
        if (_tcscmp(argv[1], _T("--install")) == 0) {
            InstallService();
            return 0;
        } else if (_tcscmp(argv[1], _T("--uninstall")) == 0) {
            UninstallService();
            return 0;
        }
    }

    SERVICE_TABLE_ENTRY ServiceTable[] = {
        { (LPTSTR)SERVICE_NAME, (LPSERVICE_MAIN_FUNCTION)ServiceMain },
        { NULL, NULL }
    };

    if (StartServiceCtrlDispatcher(ServiceTable) == FALSE) {
        // Run in interactive console mode if not launched as service
        std::cout << "Starting in interactive console mode (use --install to install Windows Service)...\n";
        g_AgentInstance = std::make_unique<interviewos::AgentCore>(
            "session-service-live", "asmt-service-01", "cand-service-01", "./evidence_journal");
        if (g_AgentInstance->InitializeCollectors()) {
            g_AgentInstance->Start();
            g_AgentInstance->DisplayCandidateTransparencyStatus();
            std::cout << "Running... Press Enter to stop.\n";
            std::cin.get();
            g_AgentInstance->Stop();
        }
    }
    return 0;
}

VOID WINAPI ServiceMain(DWORD argc, LPTSTR *argv) {
    g_StatusHandle = RegisterServiceCtrlHandler(SERVICE_NAME, ServiceCtrlHandler);
    if (g_StatusHandle == NULL) return;

    g_ServiceStatus.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
    g_ServiceStatus.dwCurrentState = SERVICE_START_PENDING;
    g_ServiceStatus.dwControlsAccepted = SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN;
    SetServiceStatus(g_StatusHandle, &g_ServiceStatus);

    g_ServiceStopEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
    if (g_ServiceStopEvent == NULL) {
        g_ServiceStatus.dwCurrentState = SERVICE_STOPPED;
        SetServiceStatus(g_StatusHandle, &g_ServiceStatus);
        return;
    }

    g_AgentInstance = std::make_unique<interviewos::AgentCore>(
        "session-win-svc", "asmt-win-svc", "cand-win-svc", "C:\\ProgramData\\InterviewOS\\journal");
    g_AgentInstance->InitializeCollectors();
    g_AgentInstance->Start(true); // with network sync enabled

    g_ServiceStatus.dwCurrentState = SERVICE_RUNNING;
    SetServiceStatus(g_StatusHandle, &g_ServiceStatus);

    WaitForSingleObject(g_ServiceStopEvent, INFINITE);

    g_AgentInstance->Stop();
    CloseHandle(g_ServiceStopEvent);

    g_ServiceStatus.dwCurrentState = SERVICE_STOPPED;
    SetServiceStatus(g_StatusHandle, &g_ServiceStatus);
}

VOID WINAPI ServiceCtrlHandler(DWORD request) {
    switch (request) {
        case SERVICE_CONTROL_STOP:
        case SERVICE_CONTROL_SHUTDOWN:
            g_ServiceStatus.dwCurrentState = SERVICE_STOP_PENDING;
            SetServiceStatus(g_StatusHandle, &g_ServiceStatus);
            SetEvent(g_ServiceStopEvent);
            break;
        default:
            break;
    }
}
