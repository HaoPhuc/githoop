"use client";

import { useEffect } from "react";

// Brings the searched player's row into view. The server already rendered the
// page they're on; this centres them on it, after the router's own scroll-to-top.
export default function ScrollToRow({ id }: { id: string }) {
  useEffect(() => {
    const raf = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return null;
}
