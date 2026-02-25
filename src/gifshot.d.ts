// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

declare module 'gifshot' {
  interface GifshotOptions {
    images?: string[];
    gifWidth?: number;
    gifHeight?: number;
    interval?: number;
    numFrames?: number;
    frameDuration?: number;
    sampleInterval?: number;
  }

  interface GifshotResult {
    error: boolean | string;
    image?: string;
  }

  export function createGIF(
    options: GifshotOptions,
    callback: (result: GifshotResult) => void
  ): void;
}
