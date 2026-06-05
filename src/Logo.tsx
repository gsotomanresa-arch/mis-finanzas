export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6c63ff" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#logoGrad)" />
      <ellipse cx="20" cy="26" rx="10" ry="4" fill="white" fillOpacity="0.18" />
      <ellipse cx="20" cy="22" rx="10" ry="4" fill="white" fillOpacity="0.22" />
      <ellipse cx="20" cy="18" rx="10" ry="4" fill="white" fillOpacity="0.3" />
      <ellipse cx="20" cy="14" rx="10" ry="4" fill="white" fillOpacity="0.9" />
      <text x="20" y="17.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#6c63ff" fontFamily="system-ui">€</text>
      <path d="M24 8 L28 4 L28 7 L32 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
