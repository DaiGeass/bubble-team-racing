import { useEffect, useRef } from "react";
import { useGame, DEFAULT_KEYBINDS, type Action } from "./store";

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

// Legacy presets. The live bindings live in settings.keybinds so the options
// screen can rewrite them; the presets only seed the defaults.
const LAYOUTS = {
  A: { item: ["Space"], drift: ["ShiftLeft", "ShiftRight"], swap: ["KeyQ"], fuse: ["KeyF", "KeyE"] },
  B: { item: ["KeyE", "ControlLeft"], drift: ["Space"], swap: ["KeyQ", "Tab"], fuse: ["KeyF", "KeyR"] },
} as const;

export type ControlPreset = keyof typeof LAYOUTS;

/** Actions map onto the on-screen flags the game already tracks. */
const TOUCH_KEY: Record<Action, keyof { left: boolean; right: boolean; up: boolean; down: boolean; item: boolean; swap: boolean; fuse: boolean; turbo: boolean; drift: boolean }> = {
  left: "left",
  right: "right",
  gas: "up",
  brake: "down",
  item: "item",
  swap: "swap",
  fuse: "fuse",
  turbo: "turbo",
  drift: "drift",
};

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
    const st = useGame.getState().settings;
    const binds = { ...DEFAULT_KEYBINDS, ...(st.keybinds ?? {}) };
    // An action is on while one of its bound keys is down or its on-screen button
    // is pressed. Nothing is hard-wired: rebinding a key frees the old one, and a
    // touch slot does exactly the action it was given.
    const on = (a: Action) => binds[a].some((code) => k[code]) || t[TOUCH_KEY[a]];
    let left = on("left");
    let right = on("right");
    const fwd = on("gas");
    const back = on("brake");
    const item = on("item");
    const swap = on("swap");
    const fuse = on("fuse");
    const turbo = on("turbo");
    const drift = on("drift");
    if (st.invertSteer) {
      const flip = left;
      left = right;
      right = flip;
    }

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

  /** press a remapped action: HUD slots hand over the action, not the raw flag */
  function setAction(action: Action, val: boolean) {
    setTouch(TOUCH_KEY[action] ?? "item", val);
  }

  return { poll, setTouch, setAction };
}

export type UseControlsReturn = ReturnType<typeof useControls>;
