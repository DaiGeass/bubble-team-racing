export type GraphicsQuality = "auto" | "low" | "balanced" | "high";

export const GRAPHICS_QUALITIES: GraphicsQuality[] = ["auto", "low", "balanced", "high"];

const PROFILES = {
  low: { maxDpr: 1, shadowSize: 0, bloom: false, antialias: false, particles: 120 },
  balanced: { maxDpr: 1.25, shadowSize: 1024, bloom: true, antialias: false, particles: 200 },
  high: { maxDpr: 1.7, shadowSize: 2048, bloom: true, antialias: true, particles: 260 },
} as const;

export type GpuTier = "low" | "balanced" | "high";

/**
 * Which profile "auto" starts from, from the name of the graphics card. A
 * software renderer (no driver, a virtual machine) gets the light one, a card
 * built into the processor the middle one and a card of its own the full one.
 * The resolution budget then fine-tunes from there while racing.
 */
export function tierFromRenderer(renderer: string, cores = 8): GpuTier {
  const r = renderer.toLowerCase();
  if (/llvmpipe|softpipe|lavapipe|swiftshader|software|basic render|microsoft basic/.test(r) || cores <= 2) return "low";
  if (/nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|arc\s?a\d|\brx\s?\d{3,4}/.test(r)) return "high";
  return "balanced";
}

let detected: GpuTier | null = null;
export function gpuTier(): GpuTier {
  if (detected) return detected;
  detected = "balanced";
  try {
    if (typeof document === "undefined") return detected;
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    if (!gl) return (detected = "low");
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    detected = tierFromRenderer(name, typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* keep the middle profile */
  }
  return detected;
}

export function graphicsProfile(quality: unknown) {
  if (quality === "low" || quality === "high" || quality === "balanced") return PROFILES[quality];
  return quality === "auto" || quality === undefined ? PROFILES[gpuTier()] : PROFILES.balanced;
}

/** Windowed frame budgets with warm-up and hysteresis, independent of display Hz.
 * Only render resolution changes; the physics clock is never scaled.
 */
export class ResolutionBudget {
  private warmup = 2;
  private elapsed = 0;
  private frames = 0;
  private fastWindows = 0;
  readonly min: number;
  value: number;

  constructor(readonly max: number) {
    this.value = max;
    this.min = Math.min(0.65, max);
  }

  reset() {
    this.warmup = 2;
    this.elapsed = 0;
    this.frames = 0;
    this.fastWindows = 0;
  }

  sample(delta: number): number | null {
    if (!Number.isFinite(delta) || delta <= 0 || delta > 0.25) {
      this.reset();
      return null;
    }
    if (this.warmup > 0) {
      this.warmup -= delta;
      return null;
    }
    this.elapsed += delta;
    this.frames++;
    if (this.elapsed < 2) return null;
    const average = this.elapsed / this.frames;
    this.elapsed = 0;
    this.frames = 0;
    let next = this.value;
    if (average > 0.025) {
      next -= 0.15;
      this.fastWindows = 0;
    } else if (average < 0.018) {
      if (++this.fastWindows >= 2) {
        next += 0.05;
        this.fastWindows = 0;
      }
    } else {
      this.fastWindows = 0;
    }
    next = Math.max(this.min, Math.min(this.max, Math.round(next * 100) / 100));
    if (next === this.value) return null;
    this.value = next;
    return next;
  }
}
