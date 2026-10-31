export default function Background() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-bg">
      <svg className="absolute bottom-0 left-1/2 h-[70%] min-h-[420px] w-[130%] min-w-[900px] -translate-x-1/2 text-[#f28a43] opacity-[0.055]" viewBox="0 0 1400 700" fill="none" stroke="currentColor" strokeWidth="4">
        <rect x="25" y="25" width="1350" height="650" rx="4" />
        <path d="M700 25v650M25 220h240v260H25M1375 220h-240v260h240" />
        <circle cx="700" cy="350" r="96" />
        <circle cx="265" cy="350" r="80" />
        <circle cx="1135" cy="350" r="80" />
        <path d="M25 80h95a285 285 0 0 1 0 540H25M1375 80h-95a285 285 0 0 0 0 540h95" />
      </svg>
    </div>
  );
}
