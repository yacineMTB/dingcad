/**
 * Tests for BOM item validation edge cases in PUT /projects/:id/bom.
 *
 * Supplements projects.test.ts with deeper validation boundary testing.
 */

process.env.NODE_ENV = "test";

import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import http from "http";
import type { AddressInfo } from "net";

const JWT_SECRET = process.env.JWT_SECRET || "helscoop-dev-secret";

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

vi.mock("../email", () => ({
  sendEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPriceAlertEmail: vi.fn(),
}));

import { query } from "../db";
const mockQuery = vi.mocked(query);
import app from "../index";

function authToken(userId = "user-1") {
  return jwt.sign(
    { id: userId, email: "test@test.com", role: "user" },
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
          resolve({ status: res.statusCode || 0, body: parsed });
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

describe("PUT /projects/:id/bom — validation edge cases", () => {
  it("rejects negative quantity", async () => {
    // Project ownership check
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [{ material_id: "pine_48x98_c24", quantity: -5 }] },
    });

    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("positive");
  });

  it("rejects zero quantity", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [{ material_id: "pine_48x98_c24", quantity: 0 }] },
    });

    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("positive");
  });

  it("rejects quantity exceeding 1,000,000", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: {
        items: [{ material_id: "pine_48x98_c24", quantity: 1_000_001 }],
      },
    });

    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("1,000,000");
  });

  it("rejects NaN quantity", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: {
        items: [{ material_id: "pine_48x98_c24", quantity: "not-a-number" }],
      },
    });

    expect(res.status).toBe(400);
  });

  it("rejects Infinity quantity", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [{ material_id: "pine_48x98_c24", quantity: Infinity }] },
    });

    expect(res.status).toBe(400);
  });

  it("rejects empty material_id", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [{ material_id: "", quantity: 5 }] },
    });

    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("material_id");
  });

  it("rejects null material_id", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [{ material_id: null, quantity: 5 }] },
    });

    expect(res.status).toBe(400);
  });

  it("rejects non-string material_id (numeric)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [{ material_id: 12345, quantity: 5 }] },
    });

    expect(res.status).toBe(400);
  });

  it("accepts empty items array (clears BOM)", async () => {
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

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [] },
    });

    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; count: number; skipped: number };
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
    expect(body.skipped).toBe(0);
  });

  it("accepts valid fractional quantity", async () => {
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
    // Material existence check
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "pine_48x98_c24" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    // INSERT BOM item
    mockQuery.mockResolvedValueOnce({
      rows: [],
      command: "INSERT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: [{ material_id: "pine_48x98_c24", quantity: 2.5 }] },
    });

    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; count: number };
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
  });

  it("rejects items when body.items is an object instead of array", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: { items: { material_id: "pine_48x98_c24", quantity: 5 } },
    });

    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("array");
  });

  it("rejects missing items field entirely", async () => {
    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: {},
    });

    expect(res.status).toBe(400);
  });

  it("validates all items before modifying database (early rejection)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "proj-1" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    // First item is valid, second is invalid
    const res = await makeRequest("PUT", "/projects/proj-1/bom", {
      headers: { Authorization: `Bearer ${authToken()}` },
      body: {
        items: [
          { material_id: "pine_48x98_c24", quantity: 5 },
          { material_id: "osb_9mm", quantity: -1 }, // invalid
        ],
      },
    });

    expect(res.status).toBe(400);
    // Error should reference item 2
    expect((res.body as { error: string }).error).toContain("2");
  });
});
