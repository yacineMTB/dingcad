import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import SceneParamsPanel from "@/components/SceneParamsPanel";
import type { SceneParam } from "@/lib/scene-interpreter";

// Mock the LocaleProvider's useTranslation hook
vi.mock("@/components/LocaleProvider", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "editor.parameters": "Parameters",
      };
      return translations[key] ?? key;
    },
  }),
}));

function makeParam(overrides: Partial<SceneParam> = {}): SceneParam {
  return {
    name: "height",
    section: "Dimensions",
    label: "Height",
    min: 100,
    max: 5000,
    value: 2400,
    step: 10,
    ...overrides,
  };
}

describe("SceneParamsPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when params array is empty", () => {
    const { container } = render(
      <SceneParamsPanel params={[]} onParamChange={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders param count badge", () => {
    const params = [makeParam(), makeParam({ name: "width", label: "Width" })];
    render(<SceneParamsPanel params={params} onParamChange={vi.fn()} />);
    const badge = document.querySelector(".scene-params-count");
    expect(badge).toBeDefined();
    expect(badge!.textContent).toBe("2");
  });

  it("renders section headers", () => {
    const params = [
      makeParam({ section: "Dimensions" }),
      makeParam({ name: "angle", section: "Roof", label: "Angle" }),
    ];
    render(<SceneParamsPanel params={params} onParamChange={vi.fn()} />);
    expect(screen.getByText("Dimensions")).toBeDefined();
    expect(screen.getByText("Roof")).toBeDefined();
  });

  it("renders slider labels for each param", () => {
    const params = [
      makeParam({ label: "Height" }),
      makeParam({ name: "width", label: "Width" }),
    ];
    render(<SceneParamsPanel params={params} onParamChange={vi.fn()} />);
    // Labels appear in label elements
    const labels = screen.getAllByText("Height");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const widthLabels = screen.getAllByText("Width");
    expect(widthLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("debounces onParamChange when slider value changes", async () => {
    const onParamChange = vi.fn();
    const params = [makeParam()];
    render(<SceneParamsPanel params={params} onParamChange={onParamChange} />);

    // Get the range slider
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "3000" } });

    // Not called immediately since it's debounced by 16ms
    expect(onParamChange).not.toHaveBeenCalled();

    // Advance timer past debounce
    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(onParamChange).toHaveBeenCalledWith("height", 3000);
  });

  it("collapses section when section header is clicked", () => {
    const params = [makeParam()];
    render(<SceneParamsPanel params={params} onParamChange={vi.fn()} />);

    // Initially, the section body should be open
    const sectionBody = document.querySelector(
      ".scene-params-section-body"
    ) as HTMLElement;
    expect(sectionBody.getAttribute("data-open")).toBe("true");

    // Click the section toggle
    fireEvent.click(screen.getByText("Dimensions"));

    // After clicking, it should be collapsed
    expect(sectionBody.getAttribute("data-open")).toBe("false");
  });

  it("clamps input value to min/max range", async () => {
    const onParamChange = vi.fn();
    const params = [makeParam({ min: 100, max: 5000 })];
    render(<SceneParamsPanel params={params} onParamChange={onParamChange} />);

    // Get the number input
    const numberInput = screen.getByRole("spinbutton");
    fireEvent.change(numberInput, { target: { value: "9999" } });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    // Should be clamped to max (5000)
    expect(onParamChange).toHaveBeenCalledWith("height", 5000);
  });

  it("groups params by section correctly", () => {
    const params = [
      makeParam({ name: "width", section: "Dimensions", label: "Width" }),
      makeParam({ name: "height", section: "Dimensions", label: "Height" }),
      makeParam({ name: "angle", section: "Roof", label: "Angle" }),
    ];
    render(<SceneParamsPanel params={params} onParamChange={vi.fn()} />);

    const sections = document.querySelectorAll(".scene-params-section");
    expect(sections).toHaveLength(2);
  });

  it("shows section param count in header", () => {
    const params = [
      makeParam({ name: "width", section: "Dimensions", label: "Width" }),
      makeParam({ name: "height", section: "Dimensions", label: "Height" }),
    ];
    render(<SceneParamsPanel params={params} onParamChange={vi.fn()} />);

    // The section count should show "2" for the Dimensions section
    const sectionCounts = document.querySelectorAll(
      ".scene-params-section-count"
    );
    expect(sectionCounts[0].textContent).toBe("2");
  });
});
