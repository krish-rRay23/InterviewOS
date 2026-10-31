package ioep

import (
	"fmt"
	"testing"
	"time"
)

func TestCanonicalJSON(t *testing.T) {
	// Keys in arbitrary order
	m1 := map[string]interface{}{
		"z_key": "last",
		"a_key": "first",
		"m_key": map[string]interface{}{
			"nested_2": 2,
			"nested_1": 1,
		},
	}
	m2 := map[string]interface{}{
		"a_key": "first",
		"m_key": map[string]interface{}{
			"nested_1": 1,
			"nested_2": 2,
		},
		"z_key": "last",
	}

	b1, err := CanonicalJSON(m1)
	if err != nil {
		t.Fatalf("CanonicalJSON m1 failed: %v", err)
	}
	b2, err := CanonicalJSON(m2)
	if err != nil {
		t.Fatalf("CanonicalJSON m2 failed: %v", err)
	}

	if string(b1) != string(b2) {
		t.Errorf("CanonicalJSON output mismatch:\nb1: %s\nb2: %s", string(b1), string(b2))
	}

	expected := `{"a_key":"first","m_key":{"nested_1":1,"nested_2":2},"z_key":"last"}`
	if string(b1) != expected {
		t.Errorf("Expected %s, got %s", expected, string(b1))
	}
}

func TestEndToEndIOEPBatchVerification(t *testing.T) {
	priv, pubPEM, err := GenerateP256KeyPair()
	if err != nil {
		t.Fatalf("GenerateP256KeyPair failed: %v", err)
	}
	pub, err := ParseECDSAPublicKey(pubPEM)
	if err != nil {
		t.Fatalf("ParseECDSAPublicKey failed: %v", err)
	}

	sessionID := "11111111-2222-3333-4444-555555555555"
	assessmentID := "aaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
	genesis := GenesisHash(sessionID)

	// Build 3 chained events
	events := make([]SessionEvent, 3)
	eventHashes := make([]string, 3)
	prevHash := genesis

	for i := 0; i < 3; i++ {
		seq := int64(i + 1)
		payload := map[string]interface{}{
			"pid":  1000 + i,
			"name": fmt.Sprintf("test_process_%d.exe", i),
		}
		currHash, err := ComputeEventHash(sessionID, seq, prevHash, payload)
		if err != nil {
			t.Fatalf("ComputeEventHash failed: %v", err)
		}

		events[i] = SessionEvent{
			EventID:              fmt.Sprintf("evt-00%d", i+1),
			SessionID:            sessionID,
			AssessmentID:         assessmentID,
			SchemaVersion:        "1.0",
			Sequence:             seq,
			EventType:            EventTypeProcessStarted,
			ClientTimeUTC:        time.Now().UTC(),
			MonotonicTimestampNS: int64(1000000 * (i + 1)),
			SourceCollector:      CollectorProcess,
			CollectorVersion:     "1.0.0",
			PolicyVersion:        1,
			Payload:              payload,
			PreviousEventHash:    prevHash,
			CurrentEventHash:     currHash,
		}
		eventHashes[i] = currHash
		prevHash = currHash
	}

	// Compute Merkle Root
	merkleRoot, err := ComputeMerkleRoot(eventHashes)
	if err != nil {
		t.Fatalf("ComputeMerkleRoot failed: %v", err)
	}

	// Sign Checkpoint
	sig, err := SignBatchCheckpoint(priv, sessionID, 1, 3, merkleRoot, genesis)
	if err != nil {
		t.Fatalf("SignBatchCheckpoint failed: %v", err)
	}

	batch := &SignedEvidenceBatch{
		BatchID:           "batch-001",
		SessionID:         sessionID,
		SequenceStart:     1,
		SequenceEnd:       3,
		EventCount:        3,
		MerkleRoot:        merkleRoot,
		PreviousBatchHash: genesis,
		CreatedAtUTC:      time.Now().UTC(),
		Signature:         sig,
		Events:            events,
	}

	// 1. Verify valid batch
	res := VerifyBatch(pub, batch, 0, genesis)
	if res.TrustStatus != TrustStatusVerified {
		t.Fatalf("Expected VERIFIED, got %s: %v", res.TrustStatus, res.ErrorDetails)
	}
	if !res.SignatureValid || !res.HashChainValid || !res.MerkleRootValid || !res.SequenceContinuous {
		t.Errorf("Validation flags incomplete: %+v", res)
	}

	// 2. Tamper Test: Modify event payload in transit
	tamperedBatch := *batch
	tamperedEvents := make([]SessionEvent, len(events))
	copy(tamperedEvents, events)
	tamperedEvents[1].Payload = map[string]interface{}{"pid": 9999, "name": "malicious.exe"}
	tamperedBatch.Events = tamperedEvents

	resTampered := VerifyBatch(pub, &tamperedBatch, 0, genesis)
	if resTampered.TrustStatus != TrustStatusHashChainBroken {
		t.Errorf("Expected HASH_CHAIN_BROKEN on payload modification, got: %s", resTampered.TrustStatus)
	}

	// 3. Tamper Test: Forged signature
	forgedBatch := *batch
	forgedBatch.Signature = "AAAA" + batch.Signature[4:]
	resForged := VerifyBatch(pub, &forgedBatch, 0, genesis)
	if resForged.TrustStatus != TrustStatusSignatureInvalid {
		t.Errorf("Expected SIGNATURE_INVALID on forged signature, got: %s", resForged.TrustStatus)
	}

	// 4. Tamper Test: Merkle root mismatch
	merkleTamperedBatch := *batch
	merkleTamperedBatch.MerkleRoot = "0000000000000000000000000000000000000000000000000000000000000000"
	resMerkle := VerifyBatch(pub, &merkleTamperedBatch, 0, genesis)
	if resMerkle.TrustStatus != TrustStatusMerkleMismatch {
		t.Errorf("Expected MERKLE_MISMATCH on modified root, got: %s", resMerkle.TrustStatus)
	}
}

