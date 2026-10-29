import { Component } from "react";

/** Last line of defence: a render error shows a recoverable message instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>The page hit an unexpected error. Your saved homes and compare list are safe.</p>
        <button className="btn" type="button" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
