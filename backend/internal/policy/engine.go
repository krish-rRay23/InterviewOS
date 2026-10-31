package policy

import (
	"strings"

	"github.com/interviewos/interviewos/backend/internal/ioep"
	"github.com/interviewos/interviewos/backend/internal/store"
)

type PolicyEvaluationResult struct {
	IntegrityState    store.IntegrityState `json:"integrity_state"`
	BreachesDetected  []string             `json:"breaches_detected"`
	WarningsDetected  []string             `json:"warnings_detected"`
	ClearedAnomalies  []string             `json:"cleared_anomalies"`
	EvidenceRefs      []string             `json:"evidence_refs"`
	RequiresAudit     bool                 `json:"requires_audit"`
}

type PolicyEngine struct{}

func NewPolicyEngine() *PolicyEngine {
	return &PolicyEngine{}
}

// EvaluateSession evaluates all verified events of a session against the active AssessmentPolicy
func (e *PolicyEngine) EvaluateSession(pol store.AssessmentPolicy, events []ioep.SessionEvent, investigations []store.InvestigationCase) PolicyEvaluationResult {
	res := PolicyEvaluationResult{
		IntegrityState:   store.IntegrityStateVerified,
		BreachesDetected: make([]string, 0),
		WarningsDetected: make([]string, 0),
		ClearedAnomalies: make([]string, 0),
		EvidenceRefs:     make([]string, 0),
		RequiresAudit:    false,
	}

	for _, ev := range events {
		switch ev.EventType {
		case ioep.EventTypeProcessStarted:
			procName, _ := ev.Payload["process_name"].(string)
			lowerName := strings.ToLower(procName)

			// Check prohibited processes
			for _, prohibited := range pol.ProhibitedProcessNames {
				if strings.EqualFold(prohibited, lowerName) {
					res.BreachesDetected = append(res.BreachesDetected, "Prohibited process launched: "+procName)
					res.EvidenceRefs = append(res.EvidenceRefs, ev.EventID)
				}
			}

			// Check external IDE if forbidden
			if !pol.AllowExternalIDE {
				if strings.Contains(lowerName, "devenv") || strings.Contains(lowerName, "idea64") || strings.Contains(lowerName, "pycharm") {
					res.BreachesDetected = append(res.BreachesDetected, "Unauthorized external IDE launched: "+procName)
					res.EvidenceRefs = append(res.EvidenceRefs, ev.EventID)
				}
			}

		case ioep.EventTypeDeviceConnected:
			category, _ := ev.Payload["category"].(string)
			devID, _ := ev.Payload["device_id"].(string)
			if category == "STORAGE" && !pol.AllowUSBStorage {
				res.BreachesDetected = append(res.BreachesDetected, "Unauthorized USB storage device connected: "+devID)
				res.EvidenceRefs = append(res.EvidenceRefs, ev.EventID)
			}

		case ioep.EventTypeDisplayTopologyChanged:
			dispCount := 1
			if cnt, ok := ev.Payload["display_count"].(float64); ok {
				dispCount = int(cnt)
			}
			if dispCount > pol.MaxDisplays {
				res.BreachesDetected = append(res.BreachesDetected, "Multi-monitor display topology exceeded allowed limit")
				res.EvidenceRefs = append(res.EvidenceRefs, ev.EventID)
			}

		case ioep.EventTypeRemoteSessionChanged:
			remoteActive, _ := ev.Payload["remote_session_active"].(bool)
			if remoteActive {
				res.BreachesDetected = append(res.BreachesDetected, "Active remote desktop connection observed")
				res.EvidenceRefs = append(res.EvidenceRefs, ev.EventID)
			}
		}
	}

	// Examine completed investigations
	for _, inv := range investigations {
		if !inv.Resolved {
			res.WarningsDetected = append(res.WarningsDetected, "Unresolved investigation: "+inv.Hypothesis)
		} else if inv.RecommendedAction == "NO_ACTION_BENIGN" {
			res.ClearedAnomalies = append(res.ClearedAnomalies, "Cleared anomaly: "+inv.Hypothesis)
		} else if inv.RecommendedAction == "ENFORCE_POLICY_BREACH" {
			res.BreachesDetected = append(res.BreachesDetected, "Confirmed investigation breach: "+inv.Hypothesis)
		}
	}

	// Determine final state strictly without unverified probabilistic leaps
	if len(res.BreachesDetected) > 0 {
		res.IntegrityState = store.IntegrityStatePolicyBreachConfirmed
	} else if len(res.WarningsDetected) > 0 {
		res.IntegrityState = store.IntegrityStateInconclusive
		res.RequiresAudit = true
	} else if len(res.ClearedAnomalies) > 0 {
		res.IntegrityState = store.IntegrityStateReviewConditionResolved
	} else {
		res.IntegrityState = store.IntegrityStateVerified
	}

	return res
}

