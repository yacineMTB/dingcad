import { test, expect } from "@playwright/test";
import { registerUser, loginViaUI } from "./helpers";

test.describe("PDF Export", () => {
  let user: { email: string; password: string; name: string; token: string };
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    user = await registerUser(page, `pdf-${Date.now()}`);

    // Create project with BOM
    const res = await page.request.post("http://localhost:3001/projects", {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "PDF Export Test",
        description: "Testing PDF generation",
        scene_js:
          'const f = box(6,0.2,4);\nscene.add(f, {material: "foundation", color: [0.7,0.7,0.7]});',
      },
    });
    const body = await res.json();
    projectId = body.id;

    // Add BOM items
    await page.request.put(
      `http://localhost:3001/projects/${projectId}/bom`,
      {
        headers: { Authorization: `Bearer ${user.token}` },
        data: {
          items: [
            { material_id: "pine_48x148_c24", quantity: 42, unit: "jm" },
            { material_id: "concrete_c25", quantity: 1.2, unit: "m3" },
          ],
        },
      }
    );
    await page.close();
  });

  test("API returns valid PDF", async ({ page }) => {
    const res = await page.request.get(
      `http://localhost:3001/projects/${projectId}/pdf?lang=fi`,
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");

    const buf = await res.body();
    expect(buf.length).toBeGreaterThan(1000);

    // PDF starts with %PDF-
    const header = buf.slice(0, 5).toString();
    expect(header).toBe("%PDF-");
  });

  test("PDF export button triggers download in editor", async ({ page }) => {
    await loginViaUI(page, user.email, user.password);
    await page.getByText(/omat projektit|my projects/i).waitFor({ state: "visible", timeout: 15000 });
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });

    // Set up download listener
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });

    // Open export dropdown then click PDF
    const exportTrigger = page.locator('[data-tour="export-btn"] button').first();
    await exportTrigger.click();
    await page.waitForTimeout(300);
    const pdfBtn = page.getByRole("button", { name: /^PDF$/i });
    await pdfBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".pdf");
  });
});
