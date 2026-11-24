import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import { THEMES, TRACKS, type ThemeId } from "../data";
import { setActiveTrack } from "../trackCurve";
import { loadSong, rhythmState, rushFor, songSections, useSong, RHYTHM_TRACK_ID, type Section, type SongFeatures } from "../rhythm";
import { resumeAudio } from "../sound";
import { Bubbles, GlassButton, Panel, PrimaryButton } from "../ui/common";
import { RaceTerms } from "./SelectScreen";
import { setConfig } from "../net";

const LOOKS: ThemeId[] = ["frutiger", "aero", "vapor", "y2k", "cyberpunk", "dreamcore", "eden", "slime", "techno", "sunset"];

const SECTION_COLOUR: Record<Section, string> = { land: "#38bdf8", water: "#14b8a6", sub: "#4f46e5", sky: "#f472b6", mag: "#f59e0b" };
const SECTION_WORD: Record<Section, string> = { land: "secLand", water: "secWater", sub: "secSub", sky: "secSky", mag: "secMag" };

/** The song from start to end: a bar per bar of music, as tall as it is loud, in the colour of how it is driven. */
function Timeline({ song }: { song: SongFeatures }) {
  const { t } = useI18n();
  const sections = useMemo(() => songSections(song.bars), [song]);
  const used = [...new Set(sections)];
  return (
    <div>
      <div className="flex h-20 items-end gap-px overflow-hidden rounded-xl bg-white/50 p-1.5">
        {song.bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            title={`${i + 1}`}
            style={{ height: `${12 + b.energy * 88}%`, background: SECTION_COLOUR[sections[i]], opacity: 0.55 + b.busy * 0.45 }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-sky-900">
        {used.map((s) => (
          <span key={s} className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SECTION_COLOUR[s] }} />
            {t(SECTION_WORD[s])}
          </span>
        ))}
      </div>
    </div>
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

  async function pick(file: File | undefined) {
    if (!file) return;
    resumeAudio();
    setBusy(true);
    setError("");
    try {
      const features = await loadSong(await file.arrayBuffer(), file.name, look);
      setSongState(features);
    } catch (e) {
      setError((e as Error).message === "short" ? t("rhythmShort") : t("rhythmBad"));
    }
    setBusy(false);
  }

  function restyle(theme: ThemeId) {
    setLook(theme);
    if (rhythmState.features) {
      useSong(rhythmState.features, rhythmState.buffer, rhythmState.bytes, theme);
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
              {/* the circuit is not shown: it is built while you drive it */}
              <div className="grid h-40 w-56 place-items-center rounded-2xl border-2 border-dashed border-sky-400/60 bg-white/40 text-center">
                <div>
                  <div className="text-4xl text-sky-500">♫ ⋯</div>
                  <div className="mt-1 px-3 text-xs font-bold text-sky-900/80">{t("rhythmBuilt")}</div>
                </div>
              </div>
              <div className="text-center">
                <div className="font-display text-xl font-extrabold text-sky-900">{song.name}</div>
                <div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[11px] font-bold text-sky-800">
                  <span className="rounded-full bg-white/70 px-2 py-0.5">{Math.round(song.bpm)} BPM</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5">{minutes(song.duration)}</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5">{song.bars.length} {t("rhythmBars")}</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">×{rushFor(song.bpm).toFixed(2)} {t("rhythmSpeed")}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">⇧ {def.pads?.length ?? 0}</span>
                </div>
              </div>
            </Panel>
            <div className="flex flex-col gap-3">
              <Panel className="p-4">
                <Timeline song={song} />
              </Panel>
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
