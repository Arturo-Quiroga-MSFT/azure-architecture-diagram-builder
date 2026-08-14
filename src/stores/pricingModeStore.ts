import { useEffect, useState } from 'react';
import type { PricingMode } from '../services/costEstimationService';

let currentMode: PricingMode = 'payg';
const listeners = new Set<(mode: PricingMode) => void>();

export function getPricingMode(): PricingMode {
  return currentMode;
}

export function setPricingMode(mode: PricingMode): void {
  currentMode = mode;
  listeners.forEach((listener) => listener(mode));
}

export function usePricingMode(): [PricingMode, (mode: PricingMode) => void] {
  const [mode, setMode] = useState(currentMode);
  useEffect(() => {
    listeners.add(setMode);
    return () => { listeners.delete(setMode); };
  }, []);
  return [mode, setPricingMode];
}
