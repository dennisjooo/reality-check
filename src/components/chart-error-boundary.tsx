"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ChartErrorBoundary caught:", error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl border border-border bg-card shadow-lg max-w-sm">
            <div className="text-sm font-medium text-destructive">
              Chart failed to render
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </div>
            <Button variant="default" size="sm" onClick={this.handleReset}>
              Reload Chart
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
