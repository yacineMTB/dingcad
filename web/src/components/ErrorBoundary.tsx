"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { useTranslation } from "./LocaleProvider";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/** Functional wrapper so the default fallback can use the useTranslation hook. */
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-secondary)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div style={{ textAlign: "center", padding: 32, maxWidth: 400 }}>
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "var(--danger-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--danger)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3
          style={{
            color: "var(--text-primary)",
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {t('errors.errorBoundaryTitle')}
        </h3>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          {error.message}
        </p>
        <button
          className="btn btn-primary"
          onClick={reset}
          style={{
            padding: "8px 20px",
            fontSize: 13,
          }}
        >
          {t('errors.errorBoundaryReset')}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}
