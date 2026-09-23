export function FootballIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <g transform="rotate(-30 12 12)">
        <ellipse cx="12" cy="12" rx="10" ry="6.2" />
        <path d="M5.5 12h13" />
        <path d="M9.5 10.2v3.6M12 10.2v3.6M14.5 10.2v3.6" />
      </g>
    </svg>
  );
}
