// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useEffect, useRef } from 'react';

// Open dialogs and panels, oldest first. Escape closes only the most recently
// opened one, so a modal on top of a side panel closes before the panel does.
const stack: Array<{ close: () => void }> = [];

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.preventDefault();
  top.close();
}

/**
 * Close a dialog or panel with the Escape key while it is open.
 * Nested dialogs stack: the top-most one closes first.
 */
export function useEscapeToClose(isOpen: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const entry = { close: () => closeRef.current() };
    if (stack.length === 0) window.addEventListener('keydown', onKeyDown);
    stack.push(entry);
    return () => {
      const index = stack.indexOf(entry);
      if (index >= 0) stack.splice(index, 1);
      if (stack.length === 0) window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);
}
