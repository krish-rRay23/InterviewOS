package auth

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Role string

const (
	RoleCandidate       Role = "CANDIDATE"
	RoleInterviewer     Role = "INTERVIEWER"
	RoleAssessmentAdmin Role = "ASSESSMENT_ADMIN"
	RoleOrgAdmin        Role = "ORG_ADMIN"
	RoleSystemOperator  Role = "SYSTEM_OPERATOR"
)

type contextKey string

const (
	ClaimsContextKey contextKey = "interviewos_auth_claims"
)

type UserClaims struct {
	UserID    string `json:"user_id"`
	OrgID     string `json:"org_id"`
	SessionID string `json:"session_id,omitempty"`
	Role      Role   `json:"role"`
	jwt.RegisteredClaims
}

type AuthManager struct {
	jwtSecret     []byte
	issuer        string
	tokenExpiry   time.Duration
	revokedTokens sync.Map // jti -> expiry
	rateLimits    sync.Map // ip -> *rateLimiter
}

func NewAuthManager(secret string) *AuthManager {
	if secret == "" {
		secret = os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "interviewos_dev_secret_key_change_in_production_32b"
		}
	}
	return &AuthManager{
		jwtSecret:   []byte(secret),
		issuer:      "interviewos.auth.service",
		tokenExpiry: 24 * time.Hour,
	}
}

// IssueToken mints a cryptographically signed JWT with explicit role and tenant scoping.
func (m *AuthManager) IssueToken(userID, orgID, sessionID string, role Role, duration time.Duration) (string, error) {
	if duration <= 0 {
		duration = m.tokenExpiry
	}
	now := time.Now().UTC()
	tokenID := fmt.Sprintf("tok_%d_%s", now.UnixNano(), userID)

	claims := UserClaims{
		UserID:    userID,
		OrgID:     orgID,
		SessionID: sessionID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			Issuer:    m.issuer,
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return signed, nil
}

// VerifyToken parses and validates token signature, expiration, and revocation status.
func (m *AuthManager) VerifyToken(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired authorization token")
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok {
		return nil, errors.New("malformed token claims")
	}

	// Check revocation denylist
	if _, revoked := m.revokedTokens.Load(claims.ID); revoked {
		return nil, errors.New("token has been revoked")
	}

	return claims, nil
}

// RevokeToken invalidates a token prior to its expiration
func (m *AuthManager) RevokeToken(tokenID string) {
	m.revokedTokens.Store(tokenID, time.Now().UTC())
}

// Middleware: Authenticate extracts and verifies Bearer token, setting claims in context.
func (m *AuthManager) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			// Check query param for websocket / streaming connections if permitted
			authHeader = r.URL.Query().Get("token")
			if authHeader != "" {
				authHeader = "Bearer " + authHeader
			}
		}

		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := m.VerifyToken(tokenStr)
			if err == nil {
				ctx := context.WithValue(r.Context(), ClaimsContextKey, claims)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		// Proceed without claims; downstream role gates will enforce if required
		next.ServeHTTP(w, r)
	})
}

// GetClaims retrieves validated UserClaims from request context
func GetClaims(ctx context.Context) (*UserClaims, bool) {
	claims, ok := ctx.Value(ClaimsContextKey).(*UserClaims)
	return claims, ok && claims != nil
}

// Middleware: RequireRole enforces that the authenticated user possesses one of the allowed roles.
func (m *AuthManager) RequireRole(allowedRoles ...Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := GetClaims(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized: authentication required","status":401}`, http.StatusUnauthorized)
				return
			}

			// System operators have root override capability
			if claims.Role == RoleSystemOperator {
				next.ServeHTTP(w, r)
				return
			}

			hasRole := false
			for _, r := range allowedRoles {
				if claims.Role == r {
					hasRole = true
					break
				}
			}

			if !hasRole {
				log.Printf("[Security Audit] Access Denied: User %s (Role: %s) attempted restricted endpoint %s %s",
					claims.UserID, claims.Role, r.Method, r.URL.Path)
				http.Error(w, `{"error":"forbidden: insufficient role permissions","status":403}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Rate Limiting (Token Bucket per client IP)
type rateLimiter struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	mu         sync.Mutex
}

func (m *AuthManager) RateLimit(limitPerMinute int) func(http.Handler) http.Handler {
	refillRate := float64(limitPerMinute) / 60.0
	maxTokens := float64(limitPerMinute)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
				ip = strings.Split(forwarded, ",")[0]
			}

			val, _ := m.rateLimits.LoadOrStore(ip, &rateLimiter{
				tokens:     maxTokens,
				maxTokens:  maxTokens,
				refillRate: refillRate,
				lastRefill: time.Now(),
			})
			limiter := val.(*rateLimiter)

			limiter.mu.Lock()
			now := time.Now()
			elapsed := now.Sub(limiter.lastRefill).Seconds()
			limiter.tokens += elapsed * limiter.refillRate
			if limiter.tokens > limiter.maxTokens {
				limiter.tokens = limiter.maxTokens
			}
			limiter.lastRefill = now

			if limiter.tokens < 1.0 {
				limiter.mu.Unlock()
				w.Header().Set("Retry-After", "1")
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limitPerMinute))
				w.Header().Set("X-RateLimit-Remaining", "0")
				http.Error(w, `{"error":"too many requests: rate limit exceeded","status":429}`, http.StatusTooManyRequests)
				return
			}

			limiter.tokens -= 1.0
			remaining := int(limiter.tokens)
			limiter.mu.Unlock()

			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limitPerMinute))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
			next.ServeHTTP(w, r)
		})
	}
}
