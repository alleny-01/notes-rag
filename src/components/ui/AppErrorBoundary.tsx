import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

/** Keeps a browser-only failure from blanking the product shell. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("NotesRAG client error", error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-6 text-center">
        <div className="max-w-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--signal)]">Page unavailable</p>
          <h1 className="mt-3 font-[var(--serif)] text-[20px] font-light text-[var(--ink)]">This page could not finish loading.</h1>
          <p className="mt-3 text-[13px] leading-6 text-[var(--body)]">Try opening it again. If it keeps happening, reload NotesRAG and make sure your browser is up to date.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-[var(--purple)] px-4 text-[12px] font-medium text-white transition hover:bg-[var(--purple-dark)]">Reload NotesRAG</button>
        </div>
      </main>
    );
  }
}