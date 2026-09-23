// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { type ErrorInfo, type ReactNode } from 'react';
import { trackException } from '../services/telemetryService';
import './AppErrorBoundary.css';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export default class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    trackException(error, {
      boundary: 'root',
      componentStack: info.componentStack || 'unavailable',
    });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert">
        <div className="app-error-boundary-panel">
          <span className="app-error-boundary-label">AADB recovered the page</span>
          <h1>Something interrupted the workspace</h1>
          <p>Your saved diagrams and snapshots are still available. Reload the application to start a fresh workspace session.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      </main>
    );
  }
}