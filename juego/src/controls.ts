import { useEffect, useRef } from "react";
import { useGame } from "./store";

export interface ControlState {
  steer: number; // -1 left .. +1 right (screen-correct)
  throttle: number;
  item: boolean;
  itemPressed: boolean;
  swap: boolean;
  swapPressed: boolean;
  fuse: boolean;
  fusePressed: boolean;
  turbo: boolean;
  turboPressed: boolean;
  drift: boolean;
  pausePressed: boolean;
}

// Two remappable keyboard layouts (selectable in Settings).
const LAYOUTS = {
  A: { item: ["Space"], drift: ["ShiftLeft", "ShiftRight"], swap: ["KeyQ"], fuse: ["KeyF", "KeyE"] },
  B: { item: ["KeyE", "ControlLeft"], drift: ["Space"], swap: ["KeyQ", "Tab"], fuse: ["KeyF", "KeyR"] },
} as const;

export type ControlPreset = keyof typeof LAYOUTS;

export function useControls() {
  const state = useRef<ControlState>({
    steer: 0,
    throttle: 0,
    item: false,
    itemPressed: false,
    swap: false,
    swapPressed: false,
    fuse: false,
    fusePressed: false,
    turbo: false,
    turboPressed: false,
    drift: false,
    pausePressed: false,
  });

  const keys = useRef<Record<string, boolean>>({});
  const prevItem = useRef(false);
  const prevSwap = useRef(false);
  const prevFuse = useRef(false);
  const prevTurbo = useRef(false);
  const touch = useRef({ left: false, right: false, up: false, down: false, item: false, swap: false, fuse: false, turbo: false, drift: false });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape" || e.code === "KeyP") state.current.pausePressed = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const blur = () => {
      keys.current = {};
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  function setTouch(key: keyof typeof touch.current, val: boolean) {
    touch.current[key] = val;
  }

  function poll(): ControlState {
    const k = keys.current;
    const t = touch.current;
    const preset = (useGame.getState().settings.controlPreset ?? "A") as ControlPreset;
    const map = LAYOUTS[preset] ?? LAYOUTS.A;
    const any = (codes: readonly string[]) => codes.some((c) => k[c]);

    const left = k["ArrowLeft"] || k["KeyA"] || t.left;
    const right = k["ArrowRight"] || k["KeyD"] || t.right;
    const fwd = k["ArrowUp"] || k["KeyW"] || t.up;
    const back = k["ArrowDown"] || k["KeyS"] || t.down;
    const item = !!(any(map.item) || t.item);
    const swap = !!(any(map.swap) || t.swap);
    const fuse = !!(any(map.fuse) || t.fuse);
    const turbo = !!(k["KeyK"] || k["KeyJ"] || t.turbo);
    const drift = !!(any(map.drift) || t.drift);

    state.current.steer = (left ? -1 : 0) + (right ? 1 : 0);
    state.current.throttle = (fwd ? 1 : 0) + (back ? -1 : 0);
    state.current.item = item;
    state.current.itemPressed = item && !prevItem.current;
    state.current.swap = swap;
    state.current.swapPressed = swap && !prevSwap.current;
    state.current.fuse = fuse;
    state.current.fusePressed = fuse && !prevFuse.current;
    state.current.turbo = turbo;
    state.current.turboPressed = turbo && !prevTurbo.current;
    state.current.drift = drift;
    const pausePressed = state.current.pausePressed;
    state.current.pausePressed = false;
    prevItem.current = item;
    prevSwap.current = swap;
    prevFuse.current = fuse;
    prevTurbo.current = turbo;
    return { ...state.current, pausePressed };
  }

  return { poll, setTouch };
}

export type UseControlsReturn = ReturnType<typeof useControls>;
