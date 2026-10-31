package ioep

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

// ComputeMerkleRoot builds a binary Merkle tree compliant with RFC 9162 (prefix 0x00 for leaves, 0x01 for interior nodes)
func ComputeMerkleRoot(eventHashes []string) (string, error) {
	if len(eventHashes) == 0 {
		return "", errors.New("cannot compute Merkle root of empty event list")
	}

	currentLevel := make([][]byte, len(eventHashes))
	for i, hStr := range eventHashes {
		hBytes, err := hex.DecodeString(hStr)
		if err != nil {
			return "", err
		}
		// Leaf hash: SHA-256(0x00 || hash)
		leafHasher := sha256.New()
		leafHasher.Write([]byte{0x00})
		leafHasher.Write(hBytes)
		currentLevel[i] = leafHasher.Sum(nil)
	}

	for len(currentLevel) > 1 {
		var nextLevel [][]byte
		for i := 0; i < len(currentLevel); i += 2 {
			if i+1 < len(currentLevel) {
				// Interior node: SHA-256(0x01 || left || right)
				nodeHasher := sha256.New()
				nodeHasher.Write([]byte{0x01})
				nodeHasher.Write(currentLevel[i])
				nodeHasher.Write(currentLevel[i+1])
				nextLevel = append(nextLevel, nodeHasher.Sum(nil))
			} else {
				// Odd number of nodes: promote duplicate or carry forward
				nodeHasher := sha256.New()
				nodeHasher.Write([]byte{0x01})
				nodeHasher.Write(currentLevel[i])
				nodeHasher.Write(currentLevel[i])
				nextLevel = append(nextLevel, nodeHasher.Sum(nil))
			}
		}
		currentLevel = nextLevel
	}

	return hex.EncodeToString(currentLevel[0]), nil
}
