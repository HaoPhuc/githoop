import type { CSSProperties } from "react";
import type { Line } from "@/lib/lines";

export const COURT_POSITIONS: Record<Line, CSSProperties> = {
  C: { left: "50%", top: "29%" },
  PF: { left: "22%", top: "49%" },
  SF: { left: "78%", top: "49%" },
  SG: { left: "27%", top: "80%" },
  PG: { left: "73%", top: "80%" },
};

export default function CourtMarkings() {
  return <svg aria-hidden="true" viewBox="0 0 560 487" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
    <g fill="none" stroke="#f9d5a5" strokeOpacity=".4" strokeWidth="2">
      <path d="M12 12H548V475H12Z" />
      <path d="M195 12V196H365V12" fill="#b87c44" fillOpacity=".25" />
      <circle cx="280" cy="196" r="62" />
      <path d="M58 12V108C58 408 502 408 502 108V12" />
      <path d="M241 48H319" strokeWidth="4" />
      <circle cx="280" cy="65" r="12" stroke="#ff9b4d" strokeWidth="4" strokeOpacity="1" />
      <path d="M233 475a47 47 0 0 1 94 0" />
    </g>
  </svg>;
}
