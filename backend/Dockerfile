FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download || true

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server cmd/server/main.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /server /app/server

EXPOSE 8080
CMD ["/app/server"]

