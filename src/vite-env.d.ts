// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/// <reference types="vite/client" />

declare const __ENABLE_ADOPTION_IMPACT__: boolean
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_ENABLE_ADOPTION_IMPACT?: string
  // add more env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
  readonly glob: (pattern: string, options?: { eager?: boolean; as?: string }) => Record<string, any>
}
