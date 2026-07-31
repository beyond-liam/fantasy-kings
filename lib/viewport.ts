export const MOBILE_BREAKPOINT = 768;

const MOBILE_UA = /Android|iPhone|iPod|IEMobile|Opera Mini|Mobile|webOS/i;
const TABLET_UA = /iPad|Tablet|Silk/i;

/**
 * Best-effort device guess for the first server render so mobile layouts are
 * correct before hydration. The media query takes over once mounted.
 */
export function isMobileUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return false;
  if (TABLET_UA.test(userAgent)) return false;
  return MOBILE_UA.test(userAgent);
}
