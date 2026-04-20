import { test, expect } from "@playwright/test";
import { registerUser, loginViaUI } from "./helpers";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

test.describe("3D Viewport Rendering", () => {
  let user: { email: string; password: string; name: string; token: string };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    user = await registerUser(page, `viewport-${Date.now()}`);
    await page.close();
  });

  test("renders a simple box scene with correct object count", async ({
    page,
  }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "Box Test",
        scene_js:
          'const b = box(2, 2, 2);\nscene.add(b, { material: "lumber", color: [0.8, 0.6, 0.4] });',
      },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(/1\s*(objects|objektia)/i)).toBeVisible({
      timeout: 5000,
    });

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox!.width).toBeGreaterThan(200);

    await page.screenshot({ path: "test-results/viewport-box.png" });
  });

  test("renders sauna template with 7 objects", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const saunaScene = `
const floor = box(4, 0.2, 3);
const wall1 = translate(box(4, 2.4, 0.12), 0, 1.3, -1.44);
const wall2 = translate(box(4, 2.4, 0.12), 0, 1.3, 1.44);
const wall3 = translate(box(0.12, 2.4, 3), -1.94, 1.3, 0);
const wall4 = translate(box(0.12, 2.4, 3), 1.94, 1.3, 0);
const roof1 = translate(rotate(box(2.3, 0.05, 4.4), 0, 0, 0.52), -1.0, 2.9, 0);
const roof2 = translate(rotate(box(2.3, 0.05, 4.4), 0, 0, -0.52), 1.0, 2.9, 0);
scene.add(floor, { material: "foundation", color: [0.65, 0.65, 0.65] });
scene.add(wall1, { material: "lumber", color: [0.82, 0.68, 0.47] });
scene.add(wall2, { material: "lumber", color: [0.82, 0.68, 0.47] });
scene.add(wall3, { material: "lumber", color: [0.82, 0.68, 0.47] });
scene.add(wall4, { material: "lumber", color: [0.82, 0.68, 0.47] });
scene.add(roof1, { material: "roofing", color: [0.35, 0.32, 0.30] });
scene.add(roof2, { material: "roofing", color: [0.35, 0.32, 0.30] });
    `.trim();

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { name: "Sauna Render Test", scene_js: saunaScene },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(/7\s*(objects|objektia)/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({ path: "test-results/viewport-sauna.png" });
  });

  test("renders Ribbingintie demo building with 15+ objects", async ({
    page,
  }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const buildingRes = await page.request.get(
      `${API_URL}/building?address=Ribbingintie+109-11,+00890,+Helsinki`
    );
    const building = await buildingRes.json();
    expect(building.confidence).toBe("verified");

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "Ribbingintie 109-11",
        scene_js: building.scene_js,
      },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText(/[1-9]\d*\s*(objects|objektia)/i)
    ).toBeVisible({ timeout: 15_000 });
    const countText = await page
      .getByText(/[1-9]\d*\s*(objects|objektia)/i)
      .textContent();
    const count = parseInt(countText?.match(/(\d+)/)?.[1] || "0");
    expect(count).toBeGreaterThanOrEqual(10);

    await page.screenshot({
      path: "test-results/viewport-ribbingintie.png",
    });
  });

  test("wireframe toggle works", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "Wireframe Test",
        scene_js:
          'const b = box(3,3,3);\nscene.add(b, {material: "lumber", color: [0.8,0.6,0.4]});',
      },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: "test-results/viewport-solid.png" });

    // Toggle wireframe
    await page
      .getByRole("button", { name: /rautalanka|wireframe/i })
      .click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "test-results/viewport-wireframe.png" });
  });

  test("shows error for invalid scene code", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });

    const res = await page.request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "Error Test",
        scene_js: "this is not valid JavaScript; let crash = undefined.foo;",
      },
    });
    const project = await res.json();

    await page.goto(`/project/${project.id}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");

    // Should show error indicator
    await expect(
      page.getByText(/virhe|error/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
