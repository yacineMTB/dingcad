import { type Page } from "@playwright/test";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

export interface TestUser {
  email: string;
  password: string;
  name: string;
  token: string;
}

export async function registerUser(
  page: Page,
  suffix = Date.now().toString()
): Promise<TestUser> {
  const user = {
    email: `e2e-${suffix}@test.com`,
    password: "testpass123",
    name: "E2E Tester",
    token: "",
  };

  const res = await page.request.post(`${API_URL}/auth/register`, {
    data: { email: user.email, password: user.password, name: user.name },
  });
  const body = await res.json();
  user.token = body.token;
  return user;
}

export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<string> {
  const res = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  const body = await res.json();
  return body.token;
}

export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.goto("/");
  await page.evaluate((t) => {
    localStorage.setItem("helscoop_token", t);
    localStorage.setItem("helscoop_onboarding_completed", "true");
  }, token);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const isLoggedIn = await page
    .getByText(/omat projektit|my projects/i)
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!isLoggedIn) {
    const hasLoginForm = await page
      .locator('input[type="email"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasLoginForm) {
      await page.evaluate((t) => {
        localStorage.setItem("helscoop_token", t);
      }, token);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }
  }
}

export async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("helscoop_onboarding_completed", "true");
  });
  await page.reload();
  await page.waitForLoadState("networkidle");

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /kirjaudu|sign in/i }).click({ force: true });
}

export async function createProjectViaAPI(
  page: Page,
  token: string,
  data: { name: string; description?: string; scene_js?: string }
): Promise<string> {
  const res = await page.request.post(`${API_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  const body = await res.json();
  return body.id;
}

export async function saveBomViaAPI(
  page: Page,
  token: string,
  projectId: string,
  items: { material_id: string; quantity: number; unit: string }[]
): Promise<void> {
  await page.request.put(`${API_URL}/projects/${projectId}/bom`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { items },
  });
}

export async function deleteProjectViaAPI(
  page: Page,
  token: string,
  projectId: string
): Promise<void> {
  await page.request.delete(`${API_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export async function dismissOnboarding(page: Page): Promise<void> {
  const skipBtn = page.getByText(/ohita|skip/i).first();
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(300);
  }
}
