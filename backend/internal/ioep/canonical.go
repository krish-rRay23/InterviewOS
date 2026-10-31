package ioep

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
)

// CanonicalJSON recursively serializes arbitrary JSON data into RFC 8785 canonical JSON
func CanonicalJSON(v interface{}) ([]byte, error) {
	var buf bytes.Buffer
	if err := writeCanonical(&buf, v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func writeCanonical(buf *bytes.Buffer, v interface{}) error {
	if v == nil {
		buf.WriteString("null")
		return nil
	}

	switch val := v.(type) {
	case bool:
		if val {
			buf.WriteString("true")
		} else {
			buf.WriteString("false")
		}
	case string:
		b, _ := json.Marshal(val)
		buf.Write(b)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		b, _ := json.Marshal(val)
		buf.Write(b)
	case float32, float64:
		b, _ := json.Marshal(val)
		buf.Write(b)
	case []interface{}:
		buf.WriteByte('[')
		for i, item := range val {
			if i > 0 {
				buf.WriteByte(',')
			}
			if err := writeCanonical(buf, item); err != nil {
				return err
			}
		}
		buf.WriteByte(']')
	case map[string]interface{}:
		buf.WriteByte('{')
		// Sort keys lexicographically
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for i, k := range keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			keyBytes, _ := json.Marshal(k)
			buf.Write(keyBytes)
			buf.WriteByte(':')
			if err := writeCanonical(buf, val[k]); err != nil {
				return err
			}
		}
		buf.WriteByte('}')
	default:
		// Attempt struct/generic marshal-then-unmarshal
		data, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("canonicalization failed: %w", err)
		}
		var generic interface{}
		if err := json.Unmarshal(data, &generic); err != nil {
			return fmt.Errorf("canonicalization unmarshal failed: %w", err)
		}
		return writeCanonical(buf, generic)
	}
	return nil
}

