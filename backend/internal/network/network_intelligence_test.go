package network

import (
	"net"
	"testing"
	"time"
)

func TestDefaultEndpointOnlyVisibility(t *testing.T) {
	coord := NewManagedNetworkCoordinator()
	fallback := NewDefaultEndpointOnlyProvider()
	coord.RegisterProvider("default", fallback)

	scope := coord.GetSessionVisibilityScope("session-test-01")
	if scope != VisibilityEndpointOnly {
		t.Fatalf("expected scope %s, got %s", VisibilityEndpointOnly, scope)
	}

	suspicious, reason := coord.CorrelateEndpointObservation("session-test-01", net.ParseIP("192.168.1.50"))
	if suspicious {
		t.Fatalf("expected false on unmanaged session, got true")
	}
	if reason == "" {
		t.Fatalf("expected explanatory reason regarding ENDPOINT_ONLY_VISIBILITY limitation")
	}
}

func TestAuthenticatedNetworkBindingCorrelation(t *testing.T) {
	coord := NewManagedNetworkCoordinator()

	binding := DeviceNetworkBinding{
		SessionID:       "session-lab-101",
		CandidateID:     "candidate-99",
		AuthenticatedIP: net.ParseIP("10.0.4.15"),
		MacAddress:      "AA:BB:CC:DD:EE:01",
		APLocation:      "ExamHall-A-AP03",
		SSID:            "InterviewOS-SecureExam",
		LeaseExpiresAt:  time.Now().Add(3 * time.Hour),
		VlanID:          40,
	}
	coord.BindSessionToDevice(binding)

	scope := coord.GetSessionVisibilityScope("session-lab-101")
	if scope != VisibilityRadiusSession {
		t.Fatalf("expected scope %s, got %s", VisibilityRadiusSession, scope)
	}

	// Lateral internal connection to another exam machine
	suspicious, reason := coord.CorrelateEndpointObservation("session-lab-101", net.ParseIP("10.0.4.88"))
	if !suspicious {
		t.Fatalf("expected lateral LAN connection on exam VLAN to be flagged, got false")
	}
	if reason == "" {
		t.Fatalf("expected explanatory correlation reason")
	}
}
