import * as THREE from "three";

/**
 * On a song's circuit the road is not there until it is built. A building
 * front runs ahead of the leading kart, and moves on in bursts on the beats of
 * the song: every beat lays the next stretch. Pieces rise into place from
 * below just behind the front, glowing as they come; past the front there is
 * nothing at all, no road, no barrier, no pad, no trap, not even on the map.
 *
 * Everything is measured in lap progress (0..1). The few metres before the
 * line, where the grid waits, count as built from the start.
 */
/** How far below its place a piece starts. */
const DROP = 18;

export const reveal = {
  /** lap progress of the front; 2 means everything is built (any other circuit) */
  front: { value: 2 },
  /** progress beyond which the road counts as the stretch before the line */
  start: { value: 0.99 },
  /** how much road behind the front is still landing */
  band: { value: 0.006 },
};

/** How far a piece at progress t is past the front: positive is not built yet. */
export function aheadOf(t: number): number {
  const tt = t > reveal.start.value ? t - 1 : t;
  return tt - reveal.front.value;
}

/** 0 for a piece at rest, up to 1 for one just appearing at the front. */
export function landing(t: number): number {
  const a = aheadOf(t);
  if (a > 0) return 1;
  const x = Math.max(0, Math.min(1, 1 + a / reveal.band.value));
  return x * x * (3 - 2 * x);
}

/** Objects placed along the lap that appear with the road: pads, boxes, notes and so on. */
const placed: { obj: THREE.Object3D; t: number; y: number }[] = [];
export function placeOnFront(obj: THREE.Object3D | null, t: number) {
  if (!obj) return;
  const i = placed.findIndex((p) => p.obj === obj);
  if (i >= 0) placed.splice(i, 1);
  placed.push({ obj, t, y: obj.position.y });
}
export function clearPlaced() {
  placed.length = 0;
}
/** Show what the front has reached, dropping it into place. */
export function stepPlaced() {
  for (const p of placed) {
    const a = aheadOf(p.t);
    p.obj.visible = a <= 0;
    p.obj.position.y = p.y - landing(p.t) ** 2 * DROP;
  }
}

export function revealShader(shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string }) {
  shader.uniforms.uRevealFront = reveal.front;
  shader.uniforms.uRevealStart = reveal.start;
  shader.uniforms.uRevealBand = reveal.band;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float aProg;\nuniform float uRevealFront;\nuniform float uRevealStart;\nuniform float uRevealBand;\nvarying float vRevealAhead;\nvarying float vRevealLand;")
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
float revealT = aProg > uRevealStart ? aProg - 1.0 : aProg;
vRevealAhead = revealT - uRevealFront;
vRevealLand = smoothstep(-uRevealBand, 0.0, vRevealAhead);
transformed.y -= vRevealLand * vRevealLand * ${DROP.toFixed(1)};`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vRevealAhead;\nvarying float vRevealLand;")
    .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vRevealAhead > 0.0) discard;")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.45, 0.95, 1.0) * vRevealLand * 3.0;");
}
