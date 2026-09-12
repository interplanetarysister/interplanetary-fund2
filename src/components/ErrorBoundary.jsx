import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";

function classifyRenderFailure(value) {
  if (value && typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "function") return "function";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value == null) return "nullish";
  return "unknown";
}

// Per-route error boundary. Wraps <Outlet/> in the Layout so a render crash
// in any page replaces only that page's content with a recovery card — the nav
// and chrome stay mounted. "Try again" resets the boundary; "Home" navigates.
export default class ErrorBoundary extends React.Component {
  state = { error: null };
  headingRef = React.createRef();
  hasFocusedCurrentError = false;

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Route render error:", classifyRenderFailure(error));
  }

  componentDidUpdate(prevProps, prevState) {
    const enteredErrorState = !prevState.error && this.state.error;
    if (enteredErrorState && this.headingRef.current) {
      this.headingRef.current.focus();
      this.hasFocusedCurrentError = true;
    }
  }

  reset = () => {
    this.hasFocusedCurrentError = false;
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="max-w-md mx-auto px-4 py-16 text-center"
          role="alert"
          aria-live="assertive"
          aria-labelledby="route-error-heading"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2
            id="route-error-heading"
            ref={this.headingRef}
            tabIndex={-1}
            className="font-display text-xl text-stone-900 mb-1"
          >
            This page hit a snag
          </h2>
          <p className="text-sm text-stone-500 mb-5">
            An unexpected error occurred while rendering this page.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 h-10 min-h-[44px] text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" /> Try again
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 h-10 min-h-[44px] text-sm font-medium text-stone-600"
            >
              <Home className="w-4 h-4" aria-hidden="true" /> Home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
