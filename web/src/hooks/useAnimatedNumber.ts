"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Smoothly animate a number from its previous value to the current target.
 *
 * Uses requestAnimationFrame with ease-out interpolation so the counter
 * decelerates naturally as it approaches the final value.
 *
 * @param target  The number to animate towards
 * @param duration  Animation duration in ms (default 400)
 * @returns The current interpolated value
 */
export function useAnimatedNumber(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;

    // Nothing to animate
    if (from === target) return;

    // Cancel any running animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;

      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // Snap to exact target at the end
        fromRef.current = target;
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  // Keep fromRef in sync when target changes while not animating
  // (handled by the snap at end of animation above)

  return display;
}
