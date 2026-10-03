import { useEffect, useState } from "react";
import { useI18n, ordinal } from "../i18n";
import { useGame, DEFAULT_TOUCH, type Action, type TouchSlot } from "../store";
import { WEAPON_META, THEMES, mutateTheme, type WeaponId, type VehicleMode } from "../data";
import { getActiveTrack } from "../trackCurve";
import type { UseControlsReturn } from "../controls";
import Minimap from "../ui/Minimap";

function formatTime(ms: number) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

const MODE_GLYPH: Record<VehicleMode, string> = { land: "▬", boat: "≈", plane: "✈", sub: "◒" };
const MODE_KEY: Record<VehicleMode, string> = { land: "modeLand", boat: "modeBoat", plane: "modePlane", sub: "modeSub" };

function TouchButton({
  label,
  className = "",
  color,
  style,
  onDown,
  onUp,
}: {
  label: string;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      className={`glass-btn flex select-none items-center justify-center rounded-full font-bold leading-none active:scale-95 ${className}`}
      style={{ ...style, ...(color ? { color, textShadow: `0 0 12px ${color}` } : {}) }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onUp();
      }}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/** Glyph shown on a remappable touch slot. */
const TOUCH_GLYPH: Record<Action, string> = {
  left: "\u25C0",
  right: "\u25B6",
  gas: "\u25B2",
  brake: "\u25BC",
  drift: "\u224B",
  item: "\u25CF",
  swap: "\u21C4",
  fuse: "\u2715",
  turbo: "\u26A1",
};

export default function HUD({ controls }: { controls: UseControlsReturn }) {
  const { t } = useI18n();
  const telemetry = useGame((s) => s.telemetry);
  const setPaused = useGame((s) => s.setPaused);
  const muted = useGame((s) => s.muted);
  const toggleMuted = useGame((s) => s.toggleMuted);
  const themeId = useGame((s) => s.theme);
  const themeGlow = THEMES[themeId]?.glow ?? "#8be9ff";
  // the palette of the current lap of the circuit being raced, so the mutation the
  // player can see in the world is the one the HUD reports
  const lapTheme = mutateTheme(THEMES[getActiveTrack().theme], telemetry.lap - 1);
  const [cdKey, setCdKey] = useState(0);
  // select the primitives separately: a fresh object from the selector would
  // re-render forever under zustand's Object.is comparison
  const touchLayout = useGame((s) => s.settings.touchLayout);
  const handed = useGame((s) => s.settings.handed);
  const touchScale = useGame((s) => s.settings.touchScale);
  const telemetryOn = useGame((s) => s.settings.telemetry);
  const motionBlur = useGame((s) => s.settings.motionBlur);
  const layout = { touchLayout: touchLayout ?? DEFAULT_TOUCH, handed, scale: touchScale ?? 1 };
  // every pad, including the weapon cluster, is sized from the Options slider
  const px = (n: number) => `${Math.round(n * layout.scale)}px`;

  useEffect(() => setCdKey((k) => k + 1), [telemetry.countdown]);

  const w = telemetry.weapon ? WEAPON_META[telemetry.weapon as WeaponId] : null;
  const speedPct = Math.min(100, (telemetry.speedKph / 190) * 100);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* ---------- speed blur: cheap streaks that grow with velocity ---------- */}
      {motionBlur > 0 && (
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            opacity: motionBlur * speedPct * 0.55,
            background:
              "radial-gradient(ellipse at center, transparent 42%, rgba(255,255,255,0.5) 78%, rgba(255,255,255,0.85) 100%)",
          }}
        />
      )}
      {/* ---------- top left: lap / position / mode ---------- */}
      <div className="pointer-events-auto absolute left-3 top-3 flex items-stretch gap-2">
        <div className="glass-panel relative flex flex-col items-center rounded-2xl px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-900/60">{t("lap")}</span>
          <span className="font-display text-2xl font-extrabold leading-none text-sky-900">
            {telemetry.lap}
            <span className="text-sm opacity-50">/{telemetry.totalLaps}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-sky-900/60">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: lapTheme.glow }} />
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: lapTheme.water }} />
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: lapTheme.barrierA }} />
          </span>
        </div>
        <div className="glass-panel flex flex-col items-center rounded-2xl px-4 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-900/60">{t("position")}</span>
          <span className="font-display text-3xl font-extrabold leading-none text-rose-600">{ordinal(telemetry.position, t)}</span>
        </div>
        <div
          key={telemetry.mode}
          className="glass-panel pop-in flex flex-col items-center justify-center rounded-2xl px-3"
          style={{ boxShadow: `0 0 18px ${WEAPON_META.orb.glow}` }}
        >
          <span className="text-lg leading-none">{MODE_GLYPH[telemetry.mode]}</span>
          <span className="text-[10px] font-bold uppercase text-sky-900/70">{t(MODE_KEY[telemetry.mode])}</span>
        </div>
      </div>

      {/* ---------- top center: time + score ---------- */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="glass-panel rounded-2xl px-4 py-1">
          <span className="font-mono text-xl font-bold text-sky-900">{formatTime(telemetry.timeMs)}</span>
        </div>
        {telemetryOn && (
          <div className="flex gap-1.5 text-xs font-bold">
            <span className="glass-panel rounded-full px-2.5 py-0.5 text-sky-900">⭐ {telemetry.score}</span>
            <span className="glass-panel rounded-full px-2.5 py-0.5 text-amber-600">◉ {telemetry.coins}</span>
            {telemetry.rings > 0 && <span className="glass-panel rounded-full px-2.5 py-0.5 text-cyan-600">◎ {telemetry.rings}</span>}
          </div>
        )}
      </div>

      {/* ---------- top right: minimap + buttons ---------- */}
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2">
        <div className="flex gap-1.5">
          <button className="glass-btn flex h-9 w-9 items-center justify-center rounded-full text-base" onClick={toggleMuted}>
            {muted ? "✕" : "♪"}
          </button>
          <button className="glass-btn flex h-9 w-9 items-center justify-center rounded-full text-base" onClick={() => setPaused(true)}>
            ❚❚
          </button>
        </div>
        {telemetryOn && <Minimap />}
      </div>

      {/* ---------- standings (desktop) ---------- */}
      <div className="absolute left-3 top-28 hidden flex-col gap-1 sm:flex">
        {telemetry.standings.slice(0, 5).map((s, i) => (
          <div
            key={s.id}
            className={`glass-panel flex items-center gap-2 rounded-full py-1 pl-2 pr-3 text-xs font-bold ${
              s.isPlayer ? "text-rose-600" : "text-sky-900/80"
            }`}
          >
            <span className="w-3 text-right opacity-60">{i + 1}</span>
            <span className="h-3 w-3 rounded-full" style={{ background: s.color, border: "1.5px solid #fff" }} />
            {s.name}
          </div>
        ))}
      </div>

      {/* ---------- speed + turbo bars ---------- */}
      <div className="absolute bottom-3 left-1/2 hidden w-72 -translate-x-1/2 flex-col gap-1.5 sm:flex">
        <div className="glass-panel h-4 overflow-hidden rounded-full p-0.5">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${speedPct}%`,
              background: telemetry.boosting ? "linear-gradient(90deg,#ffd166,#ff4d6d)" : "linear-gradient(90deg,#8be9ff,#4fd1ff)",
              boxShadow: telemetry.boosting ? "0 0 14px #ffd166" : "0 0 8px #4fd1ff",
            }}
          />
        </div>
        {/* drift-charged TURBO meter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-sky-900/70">⚡ {t("turboBtn")}</span>
          <div className="glass-panel h-3 flex-1 overflow-hidden rounded-full p-0.5">
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${telemetry.turbo * 100}%`,
                background: "linear-gradient(90deg,#ffe066,#ff9f1c,#ff4d6d)",
                boxShadow: telemetry.turbo > 0.9 ? "0 0 16px #ffd166" : "0 0 8px #ffb703",
              }}
            />
          </div>
          <span className="font-mono text-[10px] font-bold text-sky-900/70">{Math.round(telemetry.turbo * 100)}%</span>
        </div>
        {telemetryOn && <div className="text-center font-mono text-xs font-bold text-sky-900/70">{telemetry.speedKph} km/h</div>}
      </div>

      {/* ---------- fusion turret health bar ---------- */}
      {telemetry.fused && (
        <div className="absolute left-1/2 top-24 w-56 -translate-x-1/2">
          <div className="glass-panel rounded-full p-1">
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-purple-800">{t("fusionHp")}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/40">
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{
                    width: `${telemetry.fusionHp * 100}%`,
                    background: "linear-gradient(90deg,#c084fc,#7c3aed,#f472b6)",
                    boxShadow: "0 0 14px #c084fc",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- alternative-path jump banner ---------- */}
      {Date.now() - telemetry.shortcutFlash < 1600 && telemetry.shortcutFlash > 0 && (
        <div key={telemetry.shortcutFlash} className="pointer-events-none absolute left-1/2 top-[34%] -translate-x-1/2">
          <div className="pop-in glass-panel rounded-full px-6 py-2 font-display text-2xl font-extrabold text-sky-900 sm:text-3xl" style={{ boxShadow: `0 0 30px ${themeGlow}` }}>
            ✦ {t("shortcutMsg")} ✦
          </div>
        </div>
      )}

      {/* ---------- countdown ---------- */}
      {telemetry.countdown >= 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            key={cdKey}
            className="pop-in font-display text-8xl font-extrabold text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)] sm:text-9xl"
            style={{ WebkitTextStroke: "3px rgba(10,60,90,0.35)", textShadow: `0 0 40px ${themeGlow}` }}
          >
            {telemetry.countdown === 0 ? t("go") : telemetry.countdown}
          </div>
        </div>
      )}

      {telemetry.finished && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pop-in font-display text-5xl font-extrabold text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)] sm:text-7xl">
            {t("raceFinished")}
          </div>
        </div>
      )}

      {/* ---------- weapon + tag swap + fusion ---------- */}
      <div className="pointer-events-auto absolute bottom-24 right-3 flex items-center gap-2 sm:bottom-6 sm:right-4">
        <div className="relative" style={{ width: px(56), height: px(56) }}>
          <svg className="absolute inset-0 -rotate-90" style={{ width: px(56), height: px(56) }} viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.55)" strokeWidth="4" fill="none" />
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke="#4fd1ff"
              strokeWidth="4"
              fill="none"
              strokeDasharray={151}
              strokeDashoffset={151 * (1 - telemetry.tagCooldown)}
              strokeLinecap="round"
            />
          </svg>
          <TouchButton
            label={TOUCH_GLYPH[layout.touchLayout.swap] ?? "⇄"}
            className="absolute inset-0 text-xl text-sky-800"
            style={{ width: px(56), height: px(56) }}
            onDown={() => controls.setAction(layout.touchLayout.swap, true)}
            onUp={() => controls.setAction(layout.touchLayout.swap, false)}
          />
        </div>
        {/* FUSION — partner mans the turret */}
        <div className={`relative ${telemetry.fused ? "animate-pulse" : ""}`} style={{ width: px(56), height: px(56) }}>
          <svg className="absolute inset-0 -rotate-90" style={{ width: px(56), height: px(56) }} viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.55)" strokeWidth="4" fill="none" />
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke={telemetry.fused ? "#ffd166" : "#c084fc"}
              strokeWidth="4"
              fill="none"
              strokeDasharray={151}
              strokeDashoffset={151 * (1 - telemetry.fuseReady)}
              strokeLinecap="round"
            />
          </svg>
          <TouchButton
            label={TOUCH_GLYPH[layout.touchLayout.fuse] ?? "✚"}
            className={`absolute inset-0 text-xl ${telemetry.fused ? "text-amber-500" : "text-purple-700"}`}
            style={{ width: px(56), height: px(56) }}
            onDown={() => controls.setAction(layout.touchLayout.fuse, true)}
            onUp={() => controls.setAction(layout.touchLayout.fuse, false)}
          />
        </div>
        <TouchButton
          label={TOUCH_GLYPH[layout.touchLayout.item] ?? (w ? w.glyph : "·")}
          color={w && layout.touchLayout.item === "item" ? w.color : undefined}
          className={`text-4xl ${w ? "animate-pulse" : "opacity-40"}`}
          style={{ width: px(80), height: px(80) }}
          onDown={() => controls.setAction(layout.touchLayout.item, true)}
          onUp={() => controls.setAction(layout.touchLayout.item, false)}
        />
      </div>

      {/* ---------- touch steering + pedals: slots are remappable in Options ---------- */}
      <div className={`pointer-events-auto absolute bottom-3 flex items-end gap-2 sm:hidden ${layout.handed === "left" ? "left-[112px]" : "left-3"}`}>
        {(["padL", "padR", "drift"] as TouchSlot[]).map((slot) => {
          const action = layout.touchLayout[slot];
          const glyph = TOUCH_GLYPH[action] ?? "·";
          const dim = slot === "drift" ? 58 : 70;
          const size = `text-[${Math.round(dim * 0.42 * layout.scale)}px]`;
          return (
            <TouchButton
              key={slot}
              label={glyph}
              style={{ width: px(dim), height: px(dim) }}
              className={`${size} text-sky-800 ${action === "drift" && telemetry.boosting ? "text-amber-500" : ""}`}
              onDown={() => controls.setAction(action, true)}
              onUp={() => controls.setAction(action, false)}
            />
          );
        })}
      </div>
      <div className={`pointer-events-auto absolute bottom-3 flex flex-col items-center gap-2 sm:hidden ${layout.handed === "left" ? "right-3" : "right-[112px]"}`}>
        {(["gas", "brake"] as TouchSlot[]).map((slot) => {
          const action = layout.touchLayout[slot];
          const big = slot === "gas";
          const dim = big ? 86 : 48;
          return (
            <TouchButton
              key={slot}
              label={TOUCH_GLYPH[action] ?? "·"}
              style={{ width: px(dim), height: px(dim) }}
              className={`${big ? "text-emerald-600" : "text-rose-500"} text-[${Math.round(dim * 0.46 * layout.scale)}px]`}
              onDown={() => controls.setAction(action, true)}
              onUp={() => controls.setAction(action, false)}
            />
          );
        })}
      </div>

      {/* ---------- desktop hints ---------- */}
      <div className="pointer-events-none absolute bottom-4 left-4 hidden text-[11px] font-semibold text-sky-900/60 sm:block">
        ↑↓←→ / WASD · SHIFT {t("drift")} · SPACE {t("useItem")} · K ⚡{t("turboBtn")} · Q {t("swapRacer")} · F {t("fuse")} · ESC {t("pauseGame")}
      </div>
    </div>
  );
}
