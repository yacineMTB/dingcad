import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import OnboardingTour, {
  WelcomeModal,
  TourOverlay,
  isOnboardingCompleted,
  resetOnboarding,
} from "@/components/OnboardingTour";

// Mock the LocaleProvider's useTranslation hook
vi.mock("@/components/LocaleProvider", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params) {
        let result = key;
        for (const [k, v] of Object.entries(params)) {
          result += ` ${k}=${v}`;
        }
        return result;
      }
      return key;
    },
  }),
}));

// Mock the api module
vi.mock("@/lib/api", () => ({
  getToken: vi.fn(() => "fake-token"),
}));

// Retrieve the mock so we can control it per test
import { getToken } from "@/lib/api";
const mockedGetToken = vi.mocked(getToken);

describe("WelcomeModal", () => {
  it("renders welcome title and body", () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();
    render(<WelcomeModal onStart={onStart} onSkip={onSkip} />);
    expect(screen.getByText("onboarding.welcomeTitle")).toBeDefined();
    expect(screen.getByText("onboarding.welcomeBody")).toBeDefined();
  });

  it("renders start and skip buttons", () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();
    render(<WelcomeModal onStart={onStart} onSkip={onSkip} />);
    expect(screen.getByText("onboarding.welcomeStart")).toBeDefined();
    expect(screen.getByText("onboarding.welcomeSkip")).toBeDefined();
  });

  it("calls onStart when start button is clicked", () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();
    render(<WelcomeModal onStart={onStart} onSkip={onSkip} />);
    fireEvent.click(screen.getByText("onboarding.welcomeStart"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when skip button is clicked", () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();
    render(<WelcomeModal onStart={onStart} onSkip={onSkip} />);
    fireEvent.click(screen.getByText("onboarding.welcomeSkip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when clicking the backdrop overlay", () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();
    const { container } = render(
      <WelcomeModal onStart={onStart} onSkip={onSkip} />
    );
    // The outermost fixed div is the backdrop
    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe("TourOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set up DOM elements that match TOUR_STEPS selectors
    const targets = [
      { attr: "address-input", id: "t1" },
      { attr: "viewport", id: "t2" },
      { attr: "chat-toggle", id: "t3" },
      { attr: "bom-panel", id: "t4" },
      { attr: "export-btn", id: "t5" },
    ];
    for (const t of targets) {
      const el = document.createElement("div");
      el.setAttribute("data-tour", t.attr);
      el.setAttribute("id", t.id);
      // Give it a bounding rect
      el.getBoundingClientRect = () => ({
        top: 100,
        left: 100,
        width: 200,
        height: 50,
        right: 300,
        bottom: 150,
        x: 100,
        y: 100,
        toJSON: () => {},
      });
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up tour target elements
    document
      .querySelectorAll("[data-tour]")
      .forEach((el) => el.remove());
  });

  it("renders the first step", () => {
    const onComplete = vi.fn();
    render(<TourOverlay onComplete={onComplete} />);
    // Should show step counter for step 1
    expect(
      screen.getByText("onboarding.stepOf current=1 total=5")
    ).toBeDefined();
    // Should show the content key for step 1
    expect(screen.getByText("onboarding.stepAddress")).toBeDefined();
  });

  it("advances to the next step when Next is clicked", () => {
    const onComplete = vi.fn();
    render(<TourOverlay onComplete={onComplete} />);

    // Click Next to go to step 2
    fireEvent.click(screen.getByText("onboarding.next"));
    // Advance past the 120ms displayStep animation timer
    act(() => { vi.advanceTimersByTime(150); });
    expect(
      screen.getByText("onboarding.stepOf current=2 total=5")
    ).toBeDefined();
    expect(screen.getByText("onboarding.stepViewport")).toBeDefined();
  });

  it("advances through all steps and completes", () => {
    const onComplete = vi.fn();
    render(<TourOverlay onComplete={onComplete} />);

    // Steps 1-4: click Next
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText("onboarding.next"));
      act(() => { vi.advanceTimersByTime(150); });
    }

    // Step 5 (last): button should say "done"
    expect(
      screen.getByText("onboarding.stepOf current=5 total=5")
    ).toBeDefined();
    expect(screen.getByText("onboarding.done")).toBeDefined();

    // Click Done to complete
    fireEvent.click(screen.getByText("onboarding.done"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onComplete when Skip is clicked", () => {
    const onComplete = vi.fn();
    render(<TourOverlay onComplete={onComplete} />);
    fireEvent.click(screen.getByText("onboarding.skip"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onComplete immediately when no tour elements exist", () => {
    // Remove all tour target elements
    document
      .querySelectorAll("[data-tour]")
      .forEach((el) => el.remove());

    const onComplete = vi.fn();
    render(<TourOverlay onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("OnboardingTour", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedGetToken.mockReturnValue("fake-token");
  });

  it("renders nothing when onboarding is already completed", async () => {
    localStorage.setItem("helscoop_onboarding_completed", "true");

    const { container } = render(<OnboardingTour />);
    // Wait for useEffect
    await act(async () => {});
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when user has no token", async () => {
    mockedGetToken.mockReturnValue(null);

    const { container } = render(<OnboardingTour />);
    await act(async () => {});
    expect(container.innerHTML).toBe("");
  });

  it("shows the welcome modal for first-time users", async () => {
    mockedGetToken.mockReturnValue("fake-token");

    render(<OnboardingTour />);
    await act(async () => {});
    expect(screen.getByText("onboarding.welcomeTitle")).toBeDefined();
  });

  it("transitions to tour when start is clicked", async () => {
    mockedGetToken.mockReturnValue("fake-token");

    // Add at least one tour target so TourOverlay doesn't immediately complete
    const el = document.createElement("div");
    el.setAttribute("data-tour", "address-input");
    el.getBoundingClientRect = () => ({
      top: 100,
      left: 100,
      width: 200,
      height: 50,
      right: 300,
      bottom: 150,
      x: 100,
      y: 100,
      toJSON: () => {},
    });
    document.body.appendChild(el);

    render(<OnboardingTour />);
    await act(async () => {});

    // Click start tour
    fireEvent.click(screen.getByText("onboarding.welcomeStart"));

    // Should now show tour step content
    expect(screen.getByText("onboarding.stepAddress")).toBeDefined();

    el.remove();
  });

  it("marks onboarding complete when skip is clicked", async () => {
    mockedGetToken.mockReturnValue("fake-token");

    render(<OnboardingTour />);
    await act(async () => {});

    fireEvent.click(screen.getByText("onboarding.welcomeSkip"));
    expect(localStorage.getItem("helscoop_onboarding_completed")).toBe("true");
  });
});

describe("isOnboardingCompleted / resetOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when not completed", () => {
    expect(isOnboardingCompleted()).toBe(false);
  });

  it("returns true when completed", () => {
    localStorage.setItem("helscoop_onboarding_completed", "true");
    expect(isOnboardingCompleted()).toBe(true);
  });

  it("resets onboarding state", () => {
    localStorage.setItem("helscoop_onboarding_completed", "true");
    resetOnboarding();
    expect(isOnboardingCompleted()).toBe(false);
  });
});
