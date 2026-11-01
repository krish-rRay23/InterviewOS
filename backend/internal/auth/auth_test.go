package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuthManager_TokenLifecycle(t *testing.T) {
	mgr := NewAuthManager("test-super-secret-key-that-is-at-least-32-bytes")

	token, err := mgr.IssueToken("user-1", "org-1", "sess-1", RoleCandidate, 1*time.Hour)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	claims, err := mgr.VerifyToken(token)
	if err != nil {
		t.Fatalf("failed to verify valid token: %v", err)
	}

	if claims.UserID != "user-1" || claims.OrgID != "org-1" || claims.Role != RoleCandidate {
		t.Errorf("unexpected claims: %+v", claims)
	}

	// Test Revocation
	mgr.RevokeToken(claims.ID)
	_, err = mgr.VerifyToken(token)
	if err == nil {
		t.Fatalf("expected error for revoked token, got nil")
	}
}

func TestAuthManager_Middleware(t *testing.T) {
	mgr := NewAuthManager("test-super-secret-key-that-is-at-least-32-bytes")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetClaims(r.Context())
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Write([]byte(claims.UserID))
	})

	protected := mgr.Authenticate(handler)

	// Unauthenticated request should fail
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	protected.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unauthenticated request, got %d", w.Code)
	}

	// Authenticated request should succeed
	token, _ := mgr.IssueToken("user-admin", "org-1", "", RoleOrgAdmin, time.Hour)
	req = httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	protected.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for authenticated request, got %d", w.Code)
	}
	if w.Body.String() != "user-admin" {
		t.Errorf("expected user-admin, got %s", w.Body.String())
	}
}

func TestAuthManager_RequireRole(t *testing.T) {
	mgr := NewAuthManager("test-super-secret-key-that-is-at-least-32-bytes")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	roleProtected := mgr.Authenticate(mgr.RequireRole(RoleOrgAdmin, RoleSystemOperator)(handler))

	// Candidate should get 403 Forbidden
	candToken, _ := mgr.IssueToken("cand-1", "org-1", "sess-1", RoleCandidate, time.Hour)
	req := httptest.NewRequest("GET", "/admin-only", nil)
	req.Header.Set("Authorization", "Bearer "+candToken)
	w := httptest.NewRecorder()
	roleProtected.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for candidate accessing admin route, got %d", w.Code)
	}

	// OrgAdmin should succeed
	adminToken, _ := mgr.IssueToken("admin-1", "org-1", "", RoleOrgAdmin, time.Hour)
	req = httptest.NewRequest("GET", "/admin-only", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	roleProtected.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for admin, got %d", w.Code)
	}
}
