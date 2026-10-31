const noiseSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2"/></filter><rect width="120" height="120" filter="url(#n)"/></svg>';
const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent(noiseSvg)}")`;

// Faint GitHub-contribution-grid motif — a brand signature drawn into the
// backdrop. A few cells gently pulse orange (see .gf-grid-cell in globals.css).
//
// The grid is fully deterministic, so we precompute it ONCE as a static SVG string and inject it via
// dangerouslySetInnerHTML. This serializes as a single node in the RSC flight instead of 210 separate
// <rect> flight nodes (each ~90B escaped), shrinking the inline hydration payload — while preserving the
// exact rects, rounded corners, and per-cell pulse animations (class + --gf-dur inlined into the string).
const CONTRIB_GRID_SVG = (() => {
  const cols = 30;
  const rows = 7;
  let rects = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (r * 7 + c * 13) % 11;
      const lit = seed < 3;
      const attrs = lit
        ? ` fill="#f28a43" class="gf-grid-cell" style="--gf-dur:${2.4 + seed * 0.4}s"`
        : ` fill="#23140a"`;
      rects += `<rect x="${c * 16}" y="${r * 16}" width="12" height="12" rx="2.5"${attrs}/>`;
    }
  }
  return `<svg width="${cols * 16}" height="${rows * 16}" viewBox="0 0 ${cols * 16} ${rows * 16}" style="width:100%;height:100%" aria-hidden="true">${rects}</svg>`;
})();

function ContribGrid() {
  return (
    <div
      aria-hidden
      style={{ width: "100%", height: "100%" }}
      dangerouslySetInnerHTML={{ __html: CONTRIB_GRID_SVG }}
    />
  );
}

// The tech layer: hexagon mesh, circuit traces, light streaks, chevrons and data
// columns on a 1600x900 canvas that covers the viewport, over the lines of a
// court. Precomputed once as a string for the same reason as the grid above.
const HEX_R = 62;

const hexPath = (cx: number, cy: number, r: number) => {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    d += `${i ? "L" : "M"}${Math.round(cx + r * Math.cos(a))} ${Math.round(cy + r * Math.sin(a))}`;
  }
  return `${d}Z`;
};

// A rough disc of hexagons with a few gaps, so it reads as a mesh, not a tiling.
const hexField = (cx: number, cy: number, r: number, radius: number) => {
  const w = Math.sqrt(3) * r;
  const h = 1.5 * r;
  const reach = Math.ceil(radius / h) + 1;
  let cells = "";
  let filled = "";
  for (let row = -reach; row <= reach; row++) {
    for (let col = -reach; col <= reach; col++) {
      const x = cx + (col + (row & 1 ? 0.5 : 0)) * w;
      const y = cy + row * h;
      if (Math.hypot(x - cx, y - cy) > radius) continue;
      const seed = (((row * 7 + col * 13) % 11) + 11) % 11;
      if (seed === 0) continue;
      const d = hexPath(x, y, r - 1);
      cells += d;
      if (seed < 4) filled += d;
    }
  }
  return { cells, filled };
};

const chevrons = (x: number, y: number, count: number, dir = 1, s = 11, w = 8) => {
  let d = "";
  for (let i = 0; i < count; i++) {
    const px = x + dir * i * 20;
    d += `M${px} ${y}h${dir * w}l${dir * s} ${s}l${-dir * s} ${s}h${-dir * w}l${dir * s} ${-s}z`;
  }
  return d;
};

const ticks = (x: number, y: number, count: number, w = 26, h = 11, gap = 8) => {
  let d = "";
  for (let i = 0; i < count; i++) {
    d += `M${x + i * (w + gap)} ${y}h${w}l-${h} ${h}h-${w}z`;
  }
  return d;
};

const TRACES = [
  "M0 48H96L132 84H284L316 52H452",
  "M0 84H72L120 132H236",
  "M0 120H48L104 176H180",
  "M188 0V30L214 56H340",
  "M1600 836H1480L1444 800H1280L1248 832H1110",
  "M1600 800H1520L1476 756H1360",
  "M1412 900V868L1386 842H1262",
];
const TRACE_ENDS = [
  [452, 52],
  [236, 132],
  [180, 176],
  [340, 56],
  [1110, 832],
  [1360, 756],
  [1262, 842],
];
const STREAKS = [
  [930, 150, 420],
  [1010, 330, 360],
  [1180, 90, 300],
  [1120, 520, 340],
  [40, 560, 300],
  [90, 760, 240],
];
const NODES = [
  [1078, 292, 92],
  [1205, 437, 120],
  [1388, 206, 74],
  [1490, 610, 64],
  [172, 604, 78],
  [226, 742, 58],
];
const COLUMNS = [64, 118, 196, 262, 1296, 1446, 1534];

const TECH_SVG = (() => {
  const main = hexField(1190, 400, HEX_R, 380);
  const side = hexField(170, 660, HEX_R * 0.62, 190);
  const streaks = STREAKS.map(
    ([x, y, len]) =>
      `<path d="M${x} ${y}l${len} ${Math.round(len * 0.36)}" stroke="url(#gf-t-streak)" stroke-width="2"/>`,
  ).join("");
  const nodes = NODES.map(
    ([x, y, r], i) =>
      `<g class="gf-tech-pulse" style="--gf-dur:${3.2 + i * 0.7}s">` +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#gf-t-glow)"/>` +
      `<rect x="${x - r * 1.7}" y="${y - 1}" width="${r * 3.4}" height="2" fill="url(#gf-t-flare)"/>` +
      `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff1e0"/></g>`,
  ).join("");
  const columns = COLUMNS.map((x, i) => `<path d="M${x} ${180 + (i % 3) * 90}V${900 - (i % 2) * 150}"/>`).join("");
  return (
    `<svg width="100%" height="100%" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">` +
    `<defs>` +
    `<radialGradient id="gf-t-glow"><stop offset="0" stop-color="#ffd199" stop-opacity=".75"/><stop offset=".3" stop-color="#f28a43" stop-opacity=".28"/><stop offset="1" stop-color="#c2570f" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="gf-t-streak"><stop offset="0" stop-color="#ffab68" stop-opacity="0"/><stop offset=".55" stop-color="#ffab68" stop-opacity=".8"/><stop offset="1" stop-color="#ffab68" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="gf-t-flare"><stop offset="0" stop-color="#ffe0bd" stop-opacity="0"/><stop offset=".5" stop-color="#ffe0bd"/><stop offset="1" stop-color="#ffe0bd" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="gf-t-hex" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2570f" stop-opacity=".16"/><stop offset="1" stop-color="#5a2506" stop-opacity=".05"/></linearGradient>` +
    `</defs>` +
    `<g stroke="#f28a43" stroke-opacity=".2" stroke-dasharray="2 9">${columns}</g>` +
    `<path d="${main.filled}${side.filled}" fill="url(#gf-t-hex)"/>` +
    `<path d="${main.cells}${side.cells}" stroke="#f28a43" stroke-opacity=".2"/>` +
    `<g stroke="#f28a43" stroke-opacity=".3">${TRACES.map((d) => `<path d="${d}"/>`).join("")}</g>` +
    `<g fill="#ffab68" fill-opacity=".6">${TRACE_ENDS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join("")}</g>` +
    streaks +
    nodes +
    `<path d="${chevrons(30, 420, 5)}${chevrons(1490, 118, 3)}${chevrons(1560, 700, 5, -1)}" fill="#ffab68" fill-opacity=".55"/>` +
    `<path d="${ticks(66, 256, 3)}${ticks(56, 274, 3)}${ticks(1424, 520, 4)}" fill="#f28a43" fill-opacity=".4"/>` +
    `</svg>`
  );
})();

export default function Background() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-bg">
      {/* amber ambient, top spotlight */}
      <div
        className="animate-flood absolute"
        style={{
          top: "-34%",
          left: "50%",
          width: "120%",
          height: "92%",
          background:
            "radial-gradient(50% 62% at 50% 0%, rgba(200,90,20,.2), rgba(10,6,3,.2) 46%, rgba(10,6,3,0) 72%)",
        }}
      />
      {/* the court, painted on the floor */}
      <svg
        className="absolute bottom-0 left-1/2 h-[70%] min-h-[420px] w-[130%] min-w-[900px] -translate-x-1/2 text-[#f28a43] opacity-[0.08]"
        viewBox="0 0 1400 700"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      >
        <rect x="25" y="25" width="1350" height="650" rx="4" />
        <path d="M700 25v650M25 220h240v260H25M1375 220h-240v260h240" />
        <circle cx="700" cy="350" r="96" />
        <circle cx="265" cy="350" r="80" />
        <circle cx="1135" cy="350" r="80" />
        <path d="M25 80h95a285 285 0 0 1 0 540H25M1375 80h-95a285 285 0 0 0 0 540h95" />
      </svg>
      {/* tech layer, held to the viewport so tall pages don't stretch it. The
          scrim keeps the middle of the page dark behind the content. */}
      <div className="fixed inset-0">
        <div
          aria-hidden
          style={{ width: "100%", height: "100%" }}
          dangerouslySetInnerHTML={{ __html: TECH_SVG }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(44% 62% at 50% 46%, rgba(10,6,3,.8), rgba(10,6,3,0) 100%)" }}
        />
      </div>
      {/* deep floor vignette */}
      <div
        className="absolute"
        style={{
          bottom: "-24%",
          left: "50%",
          width: "150%",
          height: "55%",
          transform: "translateX(-50%)",
          background: "radial-gradient(60% 100% at 50% 100%, rgba(5,3,2,.85), transparent 72%)",
        }}
      />
      {/* contribution-grid motif, faint along the bottom. Hidden below 980px:
          narrow layouts stack content much taller than one viewport, so this
          "floor" strip ends up floating behind mid-page content instead of
          only at the true bottom. */}
      <div
        className="absolute bottom-0 left-0 right-0 max-[980px]:hidden"
        style={{ height: "16%", opacity: 0.5, maskImage: "linear-gradient(to top, #000, transparent)", WebkitMaskImage: "linear-gradient(to top, #000, transparent)" }}
      >
        <ContribGrid />
      </div>
      <div className="absolute inset-0" style={{ opacity: 0.04, backgroundImage: NOISE, mixBlendMode: "overlay" }} />
    </div>
  );
}
