import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getActiveTrack, trackFrameAt, halfWidthAt, getPaths, getPads, ROUTE_COLOURS, F_SOLID } from "../trackCurve";
import { THEMES } from "../data";
import { raceSnapshot, ZONES } from "../data";

const SIZE = 168;
const PAD = 14;

/** Lightens a hex colour by u, used for the elevation shading of the map. */
function shade(hex: string, u: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * (0.12 + 0.5 * u));
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** mean height, which decides the drawing order and the shade */
  h: number;
  zone: "water" | "sky" | "sub" | "mag" | null;
  route: boolean;
  /** colour of the route, by what kind of road it is */
  tint: string | null;
}

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segsRef = useRef<Seg[]>([]);
  const rangeRef = useRef({ hMin: 0, hSpan: 1 });
  const startRef = useRef({ x: 0, z: 0 });
  const portalsRef = useRef<{ x: number; z: number; ox: number; oz: number }[]>([]);
  const boundsRef = useRef({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 });
  // the static part of the map is painted once per palette, not once per frame
  const layerRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    // Every ribbon is cut into short pieces and the pieces are drawn lowest
    // first, each with a dark outline: where one road crosses over another the
    // upper one visibly cuts across the lower, so the levels read as levels.
    const segs: Seg[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let hMin = Infinity;
    let hMax = -Infinity;
    for (const path of getPaths()) {
      const every = Math.max(1, Math.round(9 / path.ds));
      const last = path.closed ? path.n : path.n - 1;
      for (let i = 0; i < last; i += every) {
        const j = path.closed ? (i + every) % path.n : Math.min(path.n - 1, i + every);
        if (!(path.flags[i] & F_SOLID) || !(path.flags[j] & F_SOLID)) continue;
        const t = path.prog[i];
        const zone = path.main ? ZONES.find((z) => t >= z.t0 && t <= z.t1) : undefined;
        const h = (path.py[i] + path.py[j]) / 2;
        segs.push({ ax: path.px[i], az: path.pz[i], bx: path.px[j], bz: path.pz[j], h, zone: zone?.type ?? null, route: !path.main, tint: path.main ? null : ROUTE_COLOURS[path.def?.kind ?? "side"] });
        minX = Math.min(minX, path.px[i]);
        maxX = Math.max(maxX, path.px[i]);
        minZ = Math.min(minZ, path.pz[i]);
        maxZ = Math.max(maxZ, path.pz[i]);
        hMin = Math.min(hMin, h);
        hMax = Math.max(hMax, h);
      }
    }
    segs.sort((a, b) => a.h - b.h);
    segsRef.current = segs;
    rangeRef.current = { hMin, hSpan: Math.max(1, hMax - hMin) };
    boundsRef.current = { minX, maxX, minZ, maxZ };
    const main = getPaths()[0];
    startRef.current = { x: main.px[0], z: main.pz[0] };
    layerRef.current = null;

    const trk = getActiveTrack();
    portalsRef.current = (trk.portals ?? []).map((pr) => {
      const f = trackFrameAt(pr.tIn);
      const p = f.point.clone().addScaledVector(f.normal, pr.side * (halfWidthAt(pr.tIn) - 2.6));
      const o = trackFrameAt(pr.tOut);
      const op = o.point.clone().addScaledVector(o.normal, pr.side * (halfWidthAt(pr.tOut) - 2.6));
      return { x: p.x, z: p.z, ox: op.x, oz: op.z };
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const theme = raceSnapshot.theme;
      const { minX, maxX, minZ, maxZ } = boundsRef.current;
      const w = maxX - minX || 1;
      const h = maxZ - minZ || 1;
      const scale = Math.min((SIZE - PAD * 2) / w, (SIZE - PAD * 2) / h);
      const ox = (SIZE - w * scale) / 2 - minX * scale;
      const oy = (SIZE - h * scale) / 2 - minZ * scale;
      const toX = (x: number) => x * scale + ox;
      const toY = (z: number) => z * scale + oy;
      const { hMin, hSpan } = rangeRef.current;

      const key = `${theme.road}|${theme.water}|${theme.glow}|${theme.barrierA}`;
      if (!layerRef.current || layerRef.current.key !== key) {
        const layer = document.createElement("canvas");
        layer.width = SIZE;
        layer.height = SIZE;
        const g = layer.getContext("2d")!;
        // plate
        g.fillStyle = "rgba(255,255,255,0.30)";
        g.beginPath();
        if (typeof g.roundRect === "function") g.roundRect(2, 2, SIZE - 4, SIZE - 4, 20);
        else g.rect(2, 2, SIZE - 4, SIZE - 4);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.75)";
        g.lineWidth = 2;
        g.stroke();

        g.lineCap = "round";
        g.lineJoin = "round";
        for (const s of segsRef.current) {
          const u = (s.h - hMin) / hSpan;
          const wide = s.route ? 4 : 6;
          g.beginPath();
          g.moveTo(toX(s.ax), toY(s.az));
          g.lineTo(toX(s.bx), toY(s.bz));
          g.strokeStyle = "rgba(10,40,70,0.55)";
          g.lineWidth = wide + 3;
          g.stroke();
          // higher is lighter; zones keep their own colour
          g.strokeStyle =
            s.zone === "water" ? theme.water : s.zone === "sky" ? theme.glow : s.zone === "sub" ? "#3b82f6" : s.zone === "mag" ? "#e879f9" : s.tint ?? shade(theme.road, u);
          g.lineWidth = wide;
          g.stroke();
        }

        // warps: entry ring on the side you have to aim at, dashed link to the exit
        for (const pr of portalsRef.current) {
          const x = toX(pr.x);
          const y = toY(pr.z);
          g.save();
          g.setLineDash([2, 4]);
          g.strokeStyle = "rgba(124,92,255,0.55)";
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(toX(pr.ox), toY(pr.oz));
          g.stroke();
          g.restore();
          g.strokeStyle = "#7c5cff";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x, y, 4.6, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = "rgba(124,92,255,0.35)";
          g.fill();
        }
        // where the lap crosses into another aesthetic: a dot in that aesthetic's colour
        const main = getPaths()[0];
        for (const s of (getActiveTrack().sectors ?? []).slice(1)) {
          const i = Math.round(main.n * s.t0) % main.n;
          g.beginPath();
          g.arc(toX(main.px[i]), toY(main.pz[i]), 3.4, 0, Math.PI * 2);
          g.fillStyle = THEMES[s.theme].glow;
          g.fill();
          g.strokeStyle = "rgba(10,30,50,0.8)";
          g.lineWidth = 1.2;
          g.stroke();
        }
        // cannons: a filled triangle at the mouth, a line to where it sets you down
        for (const pad of getPads()) {
          if (pad.kind !== "cannon") continue;
          const x = toX(pad.pos.x);
          const y = toY(pad.pos.z);
          g.strokeStyle = "#ff4d6d";
          g.lineWidth = 1.6;
          g.setLineDash([3, 3]);
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(toX(main.px[pad.toIdx]), toY(main.pz[pad.toIdx]));
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = "#ff4d6d";
          g.beginPath();
          g.moveTo(x, y - 5);
          g.lineTo(x + 4.5, y + 4);
          g.lineTo(x - 4.5, y + 4);
          g.closePath();
          g.fill();
        }
        layerRef.current = { key, canvas: layer };
      }

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(layerRef.current.canvas, 0, 0);
      const pts = [{ x: startRef.current.x, y: startRef.current.z }];

      // start line
      const s = pts[0];
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(toX(s.x), toY(s.y), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // racers
      for (const r of raceSnapshot.racers) {
        const x = toX(r.x);
        const y = toY(r.z);
        if (r.isPlayer) {
          ctx.beginPath();
          ctx.arc(x, y, 7.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fill();
          // heading arrow
          const a = raceSnapshot.camAngle;
          ctx.beginPath();
          ctx.moveTo(x + Math.sin(a) * 9, y + Math.cos(a) * 9);
          ctx.lineTo(x + Math.sin(a + 2.5) * 5, y + Math.cos(a + 2.5) * 5);
          ctx.lineTo(x + Math.sin(a - 2.5) * 5, y + Math.cos(a - 2.5) * 5);
          ctx.closePath();
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, 4.2, 0, Math.PI * 2);
          ctx.fillStyle = r.color;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        if (r.isPlayer) {
          // little altitude tick: shows how high the road is right now
          const u = Math.max(0, Math.min(1, (r.y - hMin) / hSpan));
          ctx.beginPath();
          ctx.arc(x, y, 7.5, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2);
          ctx.strokeStyle = shade(theme.glow, u);
          ctx.lineWidth = 2.4;
          ctx.stroke();
        }
        if (r.mode === "plane") {
          ctx.beginPath();
          ctx.arc(x, y, 9.5, 0, Math.PI * 2);
          ctx.strokeStyle = theme.glow;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="pointer-events-none drop-shadow-lg"
      style={{ width: SIZE, height: SIZE }}
    />
  );
}

export const minimapSize = SIZE;
export const tmpVec = new THREE.Vector3();
