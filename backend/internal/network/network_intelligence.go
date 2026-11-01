package network

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"
)

// NetworkVisibilityScope distinguishes local endpoint visibility from managed network intelligence
type NetworkVisibilityScope string

const (
	VisibilityEndpointOnly  NetworkVisibilityScope = "ENDPOINT_ONLY_VISIBILITY"
	VisibilityManagedLan    NetworkVisibilityScope = "MANAGED_LAN_INTELLIGENCE"
	VisibilityRadiusSession NetworkVisibilityScope = "AUTHENTICATED_RADIUS_SESSION"
)

// DeviceNetworkBinding represents an authenticated mapping between a candidate and an IP/MAC address
type DeviceNetworkBinding struct {
	SessionID       string    `json:"session_id"`
	CandidateID     string    `json:"candidate_id"`
	AuthenticatedIP net.IP    `json:"authenticated_ip"`
	MacAddress      string    `json:"mac_address"`
	APLocation      string    `json:"ap_location"`
	SSID            string    `json:"ssid"`
	LeaseExpiresAt  time.Time `json:"lease_expires_at"`
	VlanID          int       `json:"vlan_id"`
}

// NetworkTelemetryEvent represents an event received from an infrastructure sensor (AP, DHCP, RADIUS, Firewall)
type NetworkTelemetryEvent struct {
	EventID       string                 `json:"event_id"`
	ProviderType  string                 `json:"provider_type"` // "DHCP", "RADIUS", "WIFI_CONTROLLER", "FLOW"
	Timestamp     time.Time              `json:"timestamp"`
	ObservedIP    net.IP                 `json:"observed_ip"`
	ObservedMAC   string                 `json:"observed_mac"`
	AssociatedAP  string                 `json:"associated_ap,omitempty"`
	BytesTx       uint64                 `json:"bytes_tx,omitempty"`
	BytesRx       uint64                 `json:"bytes_rx,omitempty"`
	Details       map[string]interface{} `json:"details"`
}

// NetworkSensorProvider defines the standard interface for external enterprise network sources
type NetworkSensorProvider interface {
	GetProviderName() string
	GetVisibilityScope() NetworkVisibilityScope
	SubscribeEvents(ctx context.Context, ch chan<- NetworkTelemetryEvent) error
	LookupCandidateBinding(ctx context.Context, sessionID string) (*DeviceNetworkBinding, error)
}

// DefaultEndpointOnlyProvider reports honest limitation when no enterprise network sensor is configured
type DefaultEndpointOnlyProvider struct{}

func NewDefaultEndpointOnlyProvider() *DefaultEndpointOnlyProvider {
	return &DefaultEndpointOnlyProvider{}
}

func (p *DefaultEndpointOnlyProvider) GetProviderName() string {
	return "EndpointOnlyFallbackSensor"
}

func (p *DefaultEndpointOnlyProvider) GetVisibilityScope() NetworkVisibilityScope {
	return VisibilityEndpointOnly
}

func (p *DefaultEndpointOnlyProvider) SubscribeEvents(ctx context.Context, ch chan<- NetworkTelemetryEvent) error {
	// No enterprise network events without external provider integration
	return nil
}

func (p *DefaultEndpointOnlyProvider) LookupCandidateBinding(ctx context.Context, sessionID string) (*DeviceNetworkBinding, error) {
	return nil, fmt.Errorf("no managed network provider configured: scope is %s", VisibilityEndpointOnly)
}

// ManagedNetworkCoordinator aggregates network sensors and correlates with assessment sessions
type ManagedNetworkCoordinator struct {
	mu        sync.RWMutex
	providers map[string]NetworkSensorProvider
	bindings  map[string]DeviceNetworkBinding // sessionID -> binding
}

func NewManagedNetworkCoordinator() *ManagedNetworkCoordinator {
	return &ManagedNetworkCoordinator{
		providers: make(map[string]NetworkSensorProvider),
		bindings:  make(map[string]DeviceNetworkBinding),
	}
}

func (c *ManagedNetworkCoordinator) RegisterProvider(name string, provider NetworkSensorProvider) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.providers[name] = provider
}

func (c *ManagedNetworkCoordinator) BindSessionToDevice(binding DeviceNetworkBinding) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.bindings[binding.SessionID] = binding
}

func (c *ManagedNetworkCoordinator) GetSessionVisibilityScope(sessionID string) NetworkVisibilityScope {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if _, exists := c.bindings[sessionID]; exists {
		return VisibilityRadiusSession
	}

	for _, p := range c.providers {
		if p.GetVisibilityScope() != VisibilityEndpointOnly {
			return p.GetVisibilityScope()
		}
	}

	return VisibilityEndpointOnly
}

func (c *ManagedNetworkCoordinator) CorrelateEndpointObservation(sessionID string, observedRemoteIP net.IP) (isCorroboratedSuspicious bool, reason string) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	binding, hasBinding := c.bindings[sessionID]
	if !hasBinding {
		// When no network binding exists, never fabricate certainty
		return false, fmt.Sprintf("Correlation unavailable: %s (remote IP %s observed on host, external network controller not present)", VisibilityEndpointOnly, observedRemoteIP.String())
	}

	// Example: Candidate is authenticated on specific VLAN/AP. If candidate laptop establishes direct TCP connection
	// to another internal IP on the same restricted exam VLAN (e.g. peer machine), flag for investigation.
	if observedRemoteIP.IsPrivate() && !observedRemoteIP.Equal(binding.AuthenticatedIP) {
		return true, fmt.Sprintf("Suspicious lateral LAN communication: Candidate laptop (%s on %s) established connection to internal exam LAN address %s",
			binding.AuthenticatedIP.String(), binding.APLocation, observedRemoteIP.String())
	}

	return false, "Connection is external or benign"
}
