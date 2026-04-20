// Vitest setup for Next.js frontend tests
import { vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({ id: "test-project-id" }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/dynamic
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: unknown }>) => {
    // Return a simple placeholder component for dynamic imports
    const Component = (props: Record<string, unknown>) => {
      return null;
    };
    Component.displayName = "DynamicComponent";
    return Component;
  },
}));
