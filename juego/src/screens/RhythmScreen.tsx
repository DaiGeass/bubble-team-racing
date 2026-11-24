import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import { THEMES, TRACKS, type ThemeId } from "../data";
import { setActiveTrack } from "../trackCurve";
import { loadSong, rhythmState, useSong, RHYTHM_TRACK_ID, type SongFeatures } from "../rhythm";
import { resumeAudio } from "../sound";
import { Bubbles, GlassButton, Panel, PrimaryButton } from "../ui/common";
import { RaceTerms } from "./SelectScreen";
import { setConfig } from "../net";

const LOOKS: ThemeId[] = ["frutiger", "aero", "vapor", "y2k", "cyberpunk", "dreamcore", "eden", "slime", "techno", "sunset"];

/** A top-down outline of the circuit made from the song, and its other roads. */
function Outline({ version }: { version: number }) {
  const shape = useMemo(() => {
    const def = TRACKS.find((t) => t.id === RHYTHM_TRACK_ID);
    if (!def) return null;
    const all = [...def.points, ...(def.routes ?? []).flatMap((r) => r.points)];
    const xs = all.map((p) => p[0]);
    const zs = all.map((p) => p[2]);
    const x0 = Math.min(...xs);
    const z0 = Math.min(...zs);
    const s = 92 / Math.max(Math.max(...xs) - x0, Math.max(...zs) - z0, 1);
    const line = (pts: [number, number, number][], close: boolean) => pts.map((p) => `${4 + (p[0] - x0) * s},${4 + (p[2] - z0) * s}`).join(" ") + (close ? ` ${4 + (pts[0][0] - x0) * s},${4 + (pts[0][2] - z0) * s}` : "");
    return { main: line(def.points, true), routes: (def.routes ?? []).map((r) => line(r.points, false)), zones: def.zones.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  if (!shape) return null;
  return (
    <svg viewBox="0 0 100 100" className="h-56 w-56">
      {shape.routes.map((r, i) => (
        <polyline key={i} points={r} fill="none" stroke="#ff9f1c" strokeWidth="1.6" strokeLinejoin="round" />
      ))}
      <polyline points={shape.main} fill="none" stroke="rgba(10,50,80,0.35)" strokeWidth="4" strokeLinejoin="round" />
      <polyline points={shape.main} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Rhythm mode: bring a song, and race the circuit it makes. */
export default function RhythmScreen() {
  const { t } = useI18n();
  const goto = useGame((s) => s.goto);
  const setMode = useGame((s) => s.setMode);
  const setTrackId = useGame((s) => s.setTrackId);
  const resetTelemetry = useGame((s) => s.resetTelemetry);
  const setRaceResult = useGame((s) => s.setRaceResult);
  const restartRace = useGame((s) => s.restartRace);
  const [song, setSongState] = useState<SongFeatures | null>(rhythmState.features);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [look, setLook] = useState<ThemeId>(rhythmState.theme);
  const [version, setVersion] = useState(0);

  async function pick(file: File | undefined) {
    if (!file) return;
    resumeAudio();
    setBusy(true);
    setError("");
    try {
      const features = await loadSong(await file.arrayBuffer(), file.name, look);
      setSongState(features);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message === "short" ? t("rhythmShort") : t("rhythmBad"));
    }
    setBusy(false);
  }

  function restyle(theme: ThemeId) {
    setLook(theme);
    if (rhythmState.features) {
      useSong(rhythmState.features, rhythmState.buffer, rhythmState.bytes, theme);
      setVersion((v) => v + 1);
    }
  }

  function race() {
    // one lap, as long as the song
    setMode("sprint");
    setTrackId(RHYTHM_TRACK_ID);
    setActiveTrack(RHYTHM_TRACK_ID);
    setRaceResult(null);
    resetTelemetry();
    restartRace();
    goto("race");
  }

  const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const def = TRACKS.find((x) => x.id === RHYTHM_TRACK_ID);

  return (
    <div className="aero-gradient relative h-full w-full overflow-y-auto">
      <Bubbles count={10} />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <GlassButton onClick={() => goto("start")}>← {t("back")}</GlassButton>
          <h1 className="font-display text-3xl font-extrabold text-sky-900 sm:text-4xl">♫ {t("rhythmMode")}</h1>
          <span className="w-20" />
        </div>
        <Panel className="space-y-3 p-5">
          <p className="text-sm font-semibold text-sky-900/80">{t("rhythmHelp")}</p>
          <label className={`glass-btn inline-flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 font-extrabold text-sky-900 ${busy ? "animate-pulse" : ""}`}>
            ♫ {busy ? t("rhythmListening") : t("rhythmPick")}
            <input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {error && <div className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{error}</div>}
        </Panel>
        {song && def && (
          <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
            <Panel className="flex flex-col items-center gap-2 p-4">
              <Outline version={version} />
              <div className="text-center">
                <div className="font-display text-xl font-extrabold text-sky-900">{song.name}</div>
                <div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[11px] font-bold text-sky-800">
                  <span className="rounded-full bg-white/70 px-2 py-0.5">{Math.round(song.bpm)} BPM</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5">{minutes(song.duration)}</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5">{song.bars.length} {t("rhythmBars")}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">⑂ {def.routes?.length ?? 0}</span>
                  {def.zones.length > 0 && <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-fuchsia-700">◈ {def.zones.length}</span>}
                </div>
              </div>
            </Panel>
            <div className="flex flex-col gap-3">
              <Panel className="p-4">
                <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("aesthetics")}</div>
                <div className="flex flex-wrap gap-2">
                  {LOOKS.map((id) => (
                    <button
                      key={id}
                      onClick={() => restyle(id)}
                      title={THEMES[id].name}
                      className={`h-10 w-10 rounded-full ring-2 transition hover:scale-110 ${look === id ? "scale-110 ring-white" : "ring-white/40"}`}
                      style={{ background: `linear-gradient(140deg, ${THEMES[id].skyTop}, ${THEMES[id].glow}, ${THEMES[id].barrierA})` }}
                    />
                  ))}
                </div>
              </Panel>
              <RaceTerms />
              <div className="flex flex-wrap gap-2">
                <PrimaryButton big onClick={race}>▶ {t("rhythmRace")}</PrimaryButton>
                <GlassButton onClick={() => { setConfig({ trackId: RHYTHM_TRACK_ID, modeId: "sprint" }); goto("lobby"); }}>⇄ {t("rhythmTogether")}</GlassButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
