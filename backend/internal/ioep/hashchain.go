package ioep

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
)

// GenesisHash computes H_0 for a session
func GenesisHash(sessionID string) string {
	h := sha256.New()
	h.Write([]byte("IOEP-CHAIN-GENESIS:"))
	h.Write([]byte(sessionID))
	return hex.EncodeToString(h.Sum(nil))
}

// ComputeEventHash computes H_i for an event based on H_{i-1} and canonical payload
func ComputeEventHash(sessionID string, sequence int64, prevHash string, payload map[string]interface{}) (string, error) {
	canonicalPayload, err := CanonicalJSON(payload)
	if err != nil {
		return "", fmt.Errorf("failed to canonicalize payload: %w", err)
	}

	h := sha256.New()
	h.Write([]byte("IOEP-EVENT-V1:"))
	h.Write([]byte(sessionID))
	h.Write([]byte(":"))
	h.Write([]byte(strconv.FormatInt(sequence, 10)))
	h.Write([]byte(":"))
	h.Write([]byte(prevHash))
	h.Write([]byte(":"))
	h.Write(canonicalPayload)

	return hex.EncodeToString(h.Sum(nil)), nil
}

// VerifyEventHash verifies whether current_event_hash matches the computed H_i
func VerifyEventHash(evt *SessionEvent, expectedPrevHash string) (bool, error) {
	if evt.PreviousEventHash != expectedPrevHash {
		return false, fmt.Errorf("previous hash mismatch: expected %s, got %s", expectedPrevHash, evt.PreviousEventHash)
	}

	computed, err := ComputeEventHash(evt.SessionID, evt.Sequence, evt.PreviousEventHash, evt.Payload)
	if err != nil {
		return false, err
	}

	if computed != evt.CurrentEventHash {
		return false, fmt.Errorf("current hash mismatch: computed %s, got %s", computed, evt.CurrentEventHash)
	}

	return true, nil
}

