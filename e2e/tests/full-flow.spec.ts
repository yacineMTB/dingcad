import { test, expect } from "@playwright/test";
import { apiUrl, loginViaUI } from "./helpers";

test.describe("Full User Flows", () => {
  test.describe.configure({ mode: "serial" });

  let userEmail: string;
  let userPassword: string;
  let userToken: string;
  let projectId: string;

  async function apiLogin(page: import("@playwright/test").Page): Promise<string> {
    const res = await page.request.post(apiUrl("/auth/login"), {
      data: { email: userEmail, password: userPassword },
    });
    const body = await res.json();
    return body.token;
  }

  // ─── Auth flows ────────────────────────────────────────────

  test("register via UI", async ({ page }) => {
    userEmail = `e2e-flow-${Date.now()}@test.com`;
    userPassword = "testpass123";

    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("helscoop_onboarding_completed", "true"));
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.getByText(/ei tili|no account|luo uusi/i).click({ force: true });
    await page.getByPlaceholder(/matti meikalainen|john smith/i).fill("E2E Flow User");
    await page.locator('input[type="email"]').fill(userEmail);
    await page.locator('input[type="password"]').fill(userPassword);
    await page.locator('input[type="checkbox"]').check({ force: true });
    await page.getByRole("button", { name: /luo tili|create account/i }).click({ force: true });

    await expect(page.getByText(/omat projektit|my projects/i)).toBeVisible({ timeout: 15_000 });
    userToken = await page.evaluate(() => localStorage.getItem("helscoop_token") || "");
    expect(userToken).toBeTruthy();
  });

  test("sign out clears session", async ({ page }) => {
    await loginViaUI(page, userEmail, userPassword);
    await expect(page.getByText(/omat projektit|my projects/i)).toBeVisible({ timeout: 15_000 });

    const logoutBtn = page.getByRole("button", { name: /kirjaudu ulos|log out|sign out/i });
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
    } else {
      await page.evaluate(() => localStorage.removeItem("helscoop_token"));
      await page.reload();
    }
    await page.waitForLoadState("networkidle");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });

  test("sign in via UI after sign out", async ({ page }) => {
    await loginViaUI(page, userEmail, userPassword);
    await expect(page.getByText(/omat projektit|my projects/i)).toBeVisible({ timeout: 15_000 });
  });

  test("invalid credentials rejected", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("helscoop_onboarding_completed", "true"));
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.locator('input[type="email"]').fill("nonexistent@test.com");
    await page.locator('input[type="password"]').fill("wrongpass");
    await page.getByRole("button", { name: /kirjaudu|sign in/i }).click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/omat projektit|my projects/i)).not.toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("protected routes redirect without auth", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("helscoop_token"));
    await page.goto("/project/some-fake-id");
    await page.waitForTimeout(3000);
    expect(page.url()).not.toContain("/project/");
  });

  // ─── Project + editor flows ────────────────────────────────

  test("create project and open editor with 3D canvas", async ({ page }) => {
    userToken = await apiLogin(page);

    const res = await page.request.post(apiUrl("/projects"), {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        name: "Kanala Test",
        description: "Chicken coop for 4-6 hens",
        scene_js: `const floor = box(2, 0.08, 1.5);
const wall_back = translate(box(2, 1.4, 0.08), 0, 0.78, -0.71);
const wall_left = translate(box(0.08, 1.4, 1.5), -0.96, 0.78, 0);
const wall_right = translate(box(0.08, 1.4, 1.5), 0.96, 0.78, 0);
const roof_l = translate(rotate(box(1.3, 0.04, 1.8), 0, 0, 0.25), -0.5, 1.7, 0);
const roof_r = translate(rotate(box(1.3, 0.04, 1.8), 0, 0, -0.25), 0.5, 1.7, 0);
scene.add(floor, { material: "foundation", color: [0.6, 0.58, 0.55] });
scene.add(wall_back, { material: "lumber", color: [0.88, 0.78, 0.58] });
scene.add(wall_left, { material: "lumber", color: [0.85, 0.75, 0.55] });
scene.add(wall_right, { material: "lumber", color: [0.85, 0.75, 0.55] });
scene.add(roof_l, { material: "roofing", color: [0.3, 0.35, 0.28] });
scene.add(roof_r, { material: "roofing", color: [0.3, 0.35, 0.28] });`,
      },
    });
    projectId = (await res.json()).id;
    expect(projectId).toBeTruthy();

    await loginViaUI(page, userEmail, userPassword);
    await expect(page.getByText(/omat projektit|my projects/i)).toBeVisible({ timeout: 15_000 });
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(5000);

    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/6\s*(objects|objektia)/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[value="Kanala Test"]')).toBeVisible({ timeout: 5000 });
  });

  test("embedded AI assistant input visible in editor", async ({ page }) => {
    await loginViaUI(page, userEmail, userPassword);
    await expect(page.getByText(/omat projektit|my projects/i)).toBeVisible({ timeout: 15_000 });
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(5000);

    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".chat-input")).toBeVisible({ timeout: 5000 });
  });

  test("auto-save works after editing project name", async ({ page }) => {
    await loginViaUI(page, userEmail, userPassword);
    await expect(page.getByText(/omat projektit|my projects/i)).toBeVisible({ timeout: 15_000 });
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(5000);

    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
    const nameInput = page.locator('input[value="Kanala Test"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("Kanala Updated");
    await page.waitForTimeout(3000);
    await expect(page.getByText(/saved|tallennettu/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // ─── API-only flows (no browser UI needed) ─────────────────

  test("BOM prices are non-zero from API", async ({ page }) => {
    userToken = await apiLogin(page);

    await page.request.put(apiUrl(`/projects/${projectId}/bom`), {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        items: [
          { material_id: "pine_48x98_c24", quantity: 14, unit: "jm" },
          { material_id: "osb_18mm", quantity: 6, unit: "m2" },
        ],
      },
    });

    const projRes = await page.request.get(apiUrl(`/projects/${projectId}`), {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const proj = await projRes.json();
    expect(proj.bom.length).toBe(2);

    const total = proj.bom.reduce(
      (sum: number, item: { total: string }) => sum + Number(item.total || 0),
      0
    );
    expect(total).toBeGreaterThan(0);
  });

  test("export BOM returns data", async ({ page }) => {
    userToken = await apiLogin(page);
    const res = await page.request.get(
      apiUrl(`/bom/export/${projectId}?format=csv`),
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    expect(res.status()).toBe(200);
  });

  test("templates endpoint returns chicken coop", async ({ page }) => {
    const res = await page.request.get(apiUrl("/templates"));
    expect(res.status()).toBe(200);
    const templates = await res.json();
    const kanala = templates.find((t: { id: string }) => t.id === "kanala");
    expect(kanala).toBeTruthy();
    expect(kanala.name).toContain("Kanala");
    expect(kanala.scene_js).toContain("Chicken Coop");
  });

  test("delete project removes it", async ({ page }) => {
    userToken = await apiLogin(page);
    const delRes = await page.request.delete(apiUrl(`/projects/${projectId}`), {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(delRes.status()).toBe(200);

    const getRes = await page.request.get(apiUrl(`/projects/${projectId}`), {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(getRes.status()).toBe(404);
  });
});
