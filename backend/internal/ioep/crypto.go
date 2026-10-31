package ioep

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"time"
)

type ecdsaSignature struct {
	R, S *big.Int
}

// GenerateP256KeyPair creates a fresh NIST P-256 key pair
func GenerateP256KeyPair() (*ecdsa.PrivateKey, string, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, "", err
	}

	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return nil, "", err
	}

	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubBytes,
	})

	return priv, string(pubPEM), nil
}

// ParseECDSAPublicKey parses an ECDSA public key from PEM format
func ParseECDSAPublicKey(pemStr string) (*ecdsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("failed to decode PEM block containing public key")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PKIX public key: %w", err)
	}

	ecPub, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("public key is not an ECDSA public key")
	}

	return ecPub, nil
}

// CheckpointMessageToSign constructs the deterministic canonical byte string signed for a batch
func CheckpointMessageToSign(sessionID string, seqStart, seqEnd int64, merkleRoot, prevBatchHash string) []byte {
	return []byte(fmt.Sprintf("IOEP-CHECKPOINT-V1:%s:%d:%d:%s:%s",
		sessionID, seqStart, seqEnd, merkleRoot, prevBatchHash))
}

// SignBatchCheckpoint signs the checkpoint digest using private key
func SignBatchCheckpoint(priv *ecdsa.PrivateKey, sessionID string, seqStart, seqEnd int64, merkleRoot, prevBatchHash string) (string, error) {
	msg := CheckpointMessageToSign(sessionID, seqStart, seqEnd, merkleRoot, prevBatchHash)
	h := sha256.Sum256(msg)

	r, s, err := ecdsa.Sign(rand.Reader, priv, h[:])
	if err != nil {
		return "", err
	}

	sigBytes, err := asn1.Marshal(ecdsaSignature{R: r, S: s})
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(sigBytes), nil
}

// VerifyBatchSignature verifies ECDSA signature over batch checkpoint
func VerifyBatchSignature(pub *ecdsa.PublicKey, sessionID string, seqStart, seqEnd int64, merkleRoot, prevBatchHash string, base64Sig string) (bool, error) {
	sigBytes, err := base64.StdEncoding.DecodeString(base64Sig)
	if err != nil {
		return false, fmt.Errorf("invalid base64 signature: %w", err)
	}

	var sig ecdsaSignature
	if _, err := asn1.Unmarshal(sigBytes, &sig); err != nil {
		return false, fmt.Errorf("invalid ASN.1 signature: %w", err)
	}

	msg := CheckpointMessageToSign(sessionID, seqStart, seqEnd, merkleRoot, prevBatchHash)
	h := sha256.Sum256(msg)

	valid := ecdsa.Verify(pub, h[:], sig.R, sig.S)
	return valid, nil
}

// SignEnrollmentChallenge signs server challenge nonce during enrollment
func SignEnrollmentChallenge(priv *ecdsa.PrivateKey, sessionID, candidateID, serverNonce, clientNonce string) (string, error) {
	msg := []byte(fmt.Sprintf("IOEP-ENROLL-CHALLENGE-V1:%s:%s:%s:%s", sessionID, candidateID, serverNonce, clientNonce))
	h := sha256.Sum256(msg)
	r, s, err := ecdsa.Sign(rand.Reader, priv, h[:])
	if err != nil {
		return "", err
	}
	sigBytes, err := asn1.Marshal(ecdsaSignature{R: r, S: s})
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sigBytes), nil
}

// VerifyEnrollmentChallenge verifies enrollment challenge signature
func VerifyEnrollmentChallenge(pub *ecdsa.PublicKey, sessionID, candidateID, serverNonce, clientNonce, base64Sig string) (bool, error) {
	sigBytes, err := base64.StdEncoding.DecodeString(base64Sig)
	if err != nil {
		return false, err
	}
	var sig ecdsaSignature
	if _, err := asn1.Unmarshal(sigBytes, &sig); err != nil {
		return false, err
	}
	msg := []byte(fmt.Sprintf("IOEP-ENROLL-CHALLENGE-V1:%s:%s:%s:%s", sessionID, candidateID, serverNonce, clientNonce))
	h := sha256.Sum256(msg)
	return ecdsa.Verify(pub, h[:], sig.R, sig.S), nil
}

// VerifyBatch validates an entire batch (signatures, hash chain, Merkle root, sequence continuity)
func VerifyBatch(pub *ecdsa.PublicKey, batch *SignedEvidenceBatch, expectedPrevSeq int64, expectedPrevHash string) EvidenceVerificationResult {
	res := EvidenceVerificationResult{
		BatchID:            batch.BatchID,
		SessionID:          batch.SessionID,
		SequenceStart:      batch.SequenceStart,
		SequenceEnd:        batch.SequenceEnd,
		VerifiedAtUTC:      timeNow(),
		SignatureValid:     false,
		HashChainValid:     false,
		MerkleRootValid:    false,
		SequenceContinuous: false,
		ReplayDetected:     false,
	}

	// 1. Check sequence continuity
	if expectedPrevSeq > 0 && batch.SequenceStart != expectedPrevSeq+1 {
		errStr := fmt.Sprintf("Sequence gap detected: expected %d, got %d", expectedPrevSeq+1, batch.SequenceStart)
		res.TrustStatus = TrustStatusSequenceGap
		res.ErrorDetails = &errStr
		return res
	}
	res.SequenceContinuous = true

	// 2. Check previous batch hash linkage
	if expectedPrevHash != "" && batch.PreviousBatchHash != expectedPrevHash {
		errStr := fmt.Sprintf("Previous batch hash mismatch: expected %s, got %s", expectedPrevHash, batch.PreviousBatchHash)
		res.TrustStatus = TrustStatusHashChainBroken
		res.ErrorDetails = &errStr
		return res
	}

	// 3. Verify event count matches sequence range
	expectedCount := int(batch.SequenceEnd - batch.SequenceStart + 1)
	if len(batch.Events) != expectedCount || batch.EventCount != expectedCount {
		errStr := fmt.Sprintf("Batch event count mismatch: range implies %d, got %d events", expectedCount, len(batch.Events))
		res.TrustStatus = TrustStatusSequenceGap
		res.ErrorDetails = &errStr
		return res
	}

	// 4. Verify each event in the hash chain
	eventHashes := make([]string, len(batch.Events))
	prevEvtHash := expectedPrevHash
	if prevEvtHash == "" {
		prevEvtHash = GenesisHash(batch.SessionID)
	}

	for i, evt := range batch.Events {
		expectedSeq := batch.SequenceStart + int64(i)
		if evt.Sequence != expectedSeq {
			errStr := fmt.Sprintf("Event sequence anomaly at index %d: expected %d, got %d", i, expectedSeq, evt.Sequence)
			res.TrustStatus = TrustStatusSequenceGap
			res.ErrorDetails = &errStr
			return res
		}

		validHash, err := VerifyEventHash(&evt, prevEvtHash)
		if !validHash || err != nil {
			errStr := fmt.Sprintf("Event hash verification failed at sequence %d: %v", evt.Sequence, err)
			res.TrustStatus = TrustStatusHashChainBroken
			res.ErrorDetails = &errStr
			return res
		}

		eventHashes[i] = evt.CurrentEventHash
		prevEvtHash = evt.CurrentEventHash
	}
	res.HashChainValid = true

	// 5. Verify Merkle root
	computedRoot, err := ComputeMerkleRoot(eventHashes)
	if err != nil || computedRoot != batch.MerkleRoot {
		errStr := fmt.Sprintf("Merkle root mismatch: computed %s, batch claims %s (err: %v)", computedRoot, batch.MerkleRoot, err)
		res.TrustStatus = TrustStatusMerkleMismatch
		res.ErrorDetails = &errStr
		return res
	}
	res.MerkleRootValid = true

	// 6. Verify signature over batch checkpoint
	sigValid, err := VerifyBatchSignature(pub, batch.SessionID, batch.SequenceStart, batch.SequenceEnd, batch.MerkleRoot, batch.PreviousBatchHash, batch.Signature)
	if !sigValid || err != nil {
		errStr := fmt.Sprintf("Signature verification failed: %v", err)
		res.TrustStatus = TrustStatusSignatureInvalid
		res.ErrorDetails = &errStr
		return res
	}
	res.SignatureValid = true

	res.TrustStatus = TrustStatusVerified
	return res
}

func timeNow() time.Time {
	return strconvTime()
}

func strconvTime() time.Time {
	// wrapper for testing consistency if needed
	return time.Now().UTC()
}
