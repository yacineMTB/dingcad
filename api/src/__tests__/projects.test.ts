/**
 * API Route Unit Tests for Project Authorization Boundaries and Input Validation
 *
 * These tests exercise the project routes (and related shared endpoints)
 * by importing the full Express app with the database layer mocked out.
 * They verify authorization boundaries, input validation, and edge cases
 * that cannot be caught by the structural tests in api.test.ts.
 *
 * Uses Node http.request against the Express app — no supertest dependency.
 */

// Prevent the imported app from calling app.listen() on a fixed port
// (it checks IS_TEST but doesn't guard listen — we listen on :0 ourselves)
process.env.NODE_ENV = "test";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import http from "http";
import type { AddressInfo } from "net";

const JWT_SECRET = process.env.JWT_SECRET || "helscoop-dev-secret";

// Mock the database module BEFORE any app import
vi.mock("../db", () => ({
  query: vi.fn().mockResolvedValue({ rows: [], command: "", rowCount: 0, oid: 0, fields: [] }),
  pool: { query: vi.fn() },
}));

// Mock email to avoid Resend initialization
vi.mock("../email", () => ({
  sendEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPriceAlertEmail: vi.fn(),
}));

// Import after mocks are set up
import { query } from "../db";
const mockQuery = vi.mocked(query);

// Import the express app
import app from "../index";

// Helper: create a JWT auth token
function authToken(userId = "user-1", role = "user") {
  return jwt.sign(
    { id: userId, email: "test@test.com", role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Helper: make HTTP requests against the Express app without supertest
function makeRequest(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {}
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      const bodyStr = opts.body ? JSON.stringify(opts.body) : undefined;
      const reqOpts: http.RequestOptions = {
        hostname: "127.0.0.1",
        port,
        path,
        method: method.toUpperCase(),
        headers: {
          "Content-Type": "application/json",
          ...opts.headers,
        },
      };

      const req = http.request(reqOpts, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          server.close();
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode || 0,
            body: parsed,
            headers: res.headers as Record<string, string>,
          });
        });
      });

      req.on("error", (err) => {
        server.close();
        reject(err);
      });

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default mock to return empty results
  mockQuery.mockResolvedValue({ rows: [], command: "", rowCount: 0, oid: 0, fields: [] });
});

// --------------------------------------------------------------------------
// POST /projects — create
// --------------------------------------------------------------------------

describe("POST /projects", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("POST", "/projects", {
      body: { name: "Test" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects empty project name", async () => {
    const res = await makeRequest("POST", "/projects", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { name: "" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects project name > 200 characters", async () => {
    const longName = "A".repeat(201);
    const res = await makeRequest("POST", "/projects", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { name: longName },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("200");
  });

  it("creates a project with valid data", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1", name: "My House", user_id: "user-1" }],
      command: "INSERT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { name: "My House", description: "A test house" },
    });
    expect(res.status).toBe(201);
    expect((res.body as { name: string }).name).toBe("My House");
  });

  it("rejects non-string project name", async () => {
    const res = await makeRequest("POST", "/projects", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { name: 12345 },
    });
    expect(res.status).toBe(400);
  });
});

// --------------------------------------------------------------------------
// GET /projects/:id — read single project (cross-user boundary)
// --------------------------------------------------------------------------

describe("GET /projects/:id", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("GET", "/projects/proj-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent project", async () => {
    // First query returns no rows (project not found for this user)
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/projects/nonexistent", {
      headers: { Authorization: `Bearer ${authToken()}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when user-2 tries to access user-1's project (cross-user boundary)", async () => {
    // SQL has AND user_id=$2 — returns empty for wrong user
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/projects/proj-1", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns project with BOM for the owner", async () => {
    // Project fetch
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1", name: "My House", user_id: "user-1", scene_js: "" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    // BOM fetch
    mockQuery.mockResolvedValueOnce({
      rows: [{ material_id: "pine_48x98_c24", quantity: 10, material_name: "Pine 48x98" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/projects/proj-1", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });
    expect(res.status).toBe(200);
    const body = res.body as { name: string; bom: unknown[] };
    expect(body.name).toBe("My House");
    expect(body.bom).toHaveLength(1);
  });
});

// --------------------------------------------------------------------------
// PUT /projects/:id — update
// --------------------------------------------------------------------------

describe("PUT /projects/:id", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1", {
      body: { name: "Updated" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects project name > 200 characters on update", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { name: "B".repeat(201) },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("200");
  });

  it("returns 404 when updating another user's project", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
      body: { name: "Hacked", description: "", scene_js: "" },
    });
    expect(res.status).toBe(404);
  });
});

// --------------------------------------------------------------------------
// DELETE /projects/:id
// --------------------------------------------------------------------------

describe("DELETE /projects/:id", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("DELETE", "/projects/proj-1");
    expect(res.status).toBe(401);
  });

  it("deletes a project (returns ok)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "DELETE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("DELETE", "/projects/proj-1", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });
    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);
  });
});

// --------------------------------------------------------------------------
// PUT /projects/:id/bom — BOM update
// --------------------------------------------------------------------------

describe("PUT /projects/:id/bom", () => {
  it("rejects non-array items", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: "not-an-array" },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("array");
  });

  it("rejects request without auth", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      body: { items: [] },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-owned project", async () => {
    // Project ownership check returns empty
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
      body: { items: [{ material_id: "pine_48x98_c24", quantity: 5 }] },
    });
    expect(res.status).toBe(404);
  });

  it("skips unknown material IDs gracefully", async () => {
    // Project ownership check
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    // DELETE existing BOM
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "DELETE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });
    // Material existence check — not found
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
      body: { items: [{ material_id: "nonexistent_material", quantity: 5 }] },
    });
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; count: number; skipped: number };
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
    expect(body.skipped).toBe(1);
  });
});

// --------------------------------------------------------------------------
// POST /projects/:id/share — share token
// --------------------------------------------------------------------------

describe("POST /projects/:id/share", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("POST", "/projects/proj-1/share");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-owned project", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/share", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns existing share token if already shared (idempotent)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1", share_token: "existing-token-123" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/share", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });
    expect(res.status).toBe(200);
    expect((res.body as { share_token: string }).share_token).toBe("existing-token-123");
  });

  it("generates a new share token when not already shared", async () => {
    // Project lookup — no existing token
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1", share_token: null }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    // UPDATE to set token
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/share", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });
    expect(res.status).toBe(200);
    expect((res.body as { share_token: string }).share_token).toBeTruthy();
  });
});

// --------------------------------------------------------------------------
// DELETE /projects/:id/share — revoke share
// --------------------------------------------------------------------------

describe("DELETE /projects/:id/share", () => {
  it("returns 404 for non-owned project", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("DELETE", "/projects/proj-1/share", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
    });
    expect(res.status).toBe(404);
  });

  it("removes share token successfully", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("DELETE", "/projects/proj-1/share", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });
    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);
  });
});

// --------------------------------------------------------------------------
// PUT /projects/:id/thumbnail — thumbnail upload
// --------------------------------------------------------------------------

describe("PUT /projects/:id/thumbnail", () => {
  it("rejects missing thumbnail", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1/thumbnail", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: {},
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("thumbnail");
  });

  it("rejects non-string thumbnail", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1/thumbnail", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { thumbnail: 12345 },
    });
    expect(res.status).toBe(400);
  });

  it("rejects thumbnail > 200KB", async () => {
    const largeThumbnail = "data:image/png;base64," + "A".repeat(200 * 1024 + 1);
    const res = await makeRequest("PUT", "/projects/proj-1/thumbnail", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { thumbnail: largeThumbnail },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("large");
  });

  it("returns 404 for non-owned project", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/thumbnail", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
      body: { thumbnail: "data:image/png;base64,abc123" },
    });
    expect(res.status).toBe(404);
  });
});

// --------------------------------------------------------------------------
// GET /shared/:token — public shared project (no auth required)
// --------------------------------------------------------------------------

describe("GET /shared/:token", () => {
  it("returns 404 for nonexistent share token", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/shared/nonexistent-token");
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty/invalid token", async () => {
    const res = await makeRequest("GET", "/shared/" + "x".repeat(65));
    expect(res.status).toBe(400);
  });

  it("returns project data without auth for valid token", async () => {
    // Project by share token
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1", name: "Shared House", scene_js: "box(1,1,1);" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    // BOM for shared project
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/shared/valid-share-token-123");
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe("Shared House");
  });
});

// --------------------------------------------------------------------------
// Health check
// --------------------------------------------------------------------------

describe("GET /health", () => {
  it("returns status ok without auth", async () => {
    const res = await makeRequest("GET", "/health");
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe("ok");
  });
});
