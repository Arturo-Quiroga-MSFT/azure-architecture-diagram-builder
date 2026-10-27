// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AppErrorBoundary from './components/AppErrorBoundary.tsx'
import { initTelemetry } from './services/telemetryService'
import './index.css'

// Initialize Application Insights telemetry (no-ops if not configured)
initTelemetry()

function ErrorBoundarySmokeTrigger(): never {
  throw new Error('Release smoke error-boundary trigger')
}

const showErrorBoundarySmoke = import.meta.env.VITE_ERROR_BOUNDARY_TEST === 'true'
  && new URLSearchParams(window.location.search).has('error-boundary-test')

// The shareable video tour lives at /videos and renders without the editor.
const VideoTourPage = React.lazy(() => import('./components/VideoTourPage.tsx'))
const isVideoTourPage = /^\/videos\/?$/.test(window.location.pathname)
// A shared design link (/d/<id>) opens a read-only view, also without the editor.
const SharedDesignPage = React.lazy(() => import('./components/SharedDesignPage.tsx'))
const sharedDesignId = window.location.pathname.match(/^\/d\/([A-Za-z0-9_-]{22})\/?$/)?.[1]

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {showErrorBoundarySmoke
        ? <ErrorBoundarySmokeTrigger />
        : isVideoTourPage
          ? <React.Suspense fallback={null}><VideoTourPage /></React.Suspense>
          : sharedDesignId
            ? <React.Suspense fallback={null}><SharedDesignPage id={sharedDesignId} /></React.Suspense>
            : <App />}
    </AppErrorBoundary>
  </React.StrictMode>,
)
