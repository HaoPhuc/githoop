"use client";

import { memo } from "react";

// Original basketball mark, shared by the home page and loading states.
// Legacy `kick`/`ball` props remain accepted for shared call sites.
interface MascotProps {
  size?: number;
  className?: string;
  animate?: boolean;
  /** @deprecated ball is baked into the asset; kept for call-site compatibility */
  kick?: boolean;
  /** @deprecated ball is baked into the asset; kept for call-site compatibility */
  ball?: boolean;
}

function Mascot({ size = 220, className, animate = true }: MascotProps) {
  return (
    <img
      src="/basketball.svg"
      alt="GitHoop basketball"
      width={size}
      height={size}
      className={`${animate ? "animate-float" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

export default memo(Mascot);
