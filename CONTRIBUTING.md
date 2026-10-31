# Contributing to InterviewOS

We welcome engineering contributions to InterviewOS!

## Development Guidelines

1. **Deterministic Contracts**: All inter-agent tasks and telemetry events must use strongly typed IOEP schemas in `protocols/schemas/`.
2. **Security & Privacy Non-Negotiables**: Never introduce keyloggers, covert surveillance, or arbitrary remote code execution primitives.
3. **Reproducible Testing**:
   - Native C++ agent: Verify via `agent/tests/test_agent.cpp`.
   - Go backend: Run `go test -v ./...`.
   - Python agents: Run `python -m unittest agents/tests/test_agents.py`.
   - Benchmark laboratory: Run `python benchmark/runner.py`.
4. **Code Quality**: Follow standard Go formatting (`gofmt`), C++20 conventions, and Python PEP 8 standards.
