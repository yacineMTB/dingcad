import { describe, it, expect, beforeAll } from "vitest";

const API = process.env.API_URL || "http://localhost:3001";

async function apiFetch(path: string, opts?: RequestInit & { token?: string }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

describe.skipIf(!process.env.E2E)("E2E Integration Tests", () => {
  let token: string;
  let projectId: string;
  const testEmail = `e2e-${Date.now()}@test.com`;

  it("health check returns ok", async () => {
    const { status, body } = await apiFetch("/health");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("registers a new user", async () => {
    const { status, body } = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: "testpass123", name: "E2E Test" }),
    });
    expect(status).toBe(201);
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(testEmail);
    token = body.token;
  });

  it("rejects duplicate registration", async () => {
    const { status } = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: "testpass123", name: "Dup" }),
    });
    expect(status).toBe(409);
  });

  it("authenticates with correct credentials", async () => {
    const { status, body } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: "testpass123" }),
    });
    expect(status).toBe(200);
    expect(body.token).toBeTruthy();
  });

  it("rejects invalid credentials", async () => {
    const { status } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: "wrong" }),
    });
    expect(status).toBe(401);
  });

  it("returns user info with valid token", async () => {
    const { status, body } = await apiFetch("/auth/me", { token });
    expect(status).toBe(200);
    expect(body.email).toBe(testEmail);
    expect(body.role).toBe("user");
  });

  it("rejects requests without auth", async () => {
    const { status } = await apiFetch("/auth/me");
    expect(status).toBe(401);
  });

  it("creates a project", async () => {
    const { status, body } = await apiFetch("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "E2E Shed", description: "Test project" }),
      token,
    });
    expect(status).toBe(201);
    expect(body.name).toBe("E2E Shed");
    projectId = body.id;
  });

  it("lists user projects", async () => {
    const { status, body } = await apiFetch("/projects", { token });
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it("gets project detail with BOM", async () => {
    const { status, body } = await apiFetch(`/projects/${projectId}`, { token });
    expect(status).toBe(200);
    expect(body.name).toBe("E2E Shed");
    expect(body.bom).toBeDefined();
  });

  it("updates a project", async () => {
    const { status, body } = await apiFetch(`/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "E2E Shed Updated", description: "Updated", scene_js: "const a = box(1,1,1);" }),
      token,
    });
    expect(status).toBe(200);
    expect(body.name).toBe("E2E Shed Updated");
    expect(body.scene_js).toContain("box(1,1,1)");
  });

  it("duplicates a project", async () => {
    const { status, body } = await apiFetch(`/projects/${projectId}/duplicate`, {
      method: "POST",
      token,
    });
    expect(status).toBe(201);
    expect(body.name).toContain("(copy)");
  });

  it("lists materials with pricing", async () => {
    const { status, body } = await apiFetch("/materials");
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(20);
    const withPricing = body.filter((m: { pricing: unknown[] | null }) => m.pricing?.length);
    expect(withPricing.length).toBeGreaterThanOrEqual(10);
  });

  it("gets categories", async () => {
    const { status, body } = await apiFetch("/categories");
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(10);
    expect(body[0].display_name).toBeTruthy();
  });

  it("lists suppliers", async () => {
    const { status, body } = await apiFetch("/suppliers", { token });
    expect(status).toBe(200);
    expect(body.length).toBe(6);
    const krauta = body.find((s: { name: string }) => s.name === "K-Rauta");
    expect(krauta).toBeTruthy();
    expect(Number(krauta.product_count)).toBeGreaterThan(0);
  });

  it("stale prices requires admin", async () => {
    const { status } = await apiFetch("/pricing/stale", { token });
    expect(status).toBe(403);
  });

  it("stale prices works for admin", async () => {
    const { body: loginBody } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@helscoop.local", password: "admin123" }),
    });
    if (!loginBody.token) return;
    const { status, body } = await apiFetch("/pricing/stale", { token: loginBody.token });
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it("chat endpoint responds", async () => {
    const { status, body } = await apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "add a roof" }],
        currentScene: "scene.add(box(1,1,1), {});",
      }),
      token,
    });
    expect(status).toBe(200);
    expect(body.content).toBeTruthy();
    expect(body.role).toBe("assistant");
  });

  it("exports project as PDF", async () => {
    const res = await fetch(`${API}/projects/${projectId}/pdf?lang=fi`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("looks up demo building with verified confidence", async () => {
    const { status, body } = await apiFetch("/building?address=Ribbingintie+109-11,+00890,+Helsinki");
    expect(status).toBe(200);
    expect(body.confidence).toBe("verified");
    expect(body.scene_js).toContain("box(");
    expect(body.scene_js).toContain("scene.add(");
    expect(body.scene_js).not.toContain("cube(");
    expect(body.bom_suggestion.length).toBeGreaterThanOrEqual(5);
  });

  it("generates generic building with estimated confidence", async () => {
    const { status, body } = await apiFetch("/building?address=Mannerheimintie+42,+Helsinki");
    expect(status).toBe(200);
    expect(body.confidence).toBe("estimated");
    expect(body.scene_js).toContain("box(");
    expect(body.scene_js).not.toContain("cube(");
    expect(body.scene_js).toContain("0.52");
  });

  it("deletes a project", async () => {
    const { status, body } = await apiFetch(`/projects/${projectId}`, {
      method: "DELETE",
      token,
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("confirms project was deleted", async () => {
    const { status } = await apiFetch(`/projects/${projectId}`, { token });
    expect(status).toBe(404);
  });
});
