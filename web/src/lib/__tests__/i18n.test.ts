import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTranslation, detectLocale, persistLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockLocalStorage(data: Record<string, string> = {}) {
  const store: Record<string, string> = { ...data };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

// ---------------------------------------------------------------------------
// 1. Locale detection
// ---------------------------------------------------------------------------

describe("detectLocale", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  it("returns 'fi' when running on the server (no window)", () => {
    vi.stubGlobal("window", undefined);
    expect(detectLocale()).toBe("fi");
  });

  it("returns stored locale 'en' from localStorage", () => {
    const ls = mockLocalStorage({ helscoop_locale: "en" });
    vi.stubGlobal("window", { localStorage: ls, navigator: { language: "fi-FI" } });
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("navigator", { language: "fi-FI" });
    expect(detectLocale()).toBe("en");
  });

  it("returns stored locale 'fi' from localStorage", () => {
    const ls = mockLocalStorage({ helscoop_locale: "fi" });
    vi.stubGlobal("window", { localStorage: ls, navigator: { language: "en-US" } });
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(detectLocale()).toBe("fi");
  });

  it("ignores invalid stored locale and falls back to browser language", () => {
    const ls = mockLocalStorage({ helscoop_locale: "de" });
    vi.stubGlobal("window", { localStorage: ls, navigator: { language: "en-GB" } });
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("navigator", { language: "en-GB" });
    expect(detectLocale()).toBe("en");
  });

  it("detects 'en' from browser language 'en-US'", () => {
    const ls = mockLocalStorage();
    vi.stubGlobal("window", { localStorage: ls, navigator: { language: "en-US" } });
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(detectLocale()).toBe("en");
  });

  it("detects 'en' from browser language 'en'", () => {
    const ls = mockLocalStorage();
    vi.stubGlobal("window", { localStorage: ls, navigator: { language: "en" } });
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("navigator", { language: "en" });
    expect(detectLocale()).toBe("en");
  });

  it("defaults to 'fi' for non-English browser language", () => {
    const ls = mockLocalStorage();
    vi.stubGlobal("window", { localStorage: ls, navigator: { language: "de-DE" } });
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("navigator", { language: "de-DE" });
    expect(detectLocale()).toBe("fi");
  });

  it("defaults to 'fi' for Finnish browser language", () => {
    const ls = mockLocalStorage();
    vi.stubGlobal("window", { localStorage: ls, navigator: { language: "fi-FI" } });
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("navigator", { language: "fi-FI" });
    expect(detectLocale()).toBe("fi");
  });
});

// ---------------------------------------------------------------------------
// 2. persistLocale
// ---------------------------------------------------------------------------

describe("persistLocale", () => {
  it("stores locale in localStorage", () => {
    const ls = mockLocalStorage();
    vi.stubGlobal("localStorage", ls);
    persistLocale("en");
    expect(ls.setItem).toHaveBeenCalledWith("helscoop_locale", "en");
  });

  it("overwrites previous locale", () => {
    const ls = mockLocalStorage({ helscoop_locale: "fi" });
    vi.stubGlobal("localStorage", ls);
    persistLocale("en");
    expect(ls.setItem).toHaveBeenCalledWith("helscoop_locale", "en");
  });
});

// ---------------------------------------------------------------------------
// 3. Key lookup — Finnish
// ---------------------------------------------------------------------------

describe("getTranslation — Finnish (fi)", () => {
  const t = getTranslation("fi");

  it("resolves a top-level namespace key", () => {
    expect(t("nav.projects")).toBe("Projektit");
  });

  it("resolves deeply nested keys", () => {
    expect(t("auth.login")).toBe("Kirjaudu");
    expect(t("auth.loginTitle")).toBe("Kirjaudu sisaan");
  });

  it("resolves brand keys", () => {
    expect(t("brand.trustFree")).toBe("Ilmainen");
  });

  it("resolves editor keys", () => {
    expect(t("editor.save")).toBe("Tallenna");
    expect(t("editor.undo")).toBe("Kumoa");
  });

  it("resolves settings keys", () => {
    expect(t("settings.title")).toBe("Asetukset");
  });

  it("resolves unit keys", () => {
    expect(t("units.kpl")).toBe("kpl");
    expect(t("units.kplLong")).toBe("kappale");
  });
});

// ---------------------------------------------------------------------------
// 4. Key lookup — English
// ---------------------------------------------------------------------------

describe("getTranslation — English (en)", () => {
  const t = getTranslation("en");

  it("resolves navigation keys", () => {
    expect(t("nav.projects")).toBe("Projects");
    expect(t("nav.logout")).toBe("Sign out");
  });

  it("resolves auth keys", () => {
    expect(t("auth.login")).toBe("Sign in");
    expect(t("auth.register")).toBe("Create account");
  });

  it("resolves editor keys", () => {
    expect(t("editor.save")).toBe("Save");
    expect(t("editor.redo")).toBe("Redo");
  });

  it("resolves toast keys", () => {
    expect(t("toast.projectCreated")).toBe("Project created");
    expect(t("toast.saveFailed")).toBe("Save failed");
  });

  it("resolves pricing keys", () => {
    expect(t("pricing.compareTitle")).toBe("Price comparison");
    expect(t("pricing.cheapest")).toBe("Cheapest");
  });

  it("resolves unit keys", () => {
    expect(t("units.kpl")).toBe("pcs");
    expect(t("units.sakkiLong")).toBe("bag");
  });
});

// ---------------------------------------------------------------------------
// 5. Fallback behaviour
// ---------------------------------------------------------------------------

describe("fallback — missing keys return the key itself", () => {
  const tFi = getTranslation("fi");
  const tEn = getTranslation("en");

  it("returns the key for a completely nonexistent top-level namespace", () => {
    expect(tFi("nonexistent.key")).toBe("nonexistent.key");
    expect(tEn("nonexistent.key")).toBe("nonexistent.key");
  });

  it("returns the key for a valid namespace but missing leaf", () => {
    expect(tFi("nav.doesNotExist")).toBe("nav.doesNotExist");
    expect(tEn("nav.doesNotExist")).toBe("nav.doesNotExist");
  });

  it("returns the key for a deeply nested missing path", () => {
    expect(tFi("a.b.c.d.e")).toBe("a.b.c.d.e");
  });

  it("returns the key when the path resolves to an object (not a string)", () => {
    // 'nav' alone is an object, not a leaf string
    expect(tFi("nav")).toBe("nav");
    expect(tEn("nav")).toBe("nav");
  });

  it("returns the key for an empty string key", () => {
    expect(tFi("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 6. Template interpolation
// ---------------------------------------------------------------------------

describe("template interpolation", () => {
  const tFi = getTranslation("fi");
  const tEn = getTranslation("en");

  it("replaces a single {{count}} placeholder", () => {
    // editor.objectCount = '{{count}} objektia' (fi)
    expect(tFi("editor.objectCount", { count: 42 })).toBe("42 objektia");
  });

  it("replaces {{count}} in English", () => {
    // editor.objectCount = '{{count}} objects' (en)
    expect(tEn("editor.objectCount", { count: 7 })).toBe("7 objects");
  });

  it("replaces multiple placeholders", () => {
    // onboarding.stepOf = '{{current}} / {{total}}' (fi)
    expect(tFi("onboarding.stepOf", { current: 2, total: 5 })).toBe("2 / 5");
    expect(tEn("onboarding.stepOf", { current: 3, total: 5 })).toBe("3 / 5");
  });

  it("replaces string parameter values", () => {
    // project.projectCount = '{{count}} projekti{{suffix}}' (fi)
    expect(tFi("project.projectCount", { count: 1, suffix: "" })).toBe("1 projekti");
    expect(tFi("project.projectCount", { count: 3, suffix: "a" })).toBe("3 projektia");
  });

  it("replaces name in validation messages", () => {
    // validation.typoDetected = 'Mahdollinen kirjoitusvirhe — tarkoititko "{{name}}"?' (fi)
    expect(tFi("validation.typoDetected", { name: "cylinder" })).toBe(
      'Mahdollinen kirjoitusvirhe \u2014 tarkoititko "cylinder"?'
    );
  });

  it("replaces multiple distinct placeholders in validation", () => {
    // validation.unmatchedCloser = 'Unmatched closing {{char}} on line {{line}}' (en)
    expect(tEn("validation.unmatchedCloser", { char: "}", line: 42 })).toBe(
      "Unmatched closing } on line 42"
    );
  });

  it("leaves unreferenced placeholders untouched", () => {
    // If params don't cover all placeholders, the leftover {{...}} stays
    expect(tEn("editor.objectCount", {})).toBe("{{count}} objects");
  });

  it("ignores extra params that don't match any placeholder", () => {
    expect(tEn("nav.projects", { unused: "value" })).toBe("Projects");
  });

  it("handles numeric zero as a param value", () => {
    expect(tEn("editor.objectCount", { count: 0 })).toBe("0 objects");
  });
});

// ---------------------------------------------------------------------------
// 7. Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  const tFi = getTranslation("fi");
  const tEn = getTranslation("en");

  it("handles keys that contain dots correctly (deep nesting)", () => {
    // Three levels: 'auth.forgotPasswordTitle'
    expect(tFi("auth.forgotPasswordTitle")).toBe("Nollaa salasana");
  });

  it("handles keys with camelCase leaf names", () => {
    expect(tEn("editor.aiAssistant")).toBe("AI Assistant");
    expect(tEn("editor.bomRowCount", { count: 10, suffix: "s" })).toBe("10 rows");
  });

  it("returns key for single-segment key that is not a leaf", () => {
    expect(tFi("auth")).toBe("auth");
    expect(tFi("editor")).toBe("editor");
  });

  it("returns the key for a single-segment key that does not exist", () => {
    expect(tFi("zzz")).toBe("zzz");
  });

  it("both locales have the same set of top-level namespaces", () => {
    const fiT = getTranslation("fi");
    const enT = getTranslation("en");
    // Spot-check: every key that works in 'en' should also work in 'fi'
    const keys = [
      "nav.projects",
      "auth.login",
      "brand.tagline",
      "search.title",
      "project.myProjects",
      "toast.saved",
      "editor.save",
      "share.title",
      "shortcuts.title",
      "settings.title",
      "pricing.compareTitle",
      "units.kpl",
      "dialog.confirm",
      "admin.adminPanel",
      "onboarding.welcomeTitle",
      "legal.privacyPolicy",
      "screenshot.download",
      "validation.warningsTitle",
      "errors.notFoundTitle",
    ];
    for (const key of keys) {
      // Neither should fall back to returning the raw key
      expect(fiT(key)).not.toBe(key);
      expect(enT(key)).not.toBe(key);
    }
  });

  it("Finnish and English translations differ for the same key", () => {
    expect(tFi("nav.projects")).not.toBe(tEn("nav.projects"));
    expect(tFi("auth.login")).not.toBe(tEn("auth.login"));
    expect(tFi("editor.save")).not.toBe(tEn("editor.save"));
  });

  it("handles special characters in translation values", () => {
    // brand.tagline contains unicode middot \u00b7 and special chars
    expect(tEn("brand.tagline")).toContain("\u00b7");
    // units contain superscript characters
    expect(tEn("units.sqm")).toBe("m\u00B2");
    expect(tEn("units.m3")).toBe("m\u00B3");
  });

  it("handles interpolation with special characters in param values", () => {
    expect(
      tEn("validation.undefinedIdentifier", { name: "foo<bar>" })
    ).toBe('"foo<bar>" is not defined \u2014 check spelling');
  });
});

// ---------------------------------------------------------------------------
// 8. Exhaustive key parity — every fi key must have a corresponding en key
// ---------------------------------------------------------------------------

describe("exhaustive i18n key parity", () => {
  const tFi = getTranslation("fi");
  const tEn = getTranslation("en");

  // All top-level namespaces with all their leaf keys
  const allKeys = [
    // nav
    "nav.projects", "nav.admin", "nav.logout", "nav.back", "nav.settings",
    // auth
    "auth.login", "auth.loginTitle", "auth.loginSubtitle", "auth.loginSubtitleBuilding",
    "auth.register", "auth.registerTitle", "auth.registerSubtitle",
    "auth.email", "auth.emailPlaceholder", "auth.password", "auth.passwordPlaceholder",
    "auth.name", "auth.namePlaceholder", "auth.noAccount", "auth.hasAccount",
    "auth.loading", "auth.loginFailed",
    "auth.forgotPassword", "auth.forgotPasswordTitle", "auth.forgotPasswordSubtitle",
    "auth.forgotPasswordSend", "auth.forgotPasswordSent", "auth.forgotPasswordBack",
    "auth.resetPasswordTitle", "auth.resetPasswordSubtitle", "auth.resetPasswordNew",
    "auth.resetPasswordNewPlaceholder", "auth.resetPasswordConfirm",
    "auth.resetPasswordConfirmPlaceholder", "auth.resetPasswordSubmit",
    "auth.resetPasswordSuccess", "auth.resetPasswordMismatch", "auth.resetPasswordInvalid",
    // brand
    "brand.tagline", "brand.trustProducts", "brand.trustSuppliers", "brand.trustFree",
    "brand.description", "brand.featureMaterials", "brand.featureMaterialsDesc",
    "brand.featureSuppliers", "brand.featureSuppliersDesc",
    "brand.featureAI", "brand.featureAIDesc",
    // search
    "search.sectionLabel", "search.title", "search.subtitle", "search.placeholder",
    "search.searching", "search.searchButton", "search.createFromBuilding",
    "search.creatingProject", "search.createError", "search.notFound",
    "search.yearBuilt", "search.area", "search.floors", "search.material",
    "search.heating", "search.bomRows", "search.verified", "search.estimated",
    "search.dataSources",
    // project
    "project.myProjects", "project.projectCount", "project.startFirst",
    "project.loadingProjects", "project.newProjectPlaceholder", "project.create",
    "project.open", "project.copy", "project.delete", "project.deleteConfirm",
    "project.noProjects", "project.noProjectsDesc", "project.emptyDescription",
    "project.descriptionPlaceholder", "project.orStartFromTemplate",
    "project.searchPlaceholder", "project.sortByName", "project.sortByModified",
    "project.sortByCreated", "project.sortByCost", "project.noSearchResults",
    "project.noSearchResultsDesc", "project.emptyTitle", "project.emptyHint",
    "project.emptyCta", "project.noSearchResultsCta",
    // toast
    "toast.projectCreated", "toast.projectDeleted", "toast.projectDuplicated",
    "toast.templateCreated", "toast.saved", "toast.bomExported",
    "toast.loadProjectsFailed", "toast.createProjectFailed", "toast.templateFailed",
    "toast.deleteFailed", "toast.duplicateFailed", "toast.loadProjectFailed",
    "toast.saveFailed", "toast.bomExportFailed", "toast.aiError",
    "toast.shareFailed", "toast.unshareFailed", "toast.linkCopied",
    "toast.projectUnshared", "toast.loadMaterialsFailed", "toast.loadSuppliersFailed",
    "toast.loadPricingFailed", "toast.materialRemoved", "toast.undo",
    // editor
    "editor.scene", "editor.materialList", "editor.save", "editor.saved",
    "editor.saving", "editor.unsaved", "editor.export", "editor.exportPdf",
    "editor.undo", "editor.redo", "editor.undoShortcut", "editor.redoShortcut",
    "editor.assistant", "editor.aiAssistant", "editor.describeChange",
    "editor.continueConversation", "editor.describePrompt",
    "editor.exampleRoof", "editor.exampleWindow",
    "editor.suggestionRoof", "editor.suggestionWindow", "editor.suggestionGarage",
    "editor.applyToScene", "editor.thinking",
    "editor.message", "editor.messages",
    "editor.objectSingular", "editor.objectPlural",
    "editor.chatMinimize", "editor.chatExpand", "editor.chatInputLabel", "editor.chatSendLabel",
    "editor.addMaterial", "editor.add",
    "editor.noMaterials", "editor.noMaterialsHint", "editor.noMaterialsCta",
    "editor.error", "editor.errorLoadProject", "editor.backToProjects",
    "editor.loadingProject", "editor.chatError",
    "editor.viewportCrashTitle", "editor.viewportCrashMessage", "editor.resetScene",
    "editor.loading3D", "editor.showCode", "editor.hideCode", "editor.wireframe",
    "editor.params", "editor.resetCamera",
    "editor.cameraFront", "editor.cameraSide", "editor.cameraTop", "editor.cameraIso",
    "editor.screenshot", "editor.screenshotAriaLabel",
    "editor.ruler", "editor.rulerTooltip",
    "editor.measureWidth", "editor.measureHeight", "editor.measureDepth",
    "editor.measureRadius", "editor.measureDiameter",
    "editor.sceneErrorPrefix", "editor.objectCount", "editor.bomRowCount",
    "editor.estimatedTotal", "editor.inclVat", "editor.costBreakdown",
    "editor.confirmApplyTitle", "editor.confirmApplyMessage", "editor.confirmApplyUndo",
    "editor.cancel", "editor.dontAskAgain",
    "editor.docs", "editor.share", "editor.duplicateProject", "editor.parameters",
    "editor.quantityFor",
    // share
    "share.title", "share.description", "share.generating", "share.copyLink",
    "share.copied", "share.unshare", "share.unshareConfirm", "share.poweredBy",
    "share.viewerTitle", "share.notFound", "share.notFoundDesc", "share.readOnly",
    "share.signUpCta", "share.materials", "share.total",
    // shortcuts
    "shortcuts.title", "shortcuts.save", "shortcuts.toggleBom", "shortcuts.applyCode",
    "shortcuts.closePanel", "shortcuts.showShortcuts", "shortcuts.undo", "shortcuts.redo",
    "shortcuts.commandPalette", "shortcuts.escToClose",
    // settings
    "settings.title", "settings.profile", "settings.profileDesc", "settings.name",
    "settings.email", "settings.saveProfile", "settings.security", "settings.securityDesc",
    "settings.currentPassword", "settings.newPassword", "settings.confirmPassword",
    "settings.changePassword", "settings.passwordMismatch", "settings.passwordTooShort",
    "settings.account", "settings.accountDesc", "settings.exportData",
    "settings.exportDataDesc", "settings.deleteAccount", "settings.deleteAccountWarning",
    "settings.deleteAccountConfirm", "settings.profileUpdated", "settings.profileUpdateFailed",
    "settings.passwordChanged", "settings.passwordChangeFailed",
    "settings.accountDeleted", "settings.accountDeleteFailed",
    "settings.dataExported", "settings.dataExportFailed", "settings.backToProjects",
    // pricing
    "pricing.compareTitle", "pricing.supplier", "pricing.unitPrice", "pricing.buyLink",
    "pricing.cheapest", "pricing.primary", "pricing.noSuppliers", "pricing.loading",
    "pricing.savingsLabel", "pricing.savingsTooltip", "pricing.perUnit", "pricing.close",
    "pricing.lastChecked", "pricing.viewProduct", "pricing.searchMaterials",
    "pricing.allCategories", "pricing.noResults", "pricing.browseMaterials",
    "pricing.setQuantity", "pricing.showHistory", "pricing.hideHistory",
    "pricing.showTrend", "pricing.limitedHistory",
    // units
    "units.jm", "units.sqm", "units.m2", "units.m3", "units.kpl",
    "units.sheet", "units.box", "units.liter", "units.sakki",
    "units.jmLong", "units.sqmLong", "units.m2Long", "units.m3Long",
    "units.kplLong", "units.sheetLong", "units.boxLong", "units.literLong", "units.sakkiLong",
    // dialog
    "dialog.confirm", "dialog.cancel", "dialog.deleteProjectTitle",
    "dialog.deleteProjectMessage", "dialog.deleteAccountTitle", "dialog.deleteAccountMessage",
    // admin
    "admin.adminPanel", "admin.adminDesc", "admin.materials", "admin.suppliers",
    "admin.pricing", "admin.search", "admin.name", "admin.category",
    "admin.wasteFactor", "admin.price", "admin.supplier", "admin.others",
    "admin.noPrice", "admin.stalePrices", "admin.staleThreshold", "admin.allUpToDate",
    "admin.website", "admin.products", "admin.oldestPrice", "admin.material",
    "admin.lastUpdated", "admin.age", "admin.checkingAccess",
    // onboarding
    "onboarding.welcomeTitle", "onboarding.welcomeBody", "onboarding.welcomeStart",
    "onboarding.welcomeSkip", "onboarding.stepAddress", "onboarding.stepViewport",
    "onboarding.stepChat", "onboarding.stepMaterials", "onboarding.stepExport",
    "onboarding.next", "onboarding.skip", "onboarding.done", "onboarding.stepOf",
    "onboarding.restartTour", "onboarding.restartTourDesc", "onboarding.tourRestarted",
    // legal
    "legal.privacyPolicy", "legal.termsOfService", "legal.acceptTerms",
    "legal.acceptTermsRequired", "legal.and", "legal.lastUpdated",
    "legal.privacyTitle", "legal.privacyIntro", "legal.privacyDataCollected",
    "legal.privacyDataCollectedBody", "legal.privacyHowUsed", "legal.privacyHowUsedBody",
    "legal.privacyStorage", "legal.privacyStorageBody", "legal.privacyThirdParty",
    "legal.privacyThirdPartyBody", "legal.privacyRights", "legal.privacyRightsBody",
    "legal.privacyCookies", "legal.privacyCookiesBody", "legal.privacyContact",
    "legal.privacyContactBody", "legal.termsTitle", "legal.termsIntro",
    "legal.termsUse", "legal.termsUseBody", "legal.termsIP", "legal.termsIPBody",
    "legal.termsAI", "legal.termsAIBody", "legal.termsPrices", "legal.termsPricesBody",
    "legal.termsLiability", "legal.termsLiabilityBody", "legal.termsChanges",
    "legal.termsChangesBody",
    // screenshot
    "screenshot.download", "screenshot.copy", "screenshot.copied",
    // commandPalette
    "commandPalette.title", "commandPalette.placeholder", "commandPalette.noResults",
    "commandPalette.navigate", "commandPalette.execute", "commandPalette.close",
    "commandPalette.toggleWireframe", "commandPalette.toggleWireframeEn",
    "commandPalette.resetCamera", "commandPalette.resetCameraEn",
    "commandPalette.toggleCodeEditor", "commandPalette.toggleCodeEditorEn",
    "commandPalette.toggleBom", "commandPalette.toggleBomEn",
    "commandPalette.exportPdf", "commandPalette.exportPdfEn",
    "commandPalette.shareProject", "commandPalette.shareProjectEn",
    "commandPalette.toggleTheme", "commandPalette.toggleThemeEn",
    "commandPalette.showShortcuts", "commandPalette.showShortcutsEn",
    "commandPalette.save", "commandPalette.saveEn",
    "commandPalette.showDocs", "commandPalette.showDocsEn",
    // validation
    "validation.unmatchedCloser", "validation.unmatchedOpener", "validation.typoDetected",
    "validation.undefinedIdentifier", "validation.emptyScene", "validation.tooManyObjects",
    "validation.farFromOrigin", "validation.invalidDimension", "validation.warningsTitle",
    // errors
    "errors.notFoundTitle", "errors.notFoundMessage", "errors.backToProjects",
    "errors.searchAddress", "errors.serverErrorTitle", "errors.serverErrorMessage",
    "errors.tryAgain", "errors.backToDashboard", "errors.showDetails", "errors.hideDetails",
    "errors.projectNotFoundTitle", "errors.projectNotFoundMessage",
    "errors.connectionLost", "errors.reconnected", "errors.retryNow",
  ];

  it("every Finnish key has a corresponding English translation", () => {
    const missingInEn: string[] = [];
    for (const key of allKeys) {
      const fiVal = tFi(key);
      const enVal = tEn(key);
      // If fi resolves but en falls back to the key itself, it is missing
      if (fiVal !== key && enVal === key) {
        missingInEn.push(key);
      }
    }
    expect(missingInEn).toEqual([]);
  });

  it("every English key has a corresponding Finnish translation", () => {
    const missingInFi: string[] = [];
    for (const key of allKeys) {
      const fiVal = tFi(key);
      const enVal = tEn(key);
      // If en resolves but fi falls back to the key itself, it is missing
      if (enVal !== key && fiVal === key) {
        missingInFi.push(key);
      }
    }
    expect(missingInFi).toEqual([]);
  });

  it("no key resolves to fallback in both locales (i.e., all keys exist)", () => {
    const missingInBoth: string[] = [];
    for (const key of allKeys) {
      if (tFi(key) === key && tEn(key) === key) {
        missingInBoth.push(key);
      }
    }
    expect(missingInBoth).toEqual([]);
  });
});
