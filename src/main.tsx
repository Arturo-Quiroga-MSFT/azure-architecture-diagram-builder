// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { initTelemetry } from './services/telemetryService'
import './index.css'

// Initialize Application Insights telemetry (no-ops if not configured)
initTelemetry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
