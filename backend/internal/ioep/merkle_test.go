package ioep

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
)

func TestRFC9162MerkleRootAndInclusionProof(t *testing.T) {
	// Generate 7 event hashes (testing non-power-of-2 balancing per RFC 9162)
	numEvents := 7
	eventHashes := make([]string, numEvents)
	for i := 0; i < numEvents; i++ {
		h := sha256.Sum256([]byte(fmt.Sprintf("event-payload-data-%d", i)))
		eventHashes[i] = hex.EncodeToString(h[:])
	}

	root, err := ComputeMerkleRoot(eventHashes)
	if err != nil {
		t.Fatalf("ComputeMerkleRoot failed: %v", err)
	}
	if len(root) != 64 {
		t.Fatalf("Expected 64-char hex root, got %s", root)
	}

	// Verify inclusion proof for each leaf in the tree
	for i := 0; i < numEvents; i++ {
		proof, err := GenerateInclusionProof(eventHashes, i)
		if err != nil {
			t.Fatalf("GenerateInclusionProof failed for index %d: %v", i, err)
		}
		if len(proof) == 0 {
			t.Fatalf("Expected non-empty proof for leaf %d", i)
		}

		valid, err := VerifyInclusionProof(eventHashes[i], proof, root)
		if err != nil {
			t.Fatalf("VerifyInclusionProof returned error for leaf %d: %v", i, err)
		}
		if !valid {
			t.Errorf("Inclusion proof failed verification for leaf %d", i)
		}

		// Negative test: Tampering with leaf hash must fail verification
		tamperedLeaf := hex.EncodeToString(sha256.New().Sum([]byte("tampered")))
		validTampered, _ := VerifyInclusionProof(tamperedLeaf, proof, root)
		if validTampered {
			t.Errorf("Tampered leaf unexpectedly passed verification for leaf %d", i)
		}

		// Negative test: Tampering with sibling proof must fail verification
		tamperedProof := make([]InclusionProofStep, len(proof))
		copy(tamperedProof, proof)
		tamperedProof[0].Hash = hex.EncodeToString(sha256.New().Sum([]byte("tampered-sibling")))
		validTamperedProof, _ := VerifyInclusionProof(eventHashes[i], tamperedProof, root)
		if validTamperedProof {
			t.Errorf("Tampered proof step unexpectedly passed verification for leaf %d", i)
		}
	}
}

func TestRFC9162DomainSeparation(t *testing.T) {
	data := []byte("sample-event-data")
	leaf := HashLeaf(data)
	node := HashNode(data, data)

	// Leaf prefix (0x00) vs Node prefix (0x01) must prevent second-preimage confusion
	if hex.EncodeToString(leaf) == hex.EncodeToString(node) {
		t.Errorf("Domain separation collision detected between leaf and node hash!")
	}
}
