'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 1024; // lg in Tailwind

/**
 * Returns true when viewport width is below the mobile breakpoint (1024px).
 * Use for conditional mobile behavior (e.g. sidebar, card layout).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mql.matches);
    handler(); // initial
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
