import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import { songClock } from "../music";
import { rhythmState } from "../rhythm";
import { THEMES } from "../data";
import { getActiveTrack } from "../trackCurve";

const GRADE_COLOUR = { perfect: "#ffe066", good: "#8be9ff", off: "#ff7a9c" } as const;
const GRADE_WORD = { perfect: "beatPerfect", good: "beatGood", off: "beatOff" } as const;

/**
 * What a song's race adds to the HUD: the edges of the screen breathe with the
 * beat, a ring at the bottom closes in on every one so you can time a drift
 * to it, and each move is graded as it is made, with the run of good ones
 * and the rhythm score beside it.
 */
export default function BeatHUD() {
  const { t } = useI18n();
  const grade = useGame((s) => s.telemetry.beatGrade);
  const at = useGame((s) => s.telemetry.beatAt);
  const combo = useGame((s) => s.telemetry.beatCombo);
  const score = useGame((s) => s.telemetry.beatScore);
  const glow = THEMES[getActiveTrack().theme]?.glow ?? "#ff5fd2";
  const edge = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const shake = useGame((s) => s.settings.shake);

  // every frame, straight onto the elements: no re-render for a pulse
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const bpm = rhythmState.features?.bpm ?? 120;
      const beat = songClock()?.beat ?? ((performance.now() / 1000) * bpm / 60) % 1;
      const hit = Math.pow(1 - beat, 4);
      const bar = rhythmState.features && songClock() ? Math.floor((songClock()!.time - rhythmState.features.offset) / (240 / bpm)) : 0;
      const loud = rhythmState.features?.bars[bar]?.energy ?? 0.5;
      if (edge.current) edge.current.style.opacity = String((0.15 + loud * 0.55) * hit * Math.max(0.3, shake));
      if (ring.current) {
        const k = 1 - beat;
        ring.current.style.transform = `translate(-50%, 0) scale(${0.35 + k * 1.1})`;
        ring.current.style.opacity = String(0.25 + beat * 0.75);
      }
      if (dot.current) dot.current.style.transform = `translate(-50%, 0) scale(${1 + hit * 0.45})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shake]);

  const fresh = grade && Date.now() - at < 700;
  return (
    <>
      <div
        ref={edge}
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 90px 24px ${glow}`, opacity: 0 }}
      />
      <div className="pointer-events-none absolute bottom-36 left-1/2 h-14 w-14">
        <div ref={ring} className="absolute left-1/2 top-0 h-14 w-14 rounded-full border-4 border-white/90" style={{ transform: "translate(-50%,0)" }} />
        <div ref={dot} className="absolute left-1/2 top-[18px] h-5 w-5 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.9)]" style={{ transform: "translate(-50%,0)" }} />
      </div>
      {fresh && (
        <div key={at} className="beat-pop pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 text-center" role="status">
          <div className="font-display text-4xl font-black italic drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]" style={{ color: GRADE_COLOUR[grade] }}>
            {t(GRADE_WORD[grade])}
          </div>
          {combo >= 2 && <div className="text-sm font-extrabold text-white drop-shadow">{t("beatCombo")} ×{combo}</div>}
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-[42%] rounded-2xl border border-pink-200/70 bg-sky-950/80 px-3 py-2 text-white shadow-lg">
        <div className="text-[10px] font-bold uppercase tracking-wide text-pink-200">{t("beatScore")}</div>
        <div className="font-display text-2xl font-black">{score}</div>
        {combo >= 2 && <div className="text-[11px] font-bold text-amber-200">{t("beatCombo")} ×{combo}</div>}
      </div>
    </>
  );
}
