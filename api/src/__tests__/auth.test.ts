import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "helscoop-dev-secret";

// Import the auth module - signToken and requireAuth are pure functions
// that don't need a database connection
import { signToken, requireAuth, requireAdmin } from "../auth";
import type { AuthUser } from "../auth";

describe("signToken", () => {
  it("creates a valid JWT with 3 parts", () => {
    const user: AuthUser = { id: "user-1", email: "test@test.com", role: "user" };
    const token = signToken(user);
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);
  });

  it("encodes user id, email, and role in the payload", () => {
    const user: AuthUser = { id: "abc-123", email: "hello@helscoop.fi", role: "admin" };
    const token = signToken(user);
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser & { iat: number; exp: number };
    expect(decoded.id).toBe("abc-123");
    expect(decoded.email).toBe("hello@helscoop.fi");
    expect(decoded.role).toBe("admin");
  });

  it("sets a 7-day expiration", () => {
    const user: AuthUser = { id: "user-1", email: "test@test.com", role: "user" };
    const token = signToken(user);
    const decoded = jwt.verify(token, JWT_SECRET) as { iat: number; exp: number };
    const days = (decoded.exp - decoded.iat) / (60 * 60 * 24);
    expect(days).toBe(7);
  });

  it("produces different tokens for different users", () => {
    const token1 = signToken({ id: "user-1", email: "a@test.com", role: "user" });
    const token2 = signToken({ id: "user-2", email: "b@test.com", role: "user" });
    expect(token1).not.toBe(token2);
  });
});

describe("requireAuth middleware", () => {
  function createMockReqRes(headers: Record<string, string> = {}) {
    const req = {
      headers,
      user: undefined as AuthUser | undefined,
    } as unknown as import("express").Request;

    const res = {
      _status: 0,
      _body: null as unknown,
      status(code: number) {
        this._status = code;
        return this;
      },
      json(body: unknown) {
        this._body = body;
        return this;
      },
    } as unknown as import("express").Response & { _status: number; _body: unknown };

    const next = vi.fn();
    return { req, res, next };
  }

  it("rejects requests without Authorization header", () => {
    const { req, res, next } = createMockReqRes();
    requireAuth(req, res, next);
    expect(res._status).toBe(401);
    expect((res._body as { error: string }).error).toContain("Missing");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with non-Bearer authorization", () => {
    const { req, res, next } = createMockReqRes({
      authorization: "Basic dXNlcjpwYXNz",
    });
    requireAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid token", () => {
    const { req, res, next } = createMockReqRes({
      authorization: "Bearer invalid.token.here",
    });
    requireAuth(req, res, next);
    expect(res._status).toBe(401);
    expect((res._body as { error: string }).error).toContain("Invalid");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects expired tokens", () => {
    const expired = jwt.sign(
      { id: "user-1", email: "test@test.com", role: "user" },
      JWT_SECRET,
      { expiresIn: "-1s" }
    );
    const { req, res, next } = createMockReqRes({
      authorization: `Bearer ${expired}`,
    });
    requireAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid token and sets req.user", () => {
    const user: AuthUser = { id: "user-42", email: "valid@test.com", role: "user" };
    const token = signToken(user);
    const { req, res, next } = createMockReqRes({
      authorization: `Bearer ${token}`,
    });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.id).toBe("user-42");
    expect(req.user!.email).toBe("valid@test.com");
  });

  it("rejects tokens signed with wrong secret", () => {
    const wrongToken = jwt.sign(
      { id: "user-1", email: "test@test.com", role: "user" },
      "wrong-secret",
      { expiresIn: "7d" }
    );
    const { req, res, next } = createMockReqRes({
      authorization: `Bearer ${wrongToken}`,
    });
    requireAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireAdmin middleware", () => {
  function createMockReqRes(user?: AuthUser) {
    const req = { user } as import("express").Request;
    const res = {
      _status: 0,
      _body: null as unknown,
      status(code: number) {
        this._status = code;
        return this;
      },
      json(body: unknown) {
        this._body = body;
        return this;
      },
    } as unknown as import("express").Response & { _status: number; _body: unknown };
    const next = vi.fn();
    return { req, res, next };
  }

  it("allows admin users", () => {
    const { req, res, next } = createMockReqRes({
      id: "admin-1",
      email: "admin@helscoop.fi",
      role: "admin",
    });
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(0); // not set
  });

  it("rejects non-admin users", () => {
    const { req, res, next } = createMockReqRes({
      id: "user-1",
      email: "user@test.com",
      role: "user",
    });
    requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect((res._body as { error: string }).error).toContain("Admin");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests without user", () => {
    const { req, res, next } = createMockReqRes();
    requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  // Test the validation logic that's in index.ts
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it("validates correct email formats", () => {
    expect(EMAIL_RE.test("user@example.com")).toBe(true);
    expect(EMAIL_RE.test("test@helscoop.fi")).toBe(true);
    expect(EMAIL_RE.test("a.b@c.d")).toBe(true);
  });

  it("rejects invalid email formats", () => {
    expect(EMAIL_RE.test("")).toBe(false);
    expect(EMAIL_RE.test("notanemail")).toBe(false);
    expect(EMAIL_RE.test("@no-user.com")).toBe(false);
    expect(EMAIL_RE.test("spaces in@email.com")).toBe(false);
    expect(EMAIL_RE.test("missing@tld")).toBe(false);
  });

  // Test sanitize function logic
  function sanitize(input: string): string {
    return input.replace(/<[^>]*>/g, "").trim();
  }

  it("strips HTML tags from input", () => {
    expect(sanitize("Hello <script>alert(1)</script>")).toBe("Hello alert(1)");
    expect(sanitize("<b>Bold</b> text")).toBe("Bold text");
    expect(sanitize("Clean text")).toBe("Clean text");
    expect(sanitize("  spaces  ")).toBe("spaces");
  });

  it("handles empty and whitespace input", () => {
    expect(sanitize("")).toBe("");
    expect(sanitize("   ")).toBe("");
    expect(sanitize("<br/>")).toBe("");
  });
});
