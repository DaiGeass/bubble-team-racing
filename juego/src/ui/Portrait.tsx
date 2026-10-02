import type { CharacterDef } from "../data";

let uid = 0;

/** HSL helpers to push saturation so every racer pops like wet glass. */
function hsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function toHex(h: number, s: number, l: number): string {
  const f = (p: number, q: number, t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, h + 1 / 3);
    g = f(p, q, h);
    b = f(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function pop(hex: string, sat: number, light: number): string {
  const [h, s, l] = hsl(hex);
  return toHex(h, Math.min(1, s * sat), Math.min(0.92, Math.max(0.42, l * light)));
}

function Fac({ char, y = 0 }: { char: CharacterDef; y?: number }) {
  const dark = "#12172b";
  return (
    <g transform={`translate(0 ${y})`}>
      {char.eye === "visor" ? (
        <>
          <rect x="29" y="45" width="42" height="13" rx="6.5" fill={dark} />
          <rect x="33" y="48" width="16" height="5" rx="2.5" fill={char.accent} />
          <rect x="53" y="48" width="12" height="5" rx="2.5" fill="#ffffff" opacity="0.75" />
          <rect x="31" y="46.5" width="38" height="2" rx="1" fill="#ffffff" opacity="0.5" />
        </>
      ) : char.eye === "sleepy" ? (
        <>
          <path d="M32 53 Q39 46 46 53" stroke={dark} strokeWidth="3.8" fill="none" strokeLinecap="round" />
          <path d="M54 53 Q61 46 68 53" stroke={dark} strokeWidth="3.8" fill="none" strokeLinecap="round" />
          <path d="M34 58 Q39 61 44 58" stroke={dark} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.45" />
          <path d="M56 58 Q61 61 66 58" stroke={dark} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.45" />
        </>
      ) : (
        <>
          <ellipse cx="38" cy="51.5" rx="8.2" ry="10.4" fill="#ffffff" />
          <ellipse cx="62" cy="51.5" rx="8.2" ry="10.4" fill="#ffffff" />
          <ellipse cx="39.5" cy="53" rx="5.6" ry="7.2" fill={dark} />
          <ellipse cx="60.5" cy="53" rx="5.6" ry="7.2" fill={dark} />
          <ellipse cx="39.5" cy="53" rx="5.6" ry="7.2" fill={char.accent} opacity="0.35" />
          <ellipse cx="60.5" cy="53" rx="5.6" ry="7.2" fill={char.accent} opacity="0.35" />
          <circle cx="42" cy="49.5" r="2.7" fill="#fff" />
          <circle cx="63" cy="49.5" r="2.7" fill="#fff" />
          <circle cx="36.5" cy="57.5" r="1.5" fill="#fff" opacity="0.9" />
          <circle cx="57.5" cy="57.5" r="1.5" fill="#fff" opacity="0.9" />
          {char.eye === "sharp" && (
            <>
              <path d="M29 41 L46 44.5" stroke={char.accent} strokeWidth="3.2" strokeLinecap="round" />
              <path d="M71 41 L54 44.5" stroke={char.accent} strokeWidth="3.2" strokeLinecap="round" />
            </>
          )}
        </>
      )}
      <path d="M43.5 62.5 Q50 68.5 56.5 62.5" stroke={char.accent} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <ellipse cx="27.5" cy="58.5" rx="6.2" ry="3.8" fill="#ff5fae" opacity="0.55" />
      <ellipse cx="72.5" cy="58.5" rx="6.2" ry="3.8" fill="#ff5fae" opacity="0.55" />
    </g>
  );
}

function Sparkles() {
  return (
    <g>
      <path d="M22 22 l2.6 6 6 2.6 -6 2.6 -2.6 6 -2.6 -6 -6 -2.6 6 -2.6 z" fill="#ffffff" opacity="0.95" />
      <path d="M80 30 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 z" fill="#ffffff" opacity="0.8" />
      <path d="M74 74 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 z" fill="#ffffff" opacity="0.7" />
      <circle cx="28" cy="70" r="1.6" fill="#ffffff" opacity="0.8" />
      <circle cx="66" cy="16" r="1.3" fill="#ffffff" opacity="0.7" />
      <path d="M8 46 q6 -4 12 0" stroke="#ffffff" strokeWidth="1.6" fill="none" opacity="0.35" strokeLinecap="round" />
    </g>
  );
}

export default function Portrait({ char, size = 96, className = "" }: { char: CharacterDef; size?: number; className?: string }) {
  const gid = `pf${uid++}`;
  const form = char.form;
  const primary = pop(char.primary, 1.32, 1.02);
  const accent = pop(char.accent, 1.4, 0.82);
  const secondary = char.secondary;
  const glass = { primary, secondary, accent, form, eye: char.eye, name: char.name } as CharacterDef;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label={char.name}>
      <defs>
        <radialGradient id={`${gid}bg`} cx="32%" cy="22%" r="92%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor={secondary} />
          <stop offset="78%" stopColor={primary} stopOpacity="0.55" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`${gid}b`} cx="38%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor={primary} />
          <stop offset="78%" stopColor={primary} />
          <stop offset="100%" stopColor={accent} />
        </radialGradient>
        <linearGradient id={`${gid}gl`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gid}pr`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8be9ff" stopOpacity="0.85" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#ff8fd6" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#ffd166" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="49" fill={`url(#${gid}bg)`} />

      {form === "drop" && (
        <g>
          <path d="M50 4 C63 26 82 41 82 61 C82 80 67 92 50 92 C33 92 18 80 18 61 C18 41 37 26 50 4 Z" fill={`url(#${gid}b)`} stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2.4" />
          <ellipse cx="36" cy="30" rx="10" ry="16" fill={`url(#${gid}gl)`} transform="rotate(-18 36 30)" />
          <path d="M28 46 q-6 12 -2 22" stroke={`url(#${gid}pr)`} strokeWidth="3.2" fill="none" opacity="0.75" strokeLinecap="round" />
          <circle cx="68" cy="72" r="5.5" fill="#ffffff" opacity="0.4" />
          <Fac char={glass} y={5} />
        </g>
      )}
      {form === "bubble" && (
        <g>
          <circle cx="50" cy="52" r="39" fill={primary} opacity="0.32" />
          <circle cx="50" cy="52" r="39" fill="none" stroke="#ffffff" strokeOpacity="0.95" strokeWidth="3" />
          <circle cx="50" cy="52" r="39" fill="none" stroke={`url(#${gid}pr)`} strokeWidth="6" strokeDasharray="5 15" opacity="0.8" />
          <circle cx="50" cy="54" r="25" fill={`url(#${gid}b)`} />
          <ellipse cx="35" cy="28" rx="13" ry="7.5" fill="#ffffff" opacity="0.95" transform="rotate(-24 35 28)" />
          <circle cx="78" cy="33" r="6.5" fill={primary} opacity="0.6" />
          <circle cx="20" cy="68" r="5" fill={primary} opacity="0.55" />
          <circle cx="76" cy="72" r="3.2" fill="#ffffff" opacity="0.7" />
          <Fac char={glass} y={3} />
        </g>
      )}
      {form === "leaf" && (
        <g>
          <path d="M50 22 Q59 11 66 5 Q63 17 58 24" fill={accent} stroke={accent} strokeWidth="2.2" strokeLinejoin="round" />
          <ellipse cx="50" cy="58" rx="32" ry="34" fill={`url(#${gid}b)`} stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2.4" />
          <path d="M50 28 Q50 58 50 88" stroke={secondary} strokeWidth="2.6" opacity="0.7" fill="none" />
          <path d="M50 42 Q63 47 72 56 M50 42 Q37 47 28 56 M50 62 Q61 67 68 74 M50 62 Q39 67 32 74" stroke={secondary} strokeWidth="1.9" opacity="0.55" fill="none" />
          <ellipse cx="36" cy="34" rx="14" ry="8" fill={`url(#${gid}gl)`} transform="rotate(-16 36 34)" />
          <path d="M24 64 q-4 10 -1 17" stroke={`url(#${gid}pr)`} strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
          <Fac char={glass} y={2} />
        </g>
      )}
      {form === "crystal" && (
        <g>
          <polygon points="50,6 84,39 50,94 16,39" fill={`url(#${gid}b)`} stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2.4" strokeLinejoin="round" />
          <polygon points="50,6 84,39 50,53 16,39" fill="#ffffff" opacity="0.32" />
          <polygon points="50,6 61,39 50,53 39,39" fill="#ffffff" opacity="0.45" />
          <polygon points="50,6 84,39 50,53" fill={`url(#${gid}pr)`} opacity="0.55" />
          <line x1="16" y1="39" x2="84" y2="39" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.6" />
          <circle cx="70" cy="24" r="2.8" fill="#ffffff" />
          <circle cx="28" cy="62" r="2.2" fill="#ffffff" opacity="0.85" />
          <Fac char={glass} y={7} />
        </g>
      )}
      {form === "holo" && (
        <g>
          <rect x="18" y="20" width="64" height="64" rx="15" fill={`url(#${gid}b)`} opacity="0.9" />
          <rect x="18" y="20" width="64" height="64" rx="15" fill="none" stroke={secondary} strokeWidth="2.8" strokeDasharray="11 6" opacity="0.95" />
          <rect x="18" y="20" width="64" height="64" rx="15" fill={`url(#${gid}pr)`} opacity="0.3" />
          <rect x="23" y="29" width="54" height="3.5" fill="#ffffff" opacity="0.5" />
          <rect x="23" y="69" width="54" height="3.5" fill="#ffffff" opacity="0.32" />
          <circle cx="50" cy="13" r="5.5" fill={accent} />
          <line x1="50" y1="20" x2="50" y2="16" stroke={accent} strokeWidth="2.8" />
          <ellipse cx="34" cy="31" rx="13" ry="6.5" fill={`url(#${gid}gl)`} transform="rotate(-12 34 31)" />
          <Fac char={glass} y={3} />
        </g>
      )}
      {form === "cloud" && (
        <g>
          <circle cx="31" cy="52" r="20" fill={`url(#${gid}b)`} />
          <circle cx="69" cy="52" r="20" fill={`url(#${gid}b)`} />
          <circle cx="50" cy="39" r="23" fill={`url(#${gid}b)`} />
          <rect x="23" y="52" width="54" height="21" rx="10.5" fill={`url(#${gid}b)`} />
          <ellipse cx="39" cy="28" rx="15" ry="7.5" fill={`url(#${gid}gl)`} transform="rotate(-10 39 28)" />
          <path d="M20 40 q-5 11 -2 20" stroke={`url(#${gid}pr)`} strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
          <circle cx="22" cy="80" r="3.2" fill={primary} opacity="0.6" />
          <circle cx="78" cy="82" r="2.6" fill={primary} opacity="0.55" />
          <Fac char={glass} y={2} />
        </g>
      )}
      {form === "star" && (
        <g>
          <path d="M50 4 L61 35 L94 37 L67 56 L78 90 L50 69 L22 90 L33 56 L6 37 L39 35 Z" fill={`url(#${gid}b)`} stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M50 4 L61 35 L94 37 L67 56 Z" fill={`url(#${gid}pr)`} opacity="0.5" />
          <ellipse cx="39" cy="33" rx="12" ry="7" fill={`url(#${gid}gl)`} transform="rotate(-14 39 33)" />
          <circle cx="80" cy="20" r="2.6" fill="#ffffff" />
          <circle cx="17" cy="25" r="2" fill="#ffffff" opacity="0.9" />
          <Fac char={glass} y={5} />
        </g>
      )}
      {form === "flame" && (
        <g>
          <path d="M50 2 C57 20 76 28 76 52 C76 73 65 90 50 90 C35 90 24 73 24 52 C24 39 33 33 35 22 C41 31 46 29 50 2 Z" fill={`url(#${gid}b)`} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2.2" />
          <path d="M50 28 C54 39 64 43 64 58 C64 71 57 80 50 80 C43 80 36 71 36 58 C36 47 45 43 50 28 Z" fill={secondary} opacity="0.82" />
          <ellipse cx="39" cy="32" rx="9" ry="13" fill={`url(#${gid}gl)`} transform="rotate(-14 39 32)" />
          <path d="M30 44 q-5 12 -1 21" stroke={`url(#${gid}pr)`} strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
          <Fac char={glass} y={5} />
        </g>
      )}

      <Sparkles />
      {/* prism rim + gloss dome */}
      <ellipse cx="36" cy="17" rx="23" ry="9.5" fill="#ffffff" opacity="0.42" transform="rotate(-18 36 17)" />
      <circle cx="50" cy="50" r="49" fill="none" stroke={`url(#${gid}pr)`} strokeOpacity="0.85" strokeWidth="3" />
      <circle cx="50" cy="50" r="46.5" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.6" />
    </svg>
  );
}
