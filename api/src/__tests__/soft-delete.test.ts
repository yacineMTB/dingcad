/**
 * Tests for the soft-delete (trash/restore/permanent-delete) project flow.
 *
 * Uses the same mock-driven Express approach as projects.test.ts.
 */

process.env.NODE_ENV = "test";

import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import http from "http";
import type { AddressInfo } from "net";

const JWT_SECRET = process.env.JWT_SECRET || "helscoop-dev-secret";

// Mock the database module BEFORE any app import
vi.mock("../db", () => ({
  query: vi
    .fn()
    .mockResolvedValue({
      rows: [],
      command: "",
      rowCount: 0,
      oid: 0,
      fields: [],
    }),
  pool: { query: vi.fn() },
}));

// Mock email to avoid Resend initialization
vi.mock("../email", () => ({
  sendEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPriceAlertEmail: vi.fn(),
}));

import { query } from "../db";
const mockQuery = vi.mocked(query);
import app from "../index";

function authToken(userId = "user-1", role = "user") {
  return jwt.sign(
    { id: userId, email: "test@test.com", role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function makeRequest(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {}
): Promise<{
  status: number;
  body: unknown;
  headers: Record<string, string>;
}> {
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
  mockQuery.mockResolvedValue({
    rows: [],
    command: "",
    rowCount: 0,
    oid: 0,
    fields: [],
  });
});

// --------------------------------------------------------------------------
// DELETE /projects/:id — soft delete
// --------------------------------------------------------------------------

describe("DELETE /projects/:id (soft delete)", () => {
  it("soft-deletes by setting deleted_at (not removing the row)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("DELETE", "/projects/proj-1", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });

    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);

    // Verify the SQL used UPDATE ... SET deleted_at, not DELETE
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("deleted_at");
    expect(sql).toContain("UPDATE");
    expect(sql).not.toMatch(/^DELETE/);
  });

  it("rejects unauthenticated request", async () => {
    const res = await makeRequest("DELETE", "/projects/proj-1");
    expect(res.status).toBe(401);
  });
});

// --------------------------------------------------------------------------
// GET /projects/trash — list trashed projects
// --------------------------------------------------------------------------

describe("GET /projects/trash", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("GET", "/projects/trash");
    expect(res.status).toBe(401);
  });

  it("returns trashed projects for the user", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "proj-1",
          name: "Deleted Shed",
          deleted_at: "2026-04-10T00:00:00Z",
        },
        {
          id: "proj-2",
          name: "Deleted Garage",
          deleted_at: "2026-04-15T00:00:00Z",
        },
      ],
      command: "SELECT",
      rowCount: 2,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/projects/trash", {
      headers: { Authorization: `Bearer ${authToken()}` },
    });

    expect(res.status).toBe(200);
    const body = res.body as Array<{
      id: string;
      deleted_at: string;
    }>;
    expect(body).toHaveLength(2);
    expect(body[0].deleted_at).toBeTruthy();
  });

  it("returns empty array when no trashed projects exist", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/projects/trash", {
      headers: { Authorization: `Bearer ${authToken()}` },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// POST /projects/:id/restore — restore from trash
// --------------------------------------------------------------------------

describe("POST /projects/:id/restore", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("POST", "/projects/proj-1/restore");
    expect(res.status).toBe(401);
  });

  it("restores a trashed project (sets deleted_at = NULL)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/restore", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });

    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);

    // Verify the SQL clears deleted_at
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("deleted_at = NULL");
  });

  it("returns 404 when project is not in trash", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/restore", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });

    expect(res.status).toBe(404);
    expect((res.body as { error: string }).error).toContain("not found");
  });

  it("returns 404 when another user tries to restore", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/restore", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
    });

    expect(res.status).toBe(404);
  });
});

// --------------------------------------------------------------------------
// DELETE /projects/:id/permanent — permanent delete
// --------------------------------------------------------------------------

describe("DELETE /projects/:id/permanent", () => {
  it("rejects request without auth", async () => {
    const res = await makeRequest("DELETE", "/projects/proj-1/permanent");
    expect(res.status).toBe(401);
  });

  it("permanently deletes a trashed project", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "DELETE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("DELETE", "/projects/proj-1/permanent", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });

    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);

    // Verify the SQL uses real DELETE and requires deleted_at IS NOT NULL
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/^DELETE/);
    expect(sql).toContain("deleted_at IS NOT NULL");
  });

  it("only deletes projects that are already soft-deleted", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "DELETE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    await makeRequest("DELETE", "/projects/proj-1/permanent", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("deleted_at IS NOT NULL");
  });
});

// --------------------------------------------------------------------------
// GET /projects — active projects exclude soft-deleted
// --------------------------------------------------------------------------

describe("GET /projects (active list excludes soft-deleted)", () => {
  it("queries for projects WHERE deleted_at IS NULL", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1", name: "Active Project" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("GET", "/projects", {
      headers: { Authorization: `Bearer ${authToken()}` },
    });

    expect(res.status).toBe(200);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("deleted_at IS NULL");
  });
});

// --------------------------------------------------------------------------
// POST /projects/:id/duplicate — cannot duplicate soft-deleted
// --------------------------------------------------------------------------

describe("POST /projects/:id/duplicate", () => {
  it("rejects duplicating a soft-deleted project (returns 404)", async () => {
    // The duplicate route queries WHERE deleted_at IS NULL, so soft-deleted
    // projects won't be found
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/duplicate", {
      headers: { Authorization: `Bearer ${authToken("user-1")}` },
    });

    expect(res.status).toBe(404);
  });

  it("rejects unauthenticated duplicate request", async () => {
    const res = await makeRequest("POST", "/projects/proj-1/duplicate");
    expect(res.status).toBe(401);
  });

  it("rejects another user duplicating a project", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("POST", "/projects/proj-1/duplicate", {
      headers: { Authorization: `Bearer ${authToken("user-2")}` },
    });

    expect(res.status).toBe(404);
  });
});
