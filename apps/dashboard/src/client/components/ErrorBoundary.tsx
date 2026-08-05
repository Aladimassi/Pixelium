import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Pixulium UI error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error" role="alert">
          <h1>Something went wrong loading the store</h1>
          <p className="hint">{this.state.error.message}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              try {
                localStorage.removeItem('pixelium_token');
                localStorage.removeItem('pixelium_user');
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
          >
            Clear session &amp; reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
