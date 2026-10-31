package api

import (
	"encoding/json"
	"net/http"
)

func (h *APIHandler) GetOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	spec := map[string]interface{}{
		"openapi": "3.0.3",
		"info": map[string]interface{}{
			"title":       "InterviewOS Control & Ingestion API",
			"version":     "1.0.0",
			"description": "Autonomous Agentic Assessment Operating System Control Plane API.",
		},
		"paths": map[string]interface{}{
			"/v1/organizations": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Create Organization",
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Organization created"},
					},
				},
			},
			"/v1/assessments": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Create Assessment",
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Assessment created"},
					},
				},
			},
			"/v1/sessions": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Create Candidate Session",
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Session created"},
					},
				},
			},
			"/v1/sessions/{id}/enroll": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Enroll Endpoint Agent with IOEP Signature",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Enrollment verified and active"},
					},
				},
			},
			"/v1/sessions/{id}/batches": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Ingest Cryptographically Signed Evidence Batch",
					"responses": map[string]interface{}{
						"202": map[string]interface{}{"description": "Batch verified and acknowledged"},
						"422": map[string]interface{}{"description": "Cryptographic signature or hash chain broken"},
					},
				},
			},
			"/v1/sessions/{id}/submissions": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Submit Candidate Code Solution",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Code evaluated against hidden test cases"},
					},
				},
			},
			"/v1/sessions/{id}/report": map[string]interface{}{
				"get": map[string]interface{}{
					"summary": "Get Final Verified Assessment Report",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Decoupled technical score and integrity state"},
					},
				},
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(spec)
}

func (h *APIHandler) GetSwaggerUI(w http.ResponseWriter, r *http.Request) {
	html := `<!DOCTYPE html>
<html>
<head>
    <title>InterviewOS API Explorer</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body style="margin: 0; background: #09090b;">
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: "/v1/openapi.json",
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>`
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(html))
}
