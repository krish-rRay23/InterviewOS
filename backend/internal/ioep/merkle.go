package ioep

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
)

// RFC 9162 Domain Separation Constants
const (
	RFC9162LeafPrefix = 0x00
	RFC9162NodePrefix = 0x01
)

// HashLeaf computes the RFC 9162 leaf hash: SHA-256(0x00 || data)
func HashLeaf(data []byte) []byte {
	h := sha256.New()
	h.Write([]byte{RFC9162LeafPrefix})
	h.Write(data)
	return h.Sum(nil)
}

// HashNode computes the RFC 9162 internal node hash: SHA-256(0x01 || left || right)
func HashNode(left, right []byte) []byte {
	h := sha256.New()
	h.Write([]byte{RFC9162NodePrefix})
	h.Write(left)
	h.Write(right)
	return h.Sum(nil)
}

// largestPowerOf2LessThan returns the largest power of 2 strictly less than n (for n >= 2).
func largestPowerOf2LessThan(n int) int {
	k := 1
	for k<<1 < n {
		k <<= 1
	}
	return k
}

// ComputeRFC9162Root computes the RFC 9162 Merkle Tree Hash (MTH) over an array of leaf hashes.
func ComputeRFC9162Root(leafHashes [][]byte) ([]byte, error) {
	n := len(leafHashes)
	if n == 0 {
		return nil, errors.New("cannot compute Merkle root of empty leaf list")
	}
	if n == 1 {
		return leafHashes[0], nil
	}
	k := largestPowerOf2LessThan(n)
	leftRoot, err := ComputeRFC9162Root(leafHashes[:k])
	if err != nil {
		return nil, err
	}
	rightRoot, err := ComputeRFC9162Root(leafHashes[k:])
	if err != nil {
		return nil, err
	}
	return HashNode(leftRoot, rightRoot), nil
}

// ComputeMerkleRoot computes the hex-encoded RFC 9162 Merkle root for a slice of event hex hashes.
func ComputeMerkleRoot(eventHashes []string) (string, error) {
	if len(eventHashes) == 0 {
		return "", errors.New("cannot compute Merkle root of empty event list")
	}

	leaves := make([][]byte, len(eventHashes))
	for i, hStr := range eventHashes {
		hBytes, err := hex.DecodeString(hStr)
		if err != nil {
			return "", fmt.Errorf("invalid hex hash at index %d: %w", i, err)
		}
		leaves[i] = HashLeaf(hBytes)
	}

	rootBytes, err := ComputeRFC9162Root(leaves)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(rootBytes), nil
}

// InclusionProofStep represents one sibling hash in the inclusion path.
type InclusionProofStep struct {
	Hash   string `json:"hash"`
	IsLeft bool   `json:"is_left"`
}

// GenerateInclusionProof produces the audit path from leaf at targetIndex to the Merkle root.
func GenerateInclusionProof(eventHashes []string, targetIndex int) ([]InclusionProofStep, error) {
	n := len(eventHashes)
	if n == 0 || targetIndex < 0 || targetIndex >= n {
		return nil, errors.New("target index out of bounds or empty hashes")
	}

	leaves := make([][]byte, n)
	for i, hStr := range eventHashes {
		hBytes, err := hex.DecodeString(hStr)
		if err != nil {
			return nil, err
		}
		leaves[i] = HashLeaf(hBytes)
	}

	var proof []InclusionProofStep
	var recurse func(subLeaves [][]byte, idx int)
	recurse = func(subLeaves [][]byte, idx int) {
		sn := len(subLeaves)
		if sn <= 1 {
			return
		}
		k := largestPowerOf2LessThan(sn)
		if idx < k {
			// Target is in left subtree; record right subtree root as right sibling
			rRoot, _ := ComputeRFC9162Root(subLeaves[k:])
			proof = append(proof, InclusionProofStep{
				Hash:   hex.EncodeToString(rRoot),
				IsLeft: false,
			})
			recurse(subLeaves[:k], idx)
		} else {
			// Target is in right subtree; record left subtree root as left sibling
			lRoot, _ := ComputeRFC9162Root(subLeaves[:k])
			proof = append(proof, InclusionProofStep{
				Hash:   hex.EncodeToString(lRoot),
				IsLeft: true,
			})
			recurse(subLeaves[k:], idx-k)
		}
	}

	recurse(leaves, targetIndex)
	return proof, nil
}

// VerifyInclusionProof validates that leafHex exists at targetIndex with given audit proof and root.
func VerifyInclusionProof(leafHex string, proof []InclusionProofStep, expectedRootHex string) (bool, error) {
	rawBytes, err := hex.DecodeString(leafHex)
	if err != nil {
		return false, fmt.Errorf("invalid leaf hex: %w", err)
	}
	curr := HashLeaf(rawBytes)

	// Traverse proof from leaf upwards (reverse order of recorded splits)
	for i := len(proof) - 1; i >= 0; i-- {
		step := proof[i]
		sibBytes, err := hex.DecodeString(step.Hash)
		if err != nil {
			return false, fmt.Errorf("invalid sibling hex: %w", err)
		}
		if step.IsLeft {
			curr = HashNode(sibBytes, curr)
		} else {
			curr = HashNode(curr, sibBytes)
		}
	}

	return hex.EncodeToString(curr) == expectedRootHex, nil
}
