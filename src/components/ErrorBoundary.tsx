"use client";

import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("DR DXB Server error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-black p-6">
          <div
            className="max-w-md rounded-xl p-6 text-center"
            style={{
              border: "1px solid rgba(212, 175, 55, 0.25)",
              backgroundColor: "#050505",
              boxShadow: "0 0 30px rgba(212, 175, 55, 0.08)",
            }}
          >
            <h1 className="mb-2 text-lg font-semibold" style={{ color: "#f4e4bc" }}>
              Something went wrong
            </h1>
            <p className="mb-4 text-sm text-[#a0a0a0]">
              The app hit an error. Try refreshing the page. If you were connecting a wallet, try again after refresh.
            </p>
            <p className="mb-6 break-all font-mono text-xs text-[#666]">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{
                border: "1px solid rgba(212, 175, 55, 0.4)",
                backgroundColor: "rgba(212, 175, 55, 0.1)",
                color: "#f4e4bc",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
