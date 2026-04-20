import { test, expect } from "@playwright/test";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

test.describe("Authentication", () => {
  const testPassword = "testpass123";

  test("home page loads with login form and address search", async ({
    page,
  }) => {
    await page.goto("/");
    // Dismiss onboarding if present
    await page.evaluate(() => {
      localStorage.setItem("helscoop_onboarding_completed", "true");
    });
    await page.reload();

    await expect(page).toHaveTitle(/helscoop/i);
    await expect(page.locator('[data-tour="address-input"] input')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("registers a new user through the UI", async ({ page }) => {
    const testEmail = `e2e-reg-${Date.now()}@test.com`;

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("helscoop_onboarding_completed", "true");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Switch to register mode (force click to bypass any overlay)
    await page.getByText(/ei tili|no account|luo uusi/i).click({ force: true });

    // Fill registration form
    await page.getByPlaceholder(/matti meikalainen|john smith/i).fill("E2E Auth Test");
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);

    // Accept terms
    await page.locator('input[type="checkbox"]').check({ force: true });

    // Submit
    await page.getByRole("button", { name: /luo tili|create account/i }).click({ force: true });

    // Should be logged in — project list visible
    await expect(
      page.getByText(/omat projektit|my projects/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("logs in with valid credentials", async ({ page }) => {
    const email = `e2e-login-${Date.now()}@test.com`;
    await page.request.post(`${API_URL}/auth/register`, {
      data: { email, password: testPassword, name: "Login Test" },
    });

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("helscoop_onboarding_completed", "true");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(testPassword);

    await page.getByRole("button", { name: /kirjaudu|sign in/i }).click({ force: true });

    await expect(
      page.getByText(/omat projektit|my projects/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("rejects invalid credentials — shows error without page reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("helscoop_onboarding_completed", "true");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.locator('input[type="email"]').fill("nonexistent@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword");

    let navigated = false;
    page.on("load", () => { navigated = true; });

    await page.getByRole("button", { name: /kirjaudu|sign in/i }).click({ force: true });

    // Error message should appear inline
    const errorBanner = page.locator(".anim-up").filter({
      has: page.locator("text=/invalid|wrong|incorrect|virheellinen|väärä|failed|epäonnistui/i"),
    });
    await expect(errorBanner.first()).toBeVisible({ timeout: 5_000 });

    // Login form should still be visible — no redirect
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Should NOT have navigated (page reload = bug)
    expect(navigated).toBe(false);

    // Should NOT show projects list
    await expect(
      page.getByText(/omat projektit|my projects/i)
    ).not.toBeVisible();
  });

  test("persists login across page reload", async ({ page }) => {
    const email = `e2e-persist-${Date.now()}@test.com`;
    const res = await page.request.post(`${API_URL}/auth/register`, {
      data: { email, password: testPassword, name: "Persist Test" },
    });
    const { token } = await res.json();

    await page.goto("/");
    await page.evaluate((t) => {
      localStorage.setItem("helscoop_token", t);
      localStorage.setItem("helscoop_onboarding_completed", "true");
    }, token);
    await page.reload();

    await expect(
      page.getByText(/omat projektit|my projects/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
