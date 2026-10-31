package ioep

import (
	"time"
)

// EventType defines valid IOEP event types
type EventType string

const (
	EventTypeProcessStarted         EventType = "PROCESS_STARTED"
	EventTypeProcessTerminated      EventType = "PROCESS_TERMINATED"
	EventTypeDeviceConnected        EventType = "DEVICE_CONNECTED"
	EventTypeDeviceDisconnected     EventType = "DEVICE_DISCONNECTED"
	EventTypeDisplayTopologyChanged EventType = "DISPLAY_TOPOLOGY_CHANGED"
	EventTypeNetworkInterfaceChanged EventType = "NETWORK_INTERFACE_CHANGED"
	EventTypeRemoteSessionChanged   EventType = "REMOTE_SESSION_STATE_CHANGED"
	EventTypeVirtualizationDetected EventType = "VIRTUALIZATION_INDICATOR_DETECTED"
	EventTypeCollectorHealth        EventType = "COLLECTOR_HEALTH_REPORTED"
	EventTypeHeartbeat              EventType = "HEARTBEAT"
)

// CollectorType represents the originating collector
type CollectorType string

const (
	CollectorProcess       CollectorType = "PROCESS_COLLECTOR"
	CollectorDevice        CollectorType = "DEVICE_COLLECTOR"
	CollectorDisplay       CollectorType = "DISPLAY_COLLECTOR"
	CollectorNetwork       CollectorType = "NETWORK_COLLECTOR"
	CollectorRemoteSession CollectorType = "REMOTE_SESSION_COLLECTOR"
	CollectorVirtualization CollectorType = "VIRTUALIZATION_COLLECTOR"
	CollectorHealth        CollectorType = "HEALTH_COLLECTOR"
)

// SessionEvent represents a single immutable observed endpoint event
type SessionEvent struct {
	EventID              string                 `json:"event_id"`
	SessionID            string                 `json:"session_id"`
	AssessmentID         string                 `json:"assessment_id"`
	SchemaVersion        string                 `json:"schema_version"`
	Sequence             int64                  `json:"sequence"`
	EventType            EventType              `json:"event_type"`
	ClientTimeUTC        time.Time              `json:"client_time_utc"`
	MonotonicTimestampNS int64                  `json:"monotonic_timestamp_ns"`
	ServerReceiptTimeUTC *time.Time             `json:"server_receipt_time_utc,omitempty"`
	SourceCollector      CollectorType          `json:"source_collector"`
	CollectorVersion     string                 `json:"collector_version"`
	PolicyVersion        int                    `json:"policy_version"`
	Payload              map[string]interface{} `json:"payload"`
	PreviousEventHash    string                 `json:"previous_event_hash"`
	CurrentEventHash     string                 `json:"current_event_hash"`
}

// SignedEvidenceBatch represents an authenticated batch of events with a Merkle checkpoint
type SignedEvidenceBatch struct {
	BatchID           string         `json:"batch_id"`
	SessionID         string         `json:"session_id"`
	SequenceStart     int64          `json:"sequence_start"`
	SequenceEnd       int64          `json:"sequence_end"`
	EventCount        int            `json:"event_count"`
	MerkleRoot        string         `json:"merkle_root"`
	PreviousBatchHash string         `json:"previous_batch_hash"`
	CreatedAtUTC      time.Time      `json:"created_at_utc"`
	Signature         string         `json:"signature"`
	KeyID             string         `json:"key_id,omitempty"`
	Events            []SessionEvent `json:"events"`
}

// KeyProtectionType indicates hardware vs software assurance
type KeyProtectionType string

const (
	KeyProtectionTPM             KeyProtectionType = "HARDWARE_TPM"
	KeyProtectionSoftwareDPAPI   KeyProtectionType = "SOFTWARE_CNG_DPAPI"
	KeyProtectionEphemeralTest   KeyProtectionType = "EPHEMERAL_TEST"
)

// SessionEnrollmentRecord represents initial device enrollment
type SessionEnrollmentRecord struct {
	SessionID               string            `json:"session_id"`
	CandidateID             string            `json:"candidate_id"`
	AssessmentID            string            `json:"assessment_id"`
	PublicKeyPEM            string            `json:"public_key_pem"`
	KeyAlgorithm            string            `json:"key_algorithm"`
	KeyProtectionType       KeyProtectionType `json:"key_protection_type"`
	TPMAttestationStatement *string           `json:"tpm_attestation_statement,omitempty"`
	ClientNonce             string            `json:"client_nonce"`
	ServerChallengeNonce    string            `json:"server_challenge_nonce"`
	ChallengeSignature      string            `json:"challenge_signature"`
	OSVersion               string            `json:"os_version"`
	AgentVersion            string            `json:"agent_version"`
	EnrolledAtUTC           time.Time         `json:"enrolled_at_utc"`
}

// TrustStatus represents cryptographic batch verification outcome
type TrustStatus string

const (
	TrustStatusVerified        TrustStatus = "VERIFIED"
	TrustStatusSignatureInvalid TrustStatus = "SIGNATURE_INVALID"
	TrustStatusHashChainBroken TrustStatus = "HASH_CHAIN_BROKEN"
	TrustStatusMerkleMismatch  TrustStatus = "MERKLE_MISMATCH"
	TrustStatusSequenceGap     TrustStatus = "SEQUENCE_GAP"
	TrustStatusReplayAttack    TrustStatus = "REPLAY_ATTACK"
	TrustStatusUnregisteredKey TrustStatus = "UNREGISTERED_KEY"
)

// EvidenceVerificationResult contains verification details
type EvidenceVerificationResult struct {
	BatchID            string      `json:"batch_id"`
	SessionID          string      `json:"session_id"`
	SequenceStart      int64       `json:"sequence_start"`
	SequenceEnd        int64       `json:"sequence_end"`
	SignatureValid     bool        `json:"signature_valid"`
	HashChainValid     bool        `json:"hash_chain_valid"`
	MerkleRootValid    bool        `json:"merkle_root_valid"`
	SequenceContinuous bool        `json:"sequence_continuous"`
	ReplayDetected     bool        `json:"replay_detected"`
	TrustStatus        TrustStatus `json:"trust_status"`
	ErrorDetails       *string     `json:"error_details,omitempty"`
	VerifiedAtUTC      time.Time   `json:"verified_at_utc"`
}

