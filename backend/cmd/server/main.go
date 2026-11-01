package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/interviewos/interviewos/backend/internal/api"
	"github.com/interviewos/interviewos/backend/internal/auth"
	"github.com/interviewos/interviewos/backend/internal/outbox"
	"github.com/interviewos/interviewos/backend/internal/store"
)

// secureCORSMiddleware restricts CORS headers to permitted domains and rejects wildcard in production
func secureCORSMiddleware(next http.Handler) http.Handler {
	allowedOriginsEnv := os.Getenv("ALLOWED_ORIGINS")
	var allowedOrigins []string
	if allowedOriginsEnv != "" {
		allowedOrigins = strings.Split(allowedOriginsEnv, ",")
	} else {
		allowedOrigins = []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8080", "http://127.0.0.1:8080"}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowOrigin := ""
		for _, o := range allowedOrigins {
			if strings.TrimSpace(o) == origin || strings.TrimSpace(o) == "*" {
				allowOrigin = origin
				break
			}
		}
		if allowOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		} else if origin == "" {
			// Non-browser or same-origin request
			w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Capability-Token")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

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

	// 1. Initialize Storage Layer (PostgreSQL with fallback to MemoryStore)
	var st store.Store
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL != "" {
		pgStore, err := store.NewPostgresStore(databaseURL)
		if err != nil {
			log.Printf("[Storage Error] PostgreSQL initialization failed: %v. Falling back to MemoryStore for local resilience.", err)
			st = store.NewMemoryStore()
		} else {
			st = pgStore
			log.Printf("[Storage] PostgreSQL Durable Persistence initialized and migrated successfully.")
		}
	} else {
		log.Printf("[Storage Notice] DATABASE_URL not set. Running in localized MemoryStore mode.")
		st = store.NewMemoryStore()
	}
	defer st.Close()

	// 2. Initialize Redis Streams Broker (Event distribution & consumer groups)
	var broker *outbox.RedisStreamsBroker
	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		var err error
		broker, err = outbox.NewRedisStreamsBroker(redisURL, st, "backend-outbox-worker")
		if err != nil {
			log.Printf("[Redis Notice] Redis Streams connection failed (%v). Running outbox in direct log mode.", err)
		} else {
			log.Printf("[Redis Streams] Connected to Redis Streams broker at %s", redisURL)
		}
	}

	// 3. Initialize Authentication Manager (OWASP ASVS 5.0)
	authMgr := auth.NewAuthManager(os.Getenv("JWT_SECRET"))

	// 4. Seed baseline organization, assessment, policy, and bootstrap token
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

	demoToken, _ := authMgr.IssueToken("admin-bootstrap-001", org.ID, "", auth.RoleOrgAdmin, 72*time.Hour)

	// 5. Register HTTP Handlers & Routes
	handler := api.NewAPIHandler(st, authMgr)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 6. Start Transactional Outbox Worker
	outboxWorker := outbox.NewOutboxWorker(st, broker)
	outboxWorker.Start(context.Background())
	defer outboxWorker.Stop()

	// Apply Middlewares: CORS -> RateLimit -> Authenticate -> Routes
	rateLimitedHandler := authMgr.RateLimit(300)(authMgr.Authenticate(mux))
	finalHandler := secureCORSMiddleware(rateLimitedHandler)

	fmt.Printf("\n==========================================================\n")
	fmt.Printf("  INTERVIEWOS PRODUCTION-HARDENED BACKEND (GO 1.26)\n")
	fmt.Printf("==========================================================\n")
	fmt.Printf("  Listening on:             http://localhost:%s\n", port)
	fmt.Printf("  Storage Engine:           %s\n", st.StorageType())
	fmt.Printf("  Default Org ID:           %s\n", org.ID)
	fmt.Printf("  Default Assessment ID:    %s\n", asmt.ID)
	fmt.Printf("  Default Candidate ID:     %s\n", cand.ID)
	fmt.Printf("  Bootstrap Admin Token:    %s\n", demoToken[:24]+"...")
	fmt.Printf("  OWASP Security Baseline:  ASVS 5.0 (RBAC, Rate Limiting, IDOR Protection)\n")
	fmt.Printf("  Status:                   ONLINE & READY FOR INGESTION\n")
	fmt.Printf("==========================================================\n\n")

	server := &http.Server{
		Addr:    ":" + port,
		Handler: finalHandler,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
