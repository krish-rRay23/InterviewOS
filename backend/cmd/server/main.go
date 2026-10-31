package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/interviewos/interviewos/backend/internal/api"
	"github.com/interviewos/interviewos/backend/internal/outbox"
	"github.com/interviewos/interviewos/backend/internal/store"
	"context"
)

// corsMiddleware adds standard CORS headers for development & dashboard access
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Capability-Token")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	st := store.NewMemoryStore()

	// Seed standard initial organization and demo assessment policy
	org := st.CreateOrganization("InterviewOS Engineering Corp", "interviewos-engineering")
	asmt, _ := st.CreateAssessment(org.ID, "Senior Systems Architect Assessment", "TRADITIONAL_CODING")
	cand := st.CreateCandidate(org.ID, "Jane Doe", "jane.doe@example.com")

	st.SavePolicy(store.AssessmentPolicy{
		AssessmentID:           asmt.ID,
		Version:                1,
		MaxDisplays:            1,
		AllowExternalIDE:       false,
		AllowUSBStorage:        false,
		StrictETW:              true,
		ProhibitedProcessNames: []string{"anydesk.exe", "teamviewer.exe", "vncserver.exe", "vmware.exe"},
		PermittedProcessNames:  []string{"code.exe", "chrome.exe", "powershell.exe", "cmd.exe"},
		InvestigationBudgetUSD: 2.50,
		MaxAgentToolCalls:      30,
	})

	handler := api.NewAPIHandler(st)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Start Transactional Outbox Worker
	outboxWorker := outbox.NewOutboxWorker(st)
	outboxWorker.Start(context.Background())
	defer outboxWorker.Stop()

	fmt.Printf("\n==========================================================\n")
	fmt.Printf("  INTERVIEWOS BACKEND SERVER (GO 1.23)\n")
	fmt.Printf("==========================================================\n")
	fmt.Printf("  Listening on:             http://localhost:%s\n", port)
	fmt.Printf("  Default Org ID:           %s\n", org.ID)
	fmt.Printf("  Default Assessment ID:    %s\n", asmt.ID)
	fmt.Printf("  Default Candidate ID:     %s\n", cand.ID)
	fmt.Printf("  Policy:                   v1 (Max 1 display, AI/USB prohibited)\n")
	fmt.Printf("  Status:                   READY FOR INGESTION & AGENT TASKS\n")
	fmt.Printf("==========================================================\n\n")

	server := &http.Server{
		Addr:    ":" + port,
		Handler: corsMiddleware(mux),
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}

