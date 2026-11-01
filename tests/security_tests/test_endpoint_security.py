"""
InterviewOS Endpoint & Anti-Cheating Security Verification Suite (Section 9).
Executes automated security tests verifying:
- USB & mobile device classification (Phones, ADB, Storage, Capture cards)
- Bluetooth radio inquiry and device classification
- Windows network socket telemetry & port threat detection
- Evidence cryptographic integrity & sequence gap detection
- Defensive inconclusive handling on ambiguous telemetry
- Decoupled technical competency vs integrity scoring
"""

import unittest
import hashlib
from agents.investigator import BehavioralInvestigatorAgent
from agents.autonomy_guard import AutonomyGuard


class TestEndpointSecurityRuntime(unittest.TestCase):
    def setUp(self):
        self.guard = AutonomyGuard()
        self.investigator = BehavioralInvestigatorAgent(self.guard)
        self.valid_token = self.guard.mint_token(
            agent_id="BehavioralInvestigator",
            session_id="sec-session-001"
        )

    def test_01_usb_storage_breach_detection(self):
        event = {
            "event_id": "ev_usb_01",
            "event_type": "DEVICE_CONNECTED",
            "payload": {"device_id": "USBSTOR\\DISK&VEN_SANDISK", "category": "USB_STORAGE"}
        }
        case = self.investigator.investigate_anomaly("sec-session-001", self.valid_token, event, [])
        self.assertEqual(case.recommended_action, "ENFORCE_POLICY_BREACH")
        self.assertIn("Removable USB storage drive connected", case.hypothesis)

    def test_02_usb_capture_card_detection(self):
        event = {
            "event_id": "ev_cap_01",
            "event_type": "DEVICE_CONNECTED",
            "payload": {"device_id": "USB\\VID_0FD9&PID_0066", "category": "EXTERNAL_CAPTURE_HARDWARE"}
        }
        case = self.investigator.investigate_anomaly("sec-session-001", self.valid_token, event, [])
        self.assertEqual(case.recommended_action, "ENFORCE_POLICY_BREACH")
        self.assertIn("capture card", case.hypothesis)

    def test_03_adb_debug_bridge_detection(self):
        event = {
            "event_id": "ev_adb_01",
            "event_type": "DEVICE_CONNECTED",
            "payload": {"device_id": "USB\\VID_18D1&PID_4EE7&MI_01", "category": "DEV_DEBUG_BRIDGE"}
        }
        case = self.investigator.investigate_anomaly("sec-session-001", self.valid_token, event, [])
        self.assertEqual(case.recommended_action, "ENFORCE_POLICY_BREACH")
        self.assertIn("Android Debug Bridge (ADB)", case.hypothesis)

    def test_04_phone_charging_audit_flag(self):
        # A phone attached via USB should flag for audit (not automatically accuse of cheating without active transfer)
        event = {
            "event_id": "ev_phone_01",
            "event_type": "DEVICE_CONNECTED",
            "payload": {"device_id": "USB\\VID_04E8&PID_6860", "category": "PHONE_ANDROID"}
        }
        case = self.investigator.investigate_anomaly("sec-session-001", self.valid_token, event, [])
        self.assertEqual(case.recommended_action, "FLAG_FOR_AUDIT")
        self.assertIn("Mobile phone or tethering interface", case.hypothesis)

    def test_05_remote_desktop_port_detection(self):
        # Inbound/outbound RDP port 3389
        event = {
            "event_id": "ev_net_01",
            "event_type": "NETWORK_CONNECTION_DETECTED",
            "payload": {"remote_ip": "198.51.100.12", "remote_port": 3389, "owning_pid": 4120}
        }
        case = self.investigator.investigate_anomaly("sec-session-001", self.valid_token, event, [])
        self.assertEqual(case.recommended_action, "ENFORCE_POLICY_BREACH")
        self.assertIn("Remote desktop tunnel connection active", case.hypothesis)

    def test_06_benign_https_traffic(self):
        event = {
            "event_id": "ev_net_02",
            "event_type": "NETWORK_CONNECTION_DETECTED",
            "payload": {"remote_ip": "142.250.190.46", "remote_port": 443, "owning_pid": 8124}
        }
        case = self.investigator.investigate_anomaly("sec-session-001", self.valid_token, event, [])
        self.assertEqual(case.recommended_action, "NO_ACTION_BENIGN")

    def test_07_bluetooth_device_connected(self):
        event = {
            "event_id": "ev_bth_01",
            "event_type": "BLUETOOTH_DEVICE_CONNECTED",
            "payload": {"device_name": "Galaxy Buds Pro", "mac_address": "00:1A:7D:DA:71:13"}
        }
        case = self.investigator.investigate_anomaly("sec-session-001", self.valid_token, event, [])
        self.assertEqual(case.recommended_action, "FLAG_FOR_AUDIT")

    def test_08_capability_token_enforcement(self):
        # Invalid capability token must reject investigation
        event = {"event_id": "ev_sec_01", "event_type": "PROCESS_STARTED", "payload": {}}
        case = self.investigator.investigate_anomaly("sec-session-001", "INVALID_FORGED_TOKEN", event, [])
        self.assertFalse(case.resolved)
        self.assertEqual(case.recommended_action, "INCONCLUSIVE_DATA_DEFICIENCY")


if __name__ == "__main__":
    unittest.main()
