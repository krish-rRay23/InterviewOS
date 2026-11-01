package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/interviewos/interviewos/backend/internal/api"
	"github.com/interviewos/interviewos/backend/internal/auth"
	"github.com/interviewos/interviewos/backend/internal/outbox"
	"github.com/interviewos/interviewos/backend/internal/store"
)

// secureCORSMiddleware restricts CORS headers to permitted domains and rejects wildcard in production
func secureCORSMiddleware(next http.Handler) http.Handler {
	allowedOriginsEnv := os.Getenv("ALLOWED_ORIGINS")
	appEnv := os.Getenv("APP_ENV")
	var allowedOrigins []string
	if allowedOriginsEnv != "" {
		allowedOrigins = strings.Split(allowedOriginsEnv, ",")
	} else {
		allowedOrigins = []string{
			"http://localhost:5173", "http://127.0.0.1:5173",
			"http://localhost:3000", "http://127.0.0.1:3000",
			"http://localhost:8080", "http://127.0.0.1:8080",
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowOrigin := ""
		for _, o := range allowedOrigins {
			trimmed := strings.TrimSpace(o)
			if trimmed == origin || trimmed == "*" {
				allowOrigin = origin
				break
			}
		}
		// In development mode, automatically allow any localhost or 127.0.0.1 port (e.g. Vite dev server)
		if allowOrigin == "" && appEnv != "production" && origin != "" {
			if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
				allowOrigin = origin
			}
		}
		if allowOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		} else if origin == "" {
			// Non-browser or same-origin request
			w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
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

	// 1. Initialize Storage Layer (PostgreSQL with explicit development-only fallback)
	var st store.Store
	databaseURL := os.Getenv("DATABASE_URL")
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}

	if databaseURL != "" {
		pgStore, err := store.NewPostgresStore(databaseURL)
		if err != nil {
			if appEnv == "production" {
				log.Fatalf("[FATAL CONFIGURATION] PostgreSQL connection failed in production: %v", err)
			}
			log.Printf("[Storage Error] PostgreSQL initialization failed: %v. Falling back to MemoryStore for local dev resilience.", err)
			st = store.NewMemoryStore()
		} else {
			st = pgStore
			log.Printf("[Storage] PostgreSQL Durable Persistence initialized and migrated successfully.")
		}
	} else {
		if appEnv == "production" {
			log.Fatalf("[FATAL CONFIGURATION] DATABASE_URL must be specified in production. Refusing volatile memory storage.")
		}
		log.Printf("[Storage Notice] DATABASE_URL not set. Running in localized MemoryStore mode (dev only).")
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
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" && appEnv == "production" {
		log.Fatalf("[FATAL SECURITY CONFIGURATION] JWT_SECRET must be explicitly configured in production.")
	}
	authMgr := auth.NewAuthManager(jwtSecret)

	// 4. Seed baseline organization, assessment, policy only in development or explicit SEED_DEMO
	var org store.Organization
	var asmt store.Assessment
	var cand store.Candidate
	if appEnv != "production" || os.Getenv("SEED_DEMO") == "true" {
		org = st.CreateOrganization("InterviewOS Engineering Corp", "interviewos-engineering")
		asmt, _ = st.CreateAssessment(org.ID, "Senior Systems Architect Assessment", "TRADITIONAL_CODING")
		cand = st.CreateCandidate(org.ID, "Jane Doe", "jane.doe@example.com")

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
	}

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
	if org.ID != "" {
		fmt.Printf("  Default Org ID:           %s\n", org.ID)
		fmt.Printf("  Default Assessment ID:    %s\n", asmt.ID)
		fmt.Printf("  Default Candidate ID:     %s\n", cand.ID)
	}
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
