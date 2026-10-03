import { useEffect, useRef } from "react";
import * as THREE from "three";
import { trackCurve, getShortcuts, getActiveTrack, trackFrameAt, halfWidthAt } from "../trackCurve";
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

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathRef = useRef<{ x: number; y: number; h: number; zone: "water" | "sky" | "sub" | null }[]>([]);
  const scRef = useRef<{ ax: number; ay: number; bx: number; by: number }[]>([]);
  const marksRef = useRef<{
    gaps: { x: number; z: number; x1: number; z1: number }[];
    portals: { x: number; z: number; ox: number; oz: number }[];
  }>({ gaps: [], portals: [] });
  const boundsRef = useRef({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 });

  useEffect(() => {
    // project track once
    const pts: { x: number; y: number; h: number; zone: "water" | "sky" | "sub" | null }[] = [];
    scRef.current = getShortcuts().map((s) => ({ ax: s.entry.x, ay: s.entry.z, bx: s.exit.x, by: s.exit.z }));
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = trackCurve.getPointAt(t);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      const zone = ZONES.find((z) => t >= z.t0 && t <= z.t1);
      pts.push({ x: p.x, y: p.z, h: p.y, zone: zone?.type ?? null });
    }
    pathRef.current = pts;
    boundsRef.current = { minX, maxX, minZ, maxZ };

    // holes and warps are the two things that break a lap, so the map has to
    // show where they are and which side of the road they sit on
    const trk = getActiveTrack();
    marksRef.current = {
      gaps: (trk.gaps ?? []).map((g) => {
        const a = trackFrameAt(g.t0);
        const b = trackFrameAt(g.t1);
        return {
          x: a.point.x,
          z: a.point.z,
          x1: b.point.x,
          z1: b.point.z,
        };
      }),
      portals: (trk.portals ?? []).map((pr) => {
        const f = trackFrameAt(pr.tIn);
        const p = f.point.clone().addScaledVector(f.normal, pr.side * (halfWidthAt(pr.tIn) - 2.6));
        const o = trackFrameAt(pr.tOut);
        const op = o.point.clone().addScaledVector(o.normal, (pr.side === 1 ? -1 : 1) * (halfWidthAt(pr.tOut) - 2.6));
        return { x: p.x, z: p.z, ox: op.x, oz: op.z };
      }),
    };
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

      ctx.clearRect(0, 0, SIZE, SIZE);
      // plate
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(2, 2, SIZE - 4, SIZE - 4, 20);
      else ctx.rect(2, 2, SIZE - 4, SIZE - 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const pts = pathRef.current;
      if (pts.length === 0) return;

      // track body
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(toX(p.x), toY(p.y)) : ctx.lineTo(toX(p.x), toY(p.y))));
      ctx.closePath();
      ctx.strokeStyle = "rgba(10,50,80,0.35)";
      ctx.lineWidth = 9;
      ctx.stroke();
      // shade the ribbon by elevation so climbs and descents read at a glance
      const hs = pts.map((p) => p.h);
      const hMin = Math.min(...hs);
      const hSpan = Math.max(1, Math.max(...hs) - hMin);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const u = (a.h - hMin) / hSpan;
        ctx.beginPath();
        ctx.moveTo(toX(a.x), toY(a.y));
        ctx.lineTo(toX(b.x), toY(b.y));
        ctx.strokeStyle = shade(theme.road, u);
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      // zones
      ctx.lineWidth = 6;
      ctx.strokeStyle = theme.water;
      ctx.beginPath();
      let drawing = false;
      pts.forEach((p) => {
        if (p.zone === "water") {
          if (!drawing) {
            ctx.moveTo(toX(p.x), toY(p.y));
            drawing = true;
          } else ctx.lineTo(toX(p.x), toY(p.y));
        } else drawing = false;
      });
      ctx.stroke();

      ctx.strokeStyle = theme.glow;
      ctx.beginPath();
      drawing = false;
      pts.forEach((p) => {
        if (p.zone === "sky") {
          if (!drawing) {
            ctx.moveTo(toX(p.x), toY(p.y));
            drawing = true;
          } else ctx.lineTo(toX(p.x), toY(p.y));
        } else drawing = false;
      });
      ctx.stroke();

      // submarine section
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 6;
      ctx.beginPath();
      drawing = false;
      pts.forEach((p) => {
        if (p.zone === "sub") {
          if (!drawing) {
            ctx.moveTo(toX(p.x), toY(p.y));
            drawing = true;
          } else ctx.lineTo(toX(p.x), toY(p.y));
        } else drawing = false;
      });
      ctx.stroke();

      // alternative paths (dashed arcs)
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = theme.barrierA;
      ctx.lineWidth = 2;
      for (const sc of scRef.current) {
        ctx.beginPath();
        ctx.moveTo(toX(sc.ax), toY(sc.ay));
        ctx.lineTo(toX(sc.bx), toY(sc.by));
        ctx.stroke();
      }
      ctx.restore();

      const marks = marksRef.current;

      // holes: the road stroke is cut open and the rim is flagged red
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 2.4;
      for (const g of marks.gaps) {
        const ax = toX(g.x);
        const ay = toY(g.z);
        const bx = toX(g.x1);
        const by = toY(g.z1);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#ff3b30";
        for (const [cx, cy] of [[ax, ay], [bx, by]]) {
          ctx.beginPath();
          ctx.arc(cx, cy, 3.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.lineWidth = 2.4;
      }

      // warps: entry ring on the side you have to aim at, dashed link to the exit
      for (const pr of marks.portals) {
        const x = toX(pr.x);
        const y = toY(pr.z);
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = "rgba(124,92,255,0.55)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(toX(pr.ox), toY(pr.oz));
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = "#7c5cff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 4.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(124,92,255,0.35)";
        ctx.fill();
      }

      // sector ticks, matching the numbered boards standing on the circuit
      ctx.fillStyle = "rgba(10,30,50,0.55)";
      ctx.font = "700 7px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 8; i++) {
        const f = trackFrameAt(i / 8);
        const mark = f.point.clone().addScaledVector(f.normal, 9);
        ctx.fillText(String(i + 1), toX(mark.x), toY(mark.z));
      }

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
