import { useEffect, useState } from "react";
import { useI18n, ordinal } from "../i18n";
import { useGame, DEFAULT_TOUCH, type Action, type TouchSlot } from "../store";
import { WEAPON_META, WEAPONS, THEMES, mutateTheme, type WeaponId, type VehicleMode } from "../data";
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

const MODE_GLYPH: Record<VehicleMode, string> = { land: "▬", boat: "≈", plane: "✈", sub: "◒", hover: "◈" };
const MODE_KEY: Record<VehicleMode, string> = { land: "modeLand", boat: "modeBoat", plane: "modePlane", sub: "modeSub", hover: "modeHover" };

/**
 * Whether to lay the screen out for fingers. The width of the window says
 * nothing about it: a phone on its side is wider than a small laptop window.
 */
function useTouchScreen() {
  const [touch, setTouch] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  useEffect(() => {
    // whichever was used last wins, so a laptop with a touch screen gets both
    const onTouch = () => setTouch(true);
    const onKey = () => setTouch(false);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return touch;
}

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
  turbo: "\u21EA",
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
  // the last lap is announced once, as the line is crossed into it
  const [finalLapAt, setFinalLapAt] = useState(0);
  useEffect(() => {
    if (telemetry.totalLaps > 1 && telemetry.lap === telemetry.totalLaps) setFinalLapAt(Date.now());
  }, [telemetry.lap, telemetry.totalLaps]);
  const w2 = telemetry.weapon2 ? WEAPON_META[telemetry.weapon2 as WeaponId] : null;
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
  // the big button shows the item itself while it is the item button
  const itemSlot = (layout.touchLayout.item ?? "item") === "item";
  // the roulette: the symbols flick past until the draw settles
  const rollGlyph = WEAPON_META[WEAPONS[Math.floor(Date.now() / 70) % WEAPONS.length]].glyph;
  const speedPct = Math.min(100, (telemetry.speedKph / 190) * 100);
  const touch = useTouchScreen();
  // on a touch screen the three item buttons stack in the corner beside the pedals
  const side = touch ? 50 : 56;

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
      {/* ---------- error windows: someone has covered your screen ---------- */}
      {Date.now() < telemetry.popupUntil &&
        [
          [8, 18, 34, -3], [46, 10, 30, 2], [22, 44, 38, 1], [58, 40, 30, -2], [34, 26, 32, 4], [10, 58, 28, 2], [62, 62, 30, -1],
        ].map(([x, y, w, rot], i) => (
          <div
            key={i}
            className="pop-in absolute shadow-xl"
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, transform: `rotate(${rot}deg)`, background: "#c0c0c0", border: "2px solid #ffffff", borderRightColor: "#404040", borderBottomColor: "#404040" }}
          >
            <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-white" style={{ background: "#000080" }}>
              <span>Error</span>
              <span className="px-1" style={{ background: "#c0c0c0", color: "#000" }}>×</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-4 text-black">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg font-black text-white" style={{ background: "#d40000" }}>!</span>
              <span className="font-mono text-xs">0x{(0xbad0 + i * 4919).toString(16).toUpperCase()}</span>
            </div>
          </div>
        ))}

      {/* ---------- something is coming for you: the closer, the fuller the bar ---------- */}
      {telemetry.incoming > 0 && (
        <div className={`absolute left-1/2 flex -translate-x-1/2 animate-pulse items-center gap-2 rounded-full px-3 py-1.5 ${touch ? "bottom-40" : "bottom-32"}`} style={{ background: "rgba(220,20,40,0.88)", boxShadow: "0 0 22px rgba(255,60,80,0.9)" }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black" style={{ color: "#d40000" }}>!</span>
          <span className="block h-2 w-24 overflow-hidden rounded-full bg-white/30">
            <span className="block h-full rounded-full bg-white" style={{ width: `${Math.round(telemetry.incoming * 100)}%` }} />
          </span>
        </div>
      )}

      {/* ---------- drift: one light per mini-turbo level reached ---------- */}
      {telemetry.driftLevel > 0 && (
        <div className={`absolute left-1/2 flex -translate-x-1/2 gap-2 ${touch ? "bottom-28" : "bottom-24"}`}>
          {["#8be9ff", "#ffb347", "#ff5fd2"].map((c, i) => (
            <span
              key={i}
              className="h-4 w-9 rounded-full"
              style={{ background: i < telemetry.driftLevel ? c : "rgba(255,255,255,0.3)", boxShadow: i < telemetry.driftLevel ? `0 0 14px ${c}` : "none", border: "2px solid rgba(255,255,255,0.8)" }}
            />
          ))}
        </div>
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
            <span className="glass-panel rounded-full px-2.5 py-0.5 text-sky-900">★ {telemetry.score}</span>
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

      {/* ---------- speed + turbo: under the clock on a touch screen, where no thumb covers them ---------- */}
      <div className={`absolute left-1/2 flex -translate-x-1/2 flex-col ${touch ? "top-[5.4rem] w-44 gap-1" : "bottom-3 w-80 gap-1.5"}`}>
        {!touch && (
          <div className="flex items-end justify-center gap-1.5 leading-none">
            <span
              className="font-display text-4xl font-extrabold tabular-nums text-white"
              style={{ WebkitTextStroke: "1.5px rgba(10,60,90,0.45)", textShadow: telemetry.boosting ? "0 0 18px #ffd166" : `0 0 14px ${themeGlow}` }}
            >
              {telemetry.speedKph}
            </span>
            <span className="pb-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-900/70">km/h</span>
          </div>
        )}
        <div className={`glass-panel overflow-hidden rounded-full p-0.5 ${touch ? "h-3" : "h-4"}`}>
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
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-sky-900/80">{t("turboBtn")}</span>
          <div className="glass-panel h-3 flex-1 overflow-hidden rounded-full p-0.5">
            <div
              className={`h-full rounded-full transition-[width] duration-150 ${telemetry.turbo > 0.99 ? "animate-pulse" : ""}`}
              style={{
                width: `${telemetry.turbo * 100}%`,
                background: "linear-gradient(90deg,#ffe066,#ff9f1c,#ff4d6d)",
                boxShadow: telemetry.turbo > 0.9 ? "0 0 16px #ffd166" : "0 0 8px #ffb703",
              }}
            />
          </div>
          {!touch && <span className="w-8 text-right font-mono text-[10px] font-bold text-sky-900/70">{Math.round(telemetry.turbo * 100)}%</span>}
        </div>
      </div>

      {/* ---------- fusion turret health bar ---------- */}
      {telemetry.fused && (
        <div className={`absolute left-1/2 w-56 -translate-x-1/2 ${touch ? "top-[8.2rem]" : "top-24"}`}>
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

      {/* ---------- the partner's own turret: how long it has left ---------- */}
      {telemetry.soloTurret > 0 && !telemetry.fused && (
        <div className={`absolute left-1/2 w-56 -translate-x-1/2 ${touch ? "top-[8.2rem]" : "top-24"}`}>
          <div className="glass-panel rounded-full p-1">
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700">{t("soloTurret")}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/40">
                <div className="h-full rounded-full" style={{ width: `${telemetry.soloTurret * 100}%`, background: "linear-gradient(90deg,#ffe066,#ff9f1c)", boxShadow: "0 0 12px #ffd166" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- last lap ---------- */}
      {finalLapAt > 0 && Date.now() - finalLapAt < 2600 && !telemetry.finished && (
        <div key={finalLapAt} className="pointer-events-none absolute left-1/2 top-[24%] -translate-x-1/2">
          <div className="pop-in font-display whitespace-nowrap text-4xl font-extrabold text-white sm:text-6xl" style={{ WebkitTextStroke: "2px rgba(160,20,40,0.6)", textShadow: "0 0 30px #ff4d6d" }}>
            {t("finalLap")}
          </div>
        </div>
      )}

      {/* ---------- slipstream: the bar fills while you sit in the tow ---------- */}
      {telemetry.draft > 0.05 && (
        <div className={`pointer-events-none absolute left-1/2 w-40 -translate-x-1/2 ${touch ? "top-[10.6rem]" : "bottom-[7.6rem]"}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-white" style={{ textShadow: "0 1px 4px rgba(0,40,80,0.8)" }}>{t("draft")}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{ width: `${telemetry.draft * 100}%`, boxShadow: telemetry.draft > 0.95 ? "0 0 12px #ffffff" : undefined }} />
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
      <div
        className={`pointer-events-auto absolute ${
          touch ? `bottom-3 grid grid-cols-2 justify-items-center gap-1.5 ${layout.handed === "left" ? "left-3" : "right-3"}` : "bottom-6 right-4 flex items-center gap-2"
        }`}
      >
        <div className="relative" style={{ width: px(side), height: px(side) }}>
          <svg className="absolute inset-0 -rotate-90" style={{ width: px(side), height: px(side) }} viewBox="0 0 56 56">
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
            style={{ width: px(side), height: px(side) }}
            onDown={() => controls.setAction(layout.touchLayout.swap, true)}
            onUp={() => controls.setAction(layout.touchLayout.swap, false)}
          />
        </div>
        {/* FUSION — partner mans the turret */}
        <div className={`relative ${telemetry.fused || telemetry.soloTurret > 0 ? "animate-pulse" : ""}`} style={{ width: px(side), height: px(side) }}>
          {/* seconds until it can be used again */}
          {telemetry.fuseWait > 0 && (
            <div className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2">
              <div className="glass-panel rounded-full px-2 py-0.5 font-mono text-[11px] font-extrabold text-purple-800">{telemetry.fuseWait}s</div>
            </div>
          )}
          <svg className="absolute inset-0 -rotate-90" style={{ width: px(side), height: px(side) }} viewBox="0 0 56 56">
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
            className={`absolute inset-0 text-xl ${telemetry.fused || telemetry.soloTurret > 0 ? "text-amber-500" : telemetry.fuseWait > 0 ? "text-purple-700 opacity-40" : "text-purple-700"}`}
            style={{ width: px(side), height: px(side) }}
            onDown={() => controls.setAction(layout.touchLayout.fuse, true)}
            onUp={() => controls.setAction(layout.touchLayout.fuse, false)}
          />
        </div>
        <div className={`relative ${touch ? "col-span-2" : ""}`}>
          {/* the name of what you are holding, so nobody has to learn the symbols */}
          {itemSlot && w && !telemetry.rolling && (
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2">
              <div className="glass-panel whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: w.color }}>
                {t(`weapon_${telemetry.weapon}`)}
              </div>
            </div>
          )}
          {/* the item in waiting */}
          {itemSlot && w2 && (
            <div className="pointer-events-none absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-sm font-bold shadow" style={{ color: w2.color }}>
              {w2.glyph}
            </div>
          )}
          <TouchButton
            label={itemSlot ? (telemetry.rolling ? rollGlyph : w ? w.glyph : "·") : TOUCH_GLYPH[layout.touchLayout.item]}
            color={itemSlot && w && !telemetry.rolling ? w.color : undefined}
            className={`text-4xl ${telemetry.rolling ? "" : w ? "animate-pulse" : "opacity-40"}`}
            style={{ width: px(80), height: px(80) }}
            onDown={() => controls.setAction(layout.touchLayout.item, true)}
            onUp={() => controls.setAction(layout.touchLayout.item, false)}
          />
        </div>
      </div>

      {/* ---------- touch steering + pedals: slots are remappable in Options ---------- */}
      {touch && (<>
      <div className={`pointer-events-auto absolute bottom-3 flex items-end gap-2 ${layout.handed === "left" ? "left-[128px]" : "left-3"}`}>
        {(["padL", "padR", "drift", "turbo"] as TouchSlot[]).map((slot) => {
          const action = layout.touchLayout[slot] ?? DEFAULT_TOUCH[slot];
          const glyph = TOUCH_GLYPH[action] ?? "·";
          const dim = slot === "drift" || slot === "turbo" ? 58 : 70;
          const size = `text-[${Math.round(dim * 0.42 * layout.scale)}px]`;
          return (
            <TouchButton
              key={slot}
              label={glyph}
              style={{ width: px(dim), height: px(dim) }}
              className={`${size} ${action === "turbo" && telemetry.turbo > 0.18 ? "text-amber-500" : "text-sky-800"}`}
              onDown={() => controls.setAction(action, true)}
              onUp={() => controls.setAction(action, false)}
            />
          );
        })}
      </div>
      <div className={`pointer-events-auto absolute bottom-3 flex flex-col items-center gap-2 ${layout.handed === "left" ? "right-3" : "right-[128px]"}`}>
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

      </>)}

      {/* ---------- keyboard hints: there for the start, and again whenever the keys change meaning ---------- */}
      {!touch && (
        <div key={telemetry.gunning ? "g" : telemetry.fused ? "f" : "d"} className="hint-fade pointer-events-none absolute bottom-4 left-4 max-w-[calc(50vw-190px)]">
          <div className="glass-panel rounded-2xl px-3 py-1.5 text-[11px] font-semibold leading-relaxed text-sky-900/80">
          {telemetry.gunning
            ? `←→ ⟳ · SPACE ● · Q ⇄ · F ✕ · ESC ${t("pauseGame")}`
            : telemetry.fused
              ? `↑↓←→ / WASD · SHIFT ${t("drift")} · SPACE ${t("useItem")} · K ${t("turboBtn")} · Q ⇄ · F ✕ · ESC ${t("pauseGame")}`
              : `↑↓←→ / WASD · SHIFT ${t("drift")} · SPACE ${t("useItem")} · K ${t("turboBtn")} · Q ${t("swapRacer")} · F ${t("fuse")} · ESC ${t("pauseGame")}`}
          </div>
        </div>
      )}
    </div>
  );
}
