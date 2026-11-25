import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Feather, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /**
   * "page" sits inside the app shell (the sidebar stays usable, so people can
   * navigate away); "screen" is the last resort around the whole app.
   */
  variant?: "page" | "screen";
}

interface State {
  error: Error | null;
}

/**
 * Catches a crash while rendering so one broken component shows a way out
 * instead of a blank page. Give it a `key` that changes on navigation so
 * moving to another page clears the error.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const screen = this.props.variant === "screen";
    return (
      <div
        role="alert"
        className={
          screen
            ? "flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center"
            : "flex flex-col items-center justify-center px-4 py-24 text-center"
        }
      >
        <Feather className="mb-6 h-8 w-8 text-primary" />
        <h1 className="text-2xl">Something went wrong on this page</h1>
        <p className="mt-3 max-w-sm text-muted-foreground">
          Anything you already saved is safe. Reload to try again{screen ? "" : ", or pick another page from the menu"}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => window.location.reload()}>
            <RotateCw className="h-4 w-4" />
            Reload
          </Button>
          {screen && (
            <Button variant="outline" asChild>
              <a href="/">Go to Workzen</a>
            </Button>
          )}
        </div>
      </div>
    );
  }
}
