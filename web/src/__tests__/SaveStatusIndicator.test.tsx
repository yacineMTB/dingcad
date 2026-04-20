import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SaveStatusIndicator from "@/components/SaveStatusIndicator";

// Mock the LocaleProvider to return English translations
vi.mock("@/components/LocaleProvider", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "saveStatus.saved": "Saved",
        "saveStatus.saving": "Saving...",
        "saveStatus.unsaved": "Unsaved changes",
        "saveStatus.error": "Save failed",
      };
      return map[key] ?? key;
    },
    locale: "en" as const,
  }),
}));

describe("SaveStatusIndicator", () => {
  it("renders saved state with muted text", () => {
    const { container } = render(
      <SaveStatusIndicator status="saved" />
    );
    const pill = container.querySelector(".save-status-pill");
    expect(pill).toBeTruthy();
    expect(pill?.getAttribute("data-status")).toBe("saved");
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("renders saved state with last-saved timestamp", () => {
    render(
      <SaveStatusIndicator status="saved" lastSaved="14:30:00" />
    );
    expect(screen.getByText("Saved 14:30:00")).toBeTruthy();
  });

  it("renders saving state with spinner", () => {
    const { container } = render(
      <SaveStatusIndicator status="saving" />
    );
    const pill = container.querySelector(".save-status-pill");
    expect(pill?.getAttribute("data-status")).toBe("saving");
    expect(screen.getByText("Saving...")).toBeTruthy();
    expect(container.querySelector(".save-status-spinner")).toBeTruthy();
  });

  it("renders unsaved state with dot indicator", () => {
    const { container } = render(
      <SaveStatusIndicator status="unsaved" />
    );
    const pill = container.querySelector(".save-status-pill");
    expect(pill?.getAttribute("data-status")).toBe("unsaved");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect(container.querySelector(".save-status-dot")).toBeTruthy();
  });

  it("renders error state with error icon", () => {
    const { container } = render(
      <SaveStatusIndicator status="error" />
    );
    const pill = container.querySelector(".save-status-pill");
    expect(pill?.getAttribute("data-status")).toBe("error");
    expect(screen.getByText("Save failed")).toBeTruthy();
  });

  it("has role=status and aria-live for accessibility", () => {
    const { container } = render(
      <SaveStatusIndicator status="saved" />
    );
    const pill = container.querySelector(".save-status-pill");
    expect(pill?.getAttribute("role")).toBe("status");
    expect(pill?.getAttribute("aria-live")).toBe("polite");
  });

  it("sets aria-label with timestamp when saved", () => {
    const { container } = render(
      <SaveStatusIndicator status="saved" lastSaved="15:00:00" />
    );
    const pill = container.querySelector(".save-status-pill");
    expect(pill?.getAttribute("aria-label")).toBe("Saved 15:00:00");
  });

  it("sets aria-label for error state", () => {
    const { container } = render(
      <SaveStatusIndicator status="error" />
    );
    const pill = container.querySelector(".save-status-pill");
    expect(pill?.getAttribute("aria-label")).toBe("Save failed");
  });
});
