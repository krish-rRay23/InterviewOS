package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/interviewos/interviewos/backend/internal/ioep"
	"github.com/interviewos/interviewos/backend/internal/store"
)

func TestEndToEndAPIWorkflow(t *testing.T) {
	st := store.NewMemoryStore()
	handler := NewAPIHandler(st)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 1. Create Organization
	orgReq := map[string]string{"name": "Acme Assessments", "slug": "acme-corp"}
	body, _ := json.Marshal(orgReq)
	req := httptest.NewRequest("POST", "/v1/organizations", bytes.NewReader(body))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateOrganization failed: %d: %s", w.Code, w.Body.String())
	}
	var org store.Organization
	_ = json.Unmarshal(w.Body.Bytes(), &org)

	// 2. Create Assessment
	asmtReq := map[string]string{
		"organization_id": org.ID,
		"title":           "Backend Engineer Assessment",
		"mode":            "AI_PROHIBITED",
	}
	body, _ = json.Marshal(asmtReq)
	req = httptest.NewRequest("POST", "/v1/assessments", bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateAssessment failed: %d", w.Code)
	}
	var asmt store.Assessment
	_ = json.Unmarshal(w.Body.Bytes(), &asmt)

	// 3. Save Policy
	polReq := store.AssessmentPolicy{
		Version:                1,
		MaxDisplays:            1,
		AllowExternalIDE:       false,
		AllowUSBStorage:        false,
		StrictETW:              true,
		ProhibitedProcessNames: []string{"anydesk.exe", "teamviewer.exe"},
		PermittedProcessNames:  []string{"code.exe"},
		InvestigationBudgetUSD: 5.0,
		MaxAgentToolCalls:      25,
	}
	body, _ = json.Marshal(polReq)
	req = httptest.NewRequest("POST", fmt.Sprintf("/v1/assessments/%s/policies", asmt.ID), bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("SavePolicy failed: %d", w.Code)
	}

	// 4. Create Candidate
	candReq := map[string]string{
		"organization_id": org.ID,
		"full_name":       "Alice Smith",
		"email":           "alice@example.com",
	}
	body, _ = json.Marshal(candReq)
	req = httptest.NewRequest("POST", "/v1/candidates", bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateCandidate failed: %d", w.Code)
	}
	var cand store.Candidate
	_ = json.Unmarshal(w.Body.Bytes(), &cand)

	// 5. Create Session
	sessReq := map[string]string{
		"assessment_id": asmt.ID,
		"candidate_id":  cand.ID,
	}
	body, _ = json.Marshal(sessReq)
	req = httptest.NewRequest("POST", "/v1/sessions", bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateSession failed: %d", w.Code)
	}
	var sess store.Session
	_ = json.Unmarshal(w.Body.Bytes(), &sess)

	// 6. Get Challenge
	req = httptest.NewRequest("POST", fmt.Sprintf("/v1/sessions/%s/challenge", sess.ID), nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetChallenge failed: %d", w.Code)
	}
	var chal store.SessionChallenge
	_ = json.Unmarshal(w.Body.Bytes(), &chal)

	// 7. Client Keygen & Enroll
	priv, pubPEM, err := ioep.GenerateP256KeyPair()
	if err != nil {
		t.Fatalf("GenerateP256KeyPair failed: %v", err)
	}
	clientNonce := store.GenerateNonce(16)
	chalSig, err := ioep.SignEnrollmentChallenge(priv, sess.ID, cand.ID, chal.ServerNonce, clientNonce)
	if err != nil {
		t.Fatalf("SignEnrollmentChallenge failed: %v", err)
	}

	enrollPayload := ioep.SessionEnrollmentRecord{
		SessionID:            sess.ID,
		CandidateID:          cand.ID,
		AssessmentID:         asmt.ID,
		PublicKeyPEM:         pubPEM,
		KeyAlgorithm:         "ECDSA_P256_SHA256",
		KeyProtectionType:    ioep.KeyProtectionSoftwareDPAPI,
		ClientNonce:          clientNonce,
		ServerChallengeNonce: chal.ServerNonce,
		ChallengeSignature:   chalSig,
		OSVersion:            "Windows 11 Build 22631",
		AgentVersion:         "1.0.0",
		EnrolledAtUTC:        time.Now().UTC(),
	}
	body, _ = json.Marshal(enrollPayload)
	req = httptest.NewRequest("POST", fmt.Sprintf("/v1/sessions/%s/enroll", sess.ID), bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("EnrollSession failed: %d: %s", w.Code, w.Body.String())
	}

	// 8. Generate and Ingest Valid Signed Batch
	genesis := ioep.GenesisHash(sess.ID)
	events := make([]ioep.SessionEvent, 2)
	eventHashes := make([]string, 2)
	prevHash := genesis

	for i := 0; i < 2; i++ {
		seq := int64(i + 1)
		payload := map[string]interface{}{"name": "code.exe", "pid": 5000 + i}
		currHash, _ := ioep.ComputeEventHash(sess.ID, seq, prevHash, payload)
		events[i] = ioep.SessionEvent{
			EventID:              fmt.Sprintf("evt-batch1-%d", i),
			SessionID:            sess.ID,
			AssessmentID:         asmt.ID,
			SchemaVersion:        "1.0",
			Sequence:             seq,
			EventType:            ioep.EventTypeProcessStarted,
			ClientTimeUTC:        time.Now().UTC(),
			MonotonicTimestampNS: int64(1000 * (i + 1)),
			SourceCollector:      ioep.CollectorProcess,
			CollectorVersion:     "1.0.0",
			PolicyVersion:        1,
			Payload:              payload,
			PreviousEventHash:    prevHash,
			CurrentEventHash:     currHash,
		}
		eventHashes[i] = currHash
		prevHash = currHash
	}

	merkleRoot, _ := ioep.ComputeMerkleRoot(eventHashes)
	batchSig, _ := ioep.SignBatchCheckpoint(priv, sess.ID, 1, 2, merkleRoot, genesis)

	batch := ioep.SignedEvidenceBatch{
		BatchID:           "batch-valid-01",
		SessionID:         sess.ID,
		SequenceStart:     1,
		SequenceEnd:       2,
		EventCount:        2,
		MerkleRoot:        merkleRoot,
		PreviousBatchHash: genesis,
		CreatedAtUTC:      time.Now().UTC(),
		Signature:         batchSig,
		Events:            events,
	}

	body, _ = json.Marshal(batch)
	req = httptest.NewRequest("POST", fmt.Sprintf("/v1/sessions/%s/batches", sess.ID), bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusAccepted {
		t.Fatalf("IngestBatch failed: %d: %s", w.Code, w.Body.String())
	}

	// 9. Tamper Detection Test
	tamperedBatch := batch
	tamperedBatch.BatchID = "batch-tampered-02"
	tamperedBatch.Signature = "INVALID_SIG"
	body, _ = json.Marshal(tamperedBatch)
	req = httptest.NewRequest("POST", fmt.Sprintf("/v1/sessions/%s/batches", sess.ID), bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("Expected 422 for tampered signature, got %d", w.Code)
	}

	// 10. Close Session and check report
	req = httptest.NewRequest("POST", fmt.Sprintf("/v1/sessions/%s/close", sess.ID), nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("CloseSession failed: %d", w.Code)
	}

	// 11. Fetch Final Report
	req = httptest.NewRequest("GET", fmt.Sprintf("/v1/sessions/%s/report", sess.ID), nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetReport failed: %d", w.Code)
	}
	var rep map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &rep)
	if rep["integrity_state"] != "VERIFIED" {
		t.Errorf("Expected VERIFIED integrity state, got %v", rep["integrity_state"])
	}
	if rep["total_events"].(float64) != 2 {
		t.Errorf("Expected 2 total events, got %v", rep["total_events"])
	}
}
