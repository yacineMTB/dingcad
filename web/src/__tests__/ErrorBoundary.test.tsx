import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// A component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test explosion");
  }
  return <div>Child content</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React error boundary console noise in test output
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("renders default fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("3D Error")).toBeDefined();
    expect(screen.getByText("Test explosion")).toBeDefined();
    expect(screen.getByText("Reset")).toBeDefined();
  });

  it("renders custom fallback when provided", () => {
    const fallback = ({ error, reset }: { error: Error; reset: () => void }) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={reset}>Retry</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom error: Test explosion")).toBeDefined();
    expect(screen.getByText("Retry")).toBeDefined();
  });

  it("resets error state when Reset button is clicked (default fallback)", () => {
    const onReset = vi.fn();

    function Wrapper() {
      return (
        <ErrorBoundary onReset={onReset}>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>
      );
    }

    render(<Wrapper />);
    expect(screen.getByText("Test explosion")).toBeDefined();

    // Click reset - onReset callback should fire
    fireEvent.click(screen.getByText("Reset"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("resets error state when custom fallback reset is triggered", () => {
    const onReset = vi.fn();
    const fallback = ({ error, reset }: { error: Error; reset: () => void }) => (
      <div>
        <span>Broken: {error.message}</span>
        <button onClick={reset}>Try Again</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={fallback} onReset={onReset}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Broken: Test explosion")).toBeDefined();
    fireEvent.click(screen.getByText("Try Again"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("logs the error via console.error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // React itself and our componentDidCatch both call console.error
    const ourCall = consoleSpy.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("[ErrorBoundary] Caught error:")
    );
    expect(ourCall).toBeDefined();
  });
});
