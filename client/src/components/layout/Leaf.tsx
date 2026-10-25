/** Crewly's mark: a simple two-stroke leaf. Inherits colour from `currentColor`. */
export const Leaf = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
    <path d="M5 19 13 11" />
  </svg>
);
