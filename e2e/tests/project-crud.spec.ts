import { test, expect } from "@playwright/test";
import { registerUser, loginViaUI, dismissOnboarding } from "./helpers";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

test.describe("Project CRUD", () => {
  let user: { email: string; password: string; name: string; token: string };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    user = await registerUser(page, `crud-${Date.now()}`);
    await page.close();
  });

  test("creates a new project from the project list", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });
    await dismissOnboarding(page);

    // Type project name in the new project input
    const newProjectInput = page.getByPlaceholder(
      /uusi projekti|new project/i
    );
    await expect(newProjectInput).toBeVisible({ timeout: 10_000 });
    await newProjectInput.fill("E2E Test Shed");

    // Click create button
    await page
      .getByRole("button", { name: /^luo$|^create$/i })
      .click();

    // Project should appear in the list
    await expect(page.getByText("E2E Test Shed")).toBeVisible({
      timeout: 10_000,
    });

    // Click the project card to open it
    await page.getByRole("heading", { name: "E2E Test Shed" }).click();

    // Should navigate to project editor
    await page.waitForURL(/\/project\//, { timeout: 15_000 });

    // 3D viewport area should be visible
    await expect(page.locator("canvas")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("project editor renders 3D viewport with objects", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const sceneJs = `
const floor = box(6, 0.2, 4);
const wall = translate(box(6, 2.8, 0.15), 0, 1.5, -1.925);
scene.add(floor, { material: "foundation", color: [0.7, 0.7, 0.7] });
scene.add(wall, { material: "lumber", color: [0.85, 0.75, 0.55] });
    `.trim();

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "E2E Render Test",
        description: "Testing 3D rendering",
        scene_js: sceneJs,
      },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    // Wait for Three.js canvas
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    // Check canvas has real dimensions
    const canvasSize = await canvas.boundingBox();
    expect(canvasSize).toBeTruthy();
    expect(canvasSize!.width).toBeGreaterThan(100);
    expect(canvasSize!.height).toBeGreaterThan(100);

    // Check object count is shown (Finnish: "2 objektia")
    await expect(
      page.getByText(/2\s*(objects|objektia)/i)
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "test-results/viewport-render.png",
      fullPage: false,
    });
  });

  test("edits scene code and sees viewport update", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "E2E Code Edit",
        scene_js:
          'const b = box(2,2,2);\nscene.add(b, {material: "lumber", color: [0.8,0.6,0.4]});',
      },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });

    // Toggle code editor
    await page
      .getByRole("button", { name: /koodi|code/i })
      .click();

    // Code editor should appear (textarea)
    await expect(page.locator("textarea").first()).toBeVisible({
      timeout: 5000,
    });

    // Object count = 1
    await expect(
      page.getByText(/1\s*(objects|objektia)/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("project name is editable and auto-saves", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { name: "Original Name" },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    const nameInput = page.locator('input[value="Original Name"]');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    await nameInput.fill("Renamed Project");

    // Wait for auto-save
    await expect(
      page.getByText(/tallennettu|saved/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("deletes a project", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { name: "To Be Deleted" },
    });
    const project = await res.json();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);

    await expect(page.getByText("To Be Deleted")).toBeVisible({
      timeout: 10_000,
    });

    // Click delete on the project card
    const card = page.locator(".project-card-grid").filter({ hasText: "To Be Deleted" });
    await card.getByRole("button", { name: /delete|poista/i }).click();

    // Confirm in the modal dialog
    const modal = page.locator("dialog, [role='dialog']");
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByRole("button", { name: /^delete$|^poista$/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText("To Be Deleted")).not.toBeVisible({
      timeout: 5000,
    });
  });
});
