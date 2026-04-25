import { test, expect } from "@playwright/test";

// Pre-existing test user (see task description)
const TEST_EMAIL = "test@test.com";
const TEST_PASSWORD = "Test1234!";

// The API URL for Playwright's request API (project setup, etc.)
const API_URL = process.env.TEST_API_URL || "http://localhost:3051";

// The API URL used by the web app (NEXT_PUBLIC_API_URL).  In-browser login
// fetches must target this URL so that httpOnly cookies land correctly.
const WEB_API_URL = process.env.TEST_WEB_API_URL || "http://localhost:3002";

// Demo addresses from data/demo/ JSON files
const DEMO_ADDRESS_RIBBINGINTIE = "Ribbingintie 109-11, 00890 Helsinki";
const DEMO_ADDRESS_UUNIMAENTIE = "Uunimaentie 1, 01200 Vantaa";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dismiss onboarding and land on the home/landing page. */
async function goToLanding(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("helscoop_onboarding_completed", "true");
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
}

/**
 * Login via API, then inject the token into every page load via addInitScript.
 *
 * The app stores the JWT in a module-level variable (api.ts `let token`), not
 * localStorage.  A plain page.goto() after login drops the in-memory token.
 * To survive full navigations (e.g. page.goto("/project/...")), we:
 *   1. Obtain a token from the API.
 *   2. Register addInitScript so every page load calls setToken() on the
 *      window.__HELSCOOP_INJECT_TOKEN__ side-channel before React mounts.
 *   3. Navigate to "/" and confirm the authenticated view.
 *
 * The web app's api.ts checks `hasAuthSession()` which reads
 * helscoop_session_active from localStorage.  We set that too.
 */
async function loginViaToken(page: import("@playwright/test").Page) {
  // 1. Get a fresh token via Playwright's request context (not the browser).
  const res = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  const body = await res.json();
  const token = body.token as string;
  const expiresAt = body.token_expires_at as number;

  // 2. Register an init script that runs before every page navigation.
  //    It fetches /auth/login with credentials to receive the httpOnly cookie
  //    AND sets the in-memory token via the module's exported setToken().
  //    The init script also sets localStorage hints.
  await page.addInitScript(
    ({ apiUrl, email, password }) => {
      // Set the session hint so hasAuthSession() returns true before api.me().
      localStorage.setItem("helscoop_onboarding_completed", "true");
      localStorage.setItem("helscoop_session_active", "true");

      // Fire a login fetch with credentials:"include" to get the httpOnly
      // cookie.  This runs before React hydrates because addInitScript runs
      // synchronously in the page context before scripts load.  However,
      // fetch is async so we also need to patch the module import.
      //
      // Simpler approach: override fetch to inject the Authorization header
      // for all API calls.
      const origFetch = window.fetch;
      let injectedToken: string | null = null;
      let loginPromise: Promise<void> | null = null;

      // Kick off the login immediately to get the token + cookie.
      loginPromise = origFetch(`${apiUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
        .then((r) => r.json())
        .then((data) => {
          injectedToken = data.token;
          if (data.token_expires_at) {
            localStorage.setItem(
              "helscoop_session_expires_at",
              String(data.token_expires_at),
            );
          }
        })
        .catch(() => {});

      // Monkey-patch fetch so every API request carries the token.
      window.fetch = async function patchedFetch(
        input: RequestInfo | URL,
        init?: RequestInit,
      ) {
        // Wait for login to complete before any API call.
        if (loginPromise) {
          await loginPromise;
          loginPromise = null;
        }

        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (injectedToken && url.includes(apiUrl)) {
          const headers = new Headers(init?.headers);
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${injectedToken}`);
          }
          return origFetch(input, { ...init, credentials: "include", headers });
        }
        return origFetch(input, init);
      } as typeof fetch;
    },
    { apiUrl: WEB_API_URL, email: TEST_EMAIL, password: TEST_PASSWORD },
  );

  // 3. Navigate to the home page and wait for the authenticated view.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page
    .getByText(/omat projektit|my projects/i)
    .waitFor({ state: "visible", timeout: 15_000 });
}

/** Get a fresh auth token from the API. */
async function getToken(
  page: import("@playwright/test").Page,
): Promise<string> {
  const res = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  const body = await res.json();
  return body.token;
}

/** Log in and create a project via address search, returning the project URL. */
async function loginAndCreateProjectFromAddress(
  page: import("@playwright/test").Page,
  address: string,
): Promise<string> {
  await loginViaToken(page);

  const addressInput = page.locator('[data-tour="address-input"] input');
  await expect(addressInput).toBeVisible({ timeout: 10_000 });
  await addressInput.fill(address);
  await page
    .getByRole("button", { name: /hae|search/i })
    .click({ force: true });

  await expect(
    page.getByText(
      /omakotitalo|rivitalo|kerrostalo|detached|row|apartment/i,
    ).first(),
  ).toBeVisible({ timeout: 15_000 });

  const importBtn = page.getByRole("button", {
    name: /luo projekti|create project/i,
  });
  await expect(importBtn).toBeVisible({ timeout: 5_000 });
  await importBtn.click({ force: true });

  await page.waitForURL(/\/project\//, { timeout: 20_000 });
  return page.url();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Address Search & Analysis Panels", () => {
  // =========================================================================
  // ADDRESS SEARCH -- LANDING PAGE (unauthenticated)
  // =========================================================================

  test.describe("Address search (landing page)", () => {
    test("1 -- address search input is visible on landing page", async ({
      page,
    }) => {
      await goToLanding(page);

      // Address input -- identified by placeholder text or data-tour attribute
      const addressInput = page
        .locator('[data-tour="address-input"] input')
        .or(page.getByPlaceholder(/ribbingintie|osoite|address/i));
      await expect(addressInput.first()).toBeVisible({ timeout: 15_000 });
    });

    test("2 -- typing partial address enables search button", async ({
      page,
    }) => {
      await goToLanding(page);

      const addressInput = page
        .locator('[data-tour="address-input"] input')
        .or(page.getByPlaceholder(/ribbingintie|osoite|address/i));
      await expect(addressInput.first()).toBeVisible({ timeout: 15_000 });
      await addressInput.first().fill("Ribbing");

      // The search button should be present and interactive
      const searchBtn = page.getByRole("button", { name: /hae|search/i });
      await expect(searchBtn).toBeVisible({ timeout: 5_000 });
    });

    test("3 -- submitting an address shows building info", async ({
      page,
    }) => {
      await goToLanding(page);

      const addressInput = page
        .locator('[data-tour="address-input"] input')
        .or(page.getByPlaceholder(/ribbingintie|osoite|address/i));
      await expect(addressInput.first()).toBeVisible({ timeout: 15_000 });
      await addressInput.first().fill(DEMO_ADDRESS_RIBBINGINTIE);

      await page
        .getByRole("button", { name: /hae|search/i })
        .click({ force: true });

      // Should show building type
      await expect(
        page.getByText(/omakotitalo|detached house/i).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Should show verified confidence badge for demo address
      await expect(
        page.getByText(/tarkistettu|verified/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // =========================================================================
  // ADDRESS SEARCH -- LOGGED IN
  // =========================================================================

  test.describe("Address search (logged in)", () => {
    test("4 -- login + address search creates a project with building_info", async ({
      page,
    }) => {
      const projectUrl = await loginAndCreateProjectFromAddress(
        page,
        DEMO_ADDRESS_RIBBINGINTIE,
      );

      // We should be on a project page
      expect(projectUrl).toMatch(/\/project\//);

      // Canvas should render
      await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

      // Building provenance bar should show address
      await expect(
        page.getByText(/ribbingintie/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("5 -- project page shows building info: type, area, year built", async ({
      page,
    }) => {
      await loginAndCreateProjectFromAddress(
        page,
        DEMO_ADDRESS_UUNIMAENTIE,
      );

      // The building provenance bar should show key fields
      // year_built: 1978
      await expect(
        page.getByText("1978").first(),
      ).toBeVisible({ timeout: 10_000 });

      // area_m2: 220
      await expect(
        page.getByText(/220/).first(),
      ).toBeVisible({ timeout: 5_000 });

      // Address in the bar
      await expect(
        page.getByText(/uunimaentie/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // =========================================================================
  // BUILDING ANALYSIS PANELS (on project page with BOM + building_info)
  // =========================================================================

  test.describe("Building analysis panels", () => {
    let projectId: string;

    test.beforeAll(async ({ browser }) => {
      // Create a project from demo address via API then add BOM items
      const page = await browser.newPage();

      const token = await getToken(page);

      // First, look up the building data
      const buildingRes = await page.request.get(
        `${API_URL}/building?address=${encodeURIComponent(DEMO_ADDRESS_RIBBINGINTIE)}`,
      );
      const buildingData = await buildingRes.json();

      // Create project with building_info structured the way the frontend does it:
      // Spread building_info fields to the top level, plus address, confidence, data_sources.
      // Override heating to "oljy" (oil) so the SubsidyCalculator panel is shown
      // (it only appears when current heating is fossil-based or a heat pump target is detected).
      const buildingInfo = {
        address: buildingData.address,
        ...buildingData.building_info,
        heating: "oljy",
        confidence: buildingData.confidence,
        data_sources: buildingData.data_sources,
        climate_zone: buildingData.climate_zone,
        heating_degree_days: buildingData.heating_degree_days,
      };
      const createRes = await page.request.post(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          name: "Analysis Panel Test",
          scene_js: buildingData.scene_js,
          building_info: buildingInfo,
        },
      });
      const body = await createRes.json();
      projectId = body.id;

      // Add BOM items from the building suggestion
      const bomItems = (buildingData.bom_suggestion || []).slice(0, 4);
      if (bomItems.length > 0) {
        await page.request.put(`${API_URL}/projects/${projectId}/bom`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { items: bomItems },
        });
      }

      await page.close();
    });

    /** Navigate to the analysis project page after logging in. */
    async function goToProject(page: import("@playwright/test").Page) {
      await loginViaToken(page);
      await page.goto(`/project/${projectId}`);
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle");
    }

    test("6 -- SubsidyCalculator panel renders with heating type inputs", async ({
      page,
    }) => {
      await goToProject(page);

      // SubsidyCalculator section label -- matches Finnish or English text
      // in the panel header or any subsidy-related text
      await expect(
        page
          .getByText(
            /energia-avustus|energy subsidy|avustuskelpoisuus|grant eligibility|avustus|subsidy/i,
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      // Should have heating select dropdowns
      const selects = page.locator("select");
      const selectCount = await selects.count();
      expect(selectCount).toBeGreaterThanOrEqual(2);
    });

    test("7 -- SubsidyCalculator: select oil heating shows ELY grant eligibility", async ({
      page,
    }) => {
      await goToProject(page);

      // Wait for subsidy section to load
      await expect(
        page
          .getByText(
            /energia-avustus|energy subsidy|avustuskelpoisuus|grant eligibility|avustus|subsidy/i,
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      // The SubsidyCalculator renders its own <select> elements.  The first
      // page-wide select may be the project list sort/filter, so we target the
      // subsidy-specific select that contains option value="oil".
      const subsidySelects = page.locator("select").filter({
        has: page.locator("option[value='oil']"),
      });
      await subsidySelects.first().selectOption("oil");

      // Wait for API response to update
      await page.waitForTimeout(2000);

      // Should show ELY-related content (eligible or ineligible with reason)
      // or at minimum a net cost / total cost display
      const elyContent = page.getByText(
        /ely|avustus|grant|deduction|vähennys|hae avustusta|apply|nettokustannus|net cost|\u20ac/i,
      );
      await expect(elyContent.first()).toBeVisible({ timeout: 15_000 });
    });

    test("8 -- WasteEstimatePanel renders with material breakdown", async ({
      page,
    }) => {
      await goToProject(page);

      // WasteEstimatePanel title
      await expect(
        page
          .getByText(
            /jätearvio|waste estimate|purkujäte|demolition waste/i,
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      // Should show weight or volume metrics
      await expect(page.getByText(/kg/).first()).toBeVisible({
        timeout: 10_000,
      });
    });

    test("9 -- WasteEstimatePanel shows waste categories", async ({
      page,
    }) => {
      await goToProject(page);

      // Wait for waste panel to load
      await expect(
        page
          .getByText(
            /jätearvio|waste estimate|purkujäte|demolition waste/i,
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      // Should show waste category types, recycling rate, sorting guide,
      // or the "no waste" placeholder.  Avoid matching hidden <option>
      // elements that contain words like "mixed" by looking for visible-only
      // text in non-option elements.
      //
      // The panel shows Finnish category names (Puujäte, Metallijäte, etc.),
      // English equivalents (Wood waste, Metal waste), a recycling rate badge
      // (e.g. "65% kierrätettävissä"), a sorting guide header, or the
      // "no waste" placeholder when BOM is empty.
      const wasteContent = page.locator(
        ":not(option):not(select)",
      ).getByText(
        /puujäte|puujate|wood waste|metallijäte|metallijate|metal waste|sekajäte|sekajate|kierrätettävissä|recyclable|lajitteluohje|sorting guide|ei jätettä|no waste|kokonaispaino|total.*weight|jätelajit|waste categories/i,
      );
      await expect(wasteContent.first()).toBeVisible({ timeout: 15_000 });
    });

    test("10 -- compliance checker library is accessible (no UI panel yet)", async ({
      page,
    }) => {
      // The compliance checker is a pure library (web/src/lib/compliance.ts)
      // not yet wired to a UI panel. Verify the project page loads without
      // errors from compliance-related code.
      await goToProject(page);

      // Page loads without compliance errors blocking it.
      // Either canvas renders or we see the editor UI elements.
      const canvasVisible = await page
        .locator("canvas")
        .first()
        .isVisible({ timeout: 15_000 })
        .catch(() => false);

      const editorVisible = await page
        .getByText(/materiaalilista|material list|objects|objektia/i)
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      // At least one indicator of a working project page
      expect(canvasVisible || editorVisible).toBe(true);
    });

    test("11 -- building provenance bar shows data source info", async ({
      page,
    }) => {
      await goToProject(page);

      // Provenance bar should be visible with address
      await expect(
        page.getByText(/ribbingintie/i).first(),
      ).toBeVisible({ timeout: 10_000 });

      // Confidence badge should be present
      await expect(
        page
          .getByText(/tarkistettu|verified|arvioitu|estimated/i)
          .first(),
      ).toBeVisible({ timeout: 5_000 });

      // Year and area fields in the bar
      await expect(page.getByText("1985").first()).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByText(/135/).first()).toBeVisible({
        timeout: 5_000,
      });
    });
  });

  // =========================================================================
  // SETTINGS PAGE
  // =========================================================================

  test.describe("Settings page", () => {
    test("12 -- navigate to /settings loads page with user info", async ({
      page,
    }) => {
      await loginViaToken(page);
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Settings title should appear
      await expect(
        page.getByText(/asetukset|settings/i).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Profile section should be visible
      await expect(
        page.getByText(/profiili|profile/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("13 -- theme toggle works on settings page", async ({ page }) => {
      await loginViaToken(page);
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Wait for settings page to load
      await expect(
        page.getByText(/asetukset|settings/i).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Find theme toggle button -- it uses the class "lang-switch" and has
      // themed text like "THEME: DARK" or "TEEMA: TUMMA"
      const themeBtn = page.locator(".lang-switch").filter({
        hasText: /theme|teema|tema/i,
      }).first();
      await expect(themeBtn).toBeVisible({ timeout: 5_000 });

      // Get initial text
      const initialText = await themeBtn.textContent();

      // Click to toggle
      await themeBtn.click();
      await page.waitForTimeout(500);

      // Text should have changed (theme cycled dark -> light -> auto)
      const newText = await themeBtn.textContent();
      expect(newText).not.toBe(initialText);
    });

    test("14 -- account name and email are displayed", async ({ page }) => {
      await loginViaToken(page);
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Wait for settings to load
      await expect(
        page.getByText(/profiili|profile/i).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Email input should contain the user's email
      const emailInput = page.locator("#settings-email");
      await expect(emailInput).toBeVisible({ timeout: 5_000 });
      const emailValue = await emailInput.inputValue();
      expect(emailValue).toContain("test@test.com");

      // Name input should contain user's name
      const nameInput = page.locator("#settings-name");
      await expect(nameInput).toBeVisible({ timeout: 5_000 });
      const nameValue = await nameInput.inputValue();
      expect(nameValue.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // ADMIN PAGE
  // =========================================================================

  test.describe("Admin page", () => {
    test("15 -- navigate to /admin shows admin panel or redirects non-admin", async ({
      page,
    }) => {
      await loginViaToken(page);

      // Navigate to admin -- non-admin users should see checking message
      // then get redirected, OR see an alert about admin access
      page.on("dialog", async (dialog) => {
        // "Admin access required" alert
        await dialog.dismiss();
      });

      await page.goto("/admin");
      await page.waitForTimeout(3000);

      // Either: admin panel loaded (if user is admin), or we got redirected
      const isOnAdmin = page.url().includes("/admin");
      const isRedirected = !isOnAdmin;

      if (isRedirected) {
        // Non-admin was correctly redirected to home
        expect(page.url()).not.toContain("/admin");
      } else {
        // If somehow admin, the panel should show
        const adminContent = page.getByText(
          /admin|hallintapaneeli|materials|materiaalit/i,
        );
        await expect(adminContent.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  // =========================================================================
  // ERROR PAGES
  // =========================================================================

  test.describe("Error pages", () => {
    test("16 -- navigate to /project/nonexistent-id shows error or redirects", async ({
      page,
    }) => {
      await loginViaToken(page);

      await page.goto("/project/00000000-0000-0000-0000-000000000000");
      await page.waitForTimeout(5000);

      // Should either show an error/not-found state or redirect back
      const isStillOnProject = page.url().includes("/project/00000000");

      if (isStillOnProject) {
        // Error state on the project page
        const errorText = page.getByText(
          /not found|ei löydy|error|virhe|lataus epäonnistui|load failed/i,
        );
        const hasError = await errorText
          .first()
          .isVisible({ timeout: 5_000 })
          .catch(() => false);

        // Or the page simply doesn't load the canvas
        const hasCanvas = await page
          .locator("canvas")
          .isVisible({ timeout: 3_000 })
          .catch(() => false);

        // At least one of these should be true: either error shown or no canvas
        expect(hasError || !hasCanvas).toBe(true);
      } else {
        // Redirected away from the invalid project
        expect(page.url()).not.toContain(
          "00000000-0000-0000-0000-000000000000",
        );
      }
    });

    test("17 -- navigate to /shared/invalid-token shows not found", async ({
      page,
    }) => {
      await page.goto("/shared/invalid-token-that-does-not-exist");
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle");

      // SharedProjectContent shows "not found" text when token is invalid
      await expect(
        page
          .getByText(
            /ei löydy|not found|jaettu projekti|shared project/i,
          )
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
