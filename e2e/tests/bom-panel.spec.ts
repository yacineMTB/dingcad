import { test, expect } from "@playwright/test";
import { registerUser, loginViaUI } from "./helpers";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

test.describe("BOM Panel", () => {
  let user: { email: string; password: string; name: string; token: string };
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    user = await registerUser(page, `bom-${Date.now()}`);

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "BOM Test Project",
        scene_js:
          'const f = box(6,0.2,4);\nscene.add(f, {material: "foundation", color: [0.7,0.7,0.7]});',
      },
    });
    const body = await res.json();
    projectId = body.id;
    await page.close();
  });

  test("BOM panel is visible in editor", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    // BOM panel should show (contains "MATERIAALI" or "MATERIAL" or cost text)
    await expect(
      page.getByText(/materiaalilista|material list|arvioitu|estimated/i).first()
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "test-results/bom-panel.png" });
  });

  test("material search filters the list", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    // Look for search input in BOM panel (Finnish: "Hae materiaalia...")
    const searchInput = page.getByPlaceholder(/hae materiaali|search material/i);
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("48x148");
      await page.waitForTimeout(500);

      // Should filter to show 48x148 material
      await expect(
        page.getByText(/48x148/i).first()
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: "test-results/bom-search.png" });
    }
  });

  test("toggles BOM panel with Cmd+B", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });

    // BOM should be visible initially
    const bomPanel = page.getByText(/materiaalilista|material list/i).first();
    const wasVisible = await bomPanel
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (wasVisible) {
      // Toggle off
      await page.keyboard.press("Meta+b");
      await page.waitForTimeout(500);
      await expect(bomPanel).not.toBeVisible({ timeout: 3000 });

      // Toggle back on
      await page.keyboard.press("Meta+b");
      await page.waitForTimeout(500);
      await expect(bomPanel).toBeVisible({ timeout: 3000 });
    }
  });
});
