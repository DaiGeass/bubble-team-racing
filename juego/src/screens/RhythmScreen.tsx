import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import { THEMES, TRACKS, type ThemeId } from "../data";
import { setActiveTrack } from "../trackCurve";
import { loadRecipe, loadSong, rhythmState, rushFor, songSections, useSong, RHYTHM_TRACK_ID, type Section, type SongFeatures } from "../rhythm";
import { SONGBOOK, recipeLength, type SongRecipe } from "../songbook";
import { audioContext, resumeAudio, soundLevel } from "../sound";
import { Bubbles, GlassButton, Panel, PrimaryButton } from "../ui/common";
import { RaceTerms } from "./SelectScreen";
import { setConfig } from "../net";

const LOOKS: ThemeId[] = ["frutiger", "aero", "vapor", "y2k", "cyberpunk", "dreamcore", "eden", "slime", "techno", "sunset", "kidcore", "weirdcore", "nightcore", "traumacore", "aurora", "levelfun"];

const SECTION_COLOUR: Record<Section, string> = { land: "#38bdf8", water: "#14b8a6", sub: "#4f46e5", sky: "#f472b6", mag: "#f59e0b" };
const SECTION_WORD: Record<Section, string> = { land: "secLand", water: "secWater", sub: "secSub", sky: "secSky", mag: "secMag" };

/** The song from start to end: a bar per bar of music, as tall as it is loud, in the colour of how it is driven. */
function Timeline({ song, at }: { song: SongFeatures; at: number }) {
  const { t } = useI18n();
  const sections = useMemo(() => songSections(song.bars), [song]);
  const used = [...new Set(sections)];
  return (
    <div>
      <div className="relative flex h-20 items-end gap-px overflow-hidden rounded-xl bg-white/50 p-1.5">
        {song.bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            title={`${i + 1}`}
            style={{ height: `${12 + b.energy * 88}%`, background: SECTION_COLOUR[sections[i]], opacity: 0.55 + b.busy * 0.45 }}
          />
        ))}
        {at > 0 && <div className="absolute inset-y-0 w-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e]" style={{ left: `${Math.min(100, (at / song.duration) * 100)}%` }} />}
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

/** Bars that jump with the music while it plays, and sway with the song's shape while it does not. */
function Visualizer({ analyser, song, colours }: { analyser: AnalyserNode | null; song: SongFeatures | null; colours: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
    let raf = 0;
    const N = 48;
    const draw = () => {
      const w = (cv.width = cv.clientWidth * devicePixelRatio);
      const h = (cv.height = cv.clientHeight * devicePixelRatio);
      g.clearRect(0, 0, w, h);
      const now = performance.now() / 1000;
      if (analyser) analyser.getByteFrequencyData(data);
      const bw = w / N;
      for (let i = 0; i < N; i++) {
        let v: number;
        if (analyser) {
          // a log spread, so the bass is not all in the first two bars
          const k = Math.floor(Math.pow(i / N, 1.8) * (data.length * 0.7));
          v = data[k] / 255;
        } else {
          const bars = song?.bars;
          const b = bars ? bars[Math.floor(((i / N) * bars.length + now * 2) % bars.length)] : null;
          v = (b ? b.energy * 0.7 : 0.25) * (0.6 + 0.4 * Math.sin(now * 3 + i * 0.5));
        }
        const bh = Math.max(3, v * h * 0.95);
        const grad = g.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, colours[0]);
        grad.addColorStop(1, colours[i % 2 ? 1 : 2]);
        g.fillStyle = grad;
        const r = Math.min(bw * 0.35, 6 * devicePixelRatio);
        const x = i * bw + bw * 0.15;
        g.beginPath();
        g.roundRect(x, h - bh, bw * 0.7, bh, [r, r, 0, 0]);
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, song, colours]);
  return <canvas ref={canvas} className="h-28 w-full rounded-2xl bg-sky-950/70" />;
}

const RECIPE_COLOUR = (r: SongRecipe) => {
  const th = THEMES[r.theme];
  return `linear-gradient(135deg, ${th.skyTop}, ${th.glow} 55%, ${th.barrierA})`;
};

/** Rhythm mode: bring a song or take one of ours, and race the circuit it makes. */
export default function RhythmScreen() {
  const { t } = useI18n();
  const goto = useGame((s) => s.goto);
  const setMode = useGame((s) => s.setMode);
  const setTrackId = useGame((s) => s.setTrackId);
  const resetTelemetry = useGame((s) => s.resetTelemetry);
  const setRaceResult = useGame((s) => s.setRaceResult);
  const restartRace = useGame((s) => s.restartRace);
  const [song, setSongState] = useState<SongFeatures | null>(rhythmState.features);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [look, setLook] = useState<ThemeId>(rhythmState.theme);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [playAt, setPlayAt] = useState(0);
  const preview = useRef<{ src: AudioBufferSourceNode; gain: GainNode; start: number } | null>(null);

  function stopPreview() {
    const p = preview.current;
    preview.current = null;
    if (p) {
      try {
        p.src.stop();
      } catch {
        /* already stopped */
      }
      p.gain.disconnect();
    }
    setAnalyser(null);
    setPlayAt(0);
  }
  useEffect(() => stopPreview, []);
  // the play head moves while the preview plays
  useEffect(() => {
    if (!analyser) return;
    const id = window.setInterval(() => {
      const c = audioContext();
      if (c && preview.current) setPlayAt(c.currentTime - preview.current.start);
    }, 120);
    return () => window.clearInterval(id);
  }, [analyser]);

  function startPreview() {
    const c = audioContext();
    if (!c || !rhythmState.buffer) return;
    stopPreview();
    resumeAudio();
    const src = c.createBufferSource();
    src.buffer = rhythmState.buffer;
    const an = c.createAnalyser();
    an.fftSize = 512;
    an.smoothingTimeConstant = 0.75;
    const gain = c.createGain();
    gain.gain.value = Math.max(0.2, soundLevel());
    src.connect(an);
    an.connect(gain);
    gain.connect(c.destination);
    // straight to the chorus: start a third of the way in
    const from = rhythmState.buffer.duration * 0.3;
    src.start(0, from);
    src.onended = () => {
      if (preview.current?.src === src) stopPreview();
    };
    preview.current = { src, gain, start: c.currentTime - from };
    setAnalyser(an);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    stopPreview();
    resumeAudio();
    setBusy("file");
    setError("");
    try {
      setSongState(await loadSong(await file.arrayBuffer(), file.name, look));
    } catch (e) {
      setError((e as Error).message === "short" ? t("rhythmShort") : t("rhythmBad"));
    }
    setBusy(null);
  }

  async function pickRecipe(r: SongRecipe) {
    stopPreview();
    resumeAudio();
    setBusy(r.id);
    setError("");
    try {
      setLook(r.theme);
      setSongState(await loadRecipe(r, r.theme));
    } catch {
      setError(t("rhythmBad"));
    }
    setBusy(null);
  }

  function restyle(theme: ThemeId) {
    setLook(theme);
    if (rhythmState.features) useSong(rhythmState.features, rhythmState.buffer, rhythmState.bytes, theme);
  }

  function race() {
    stopPreview();
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
  const th = THEMES[look];
  const beat = song ? 60 / song.bpm : 0.5;
  const colours = useMemo(() => [th.barrierA, th.glow, th.barrierB], [th]);

  return (
    <div className="aero-gradient relative h-full w-full overflow-y-auto">
      {/* the background breathes with the tempo of the song */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="tempo-blob absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ background: th.glow, ["--beat" as string]: `${beat}s` }} />
        <div className="tempo-blob absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: th.barrierA, ["--beat" as string]: `${beat * 2}s` }} />
        <div className="tempo-blob absolute left-1/3 top-1/2 h-72 w-72 rounded-full blur-3xl" style={{ background: th.skyTop, ["--beat" as string]: `${beat * 4}s` }} />
      </div>
      <Bubbles count={10} />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <GlassButton onClick={() => { stopPreview(); goto("start"); }}>← {t("back")}</GlassButton>
          <h1 className="font-display text-3xl font-extrabold text-sky-900 sm:text-4xl">♫ {t("rhythmMode")}</h1>
          <span className="w-20" />
        </div>

        <Panel className="space-y-3 p-5">
          <div className="text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("rhythmSongbook")}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SONGBOOK.map((r) => (
              <button
                key={r.id}
                disabled={busy !== null}
                onClick={() => pickRecipe(r)}
                className={`group relative overflow-hidden rounded-2xl p-3 text-left text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 ${song?.name === r.name ? "ring-4 ring-white" : ""}`}
                style={{ background: RECIPE_COLOUR(r) }}
              >
                <div className="absolute -right-3 -top-4 text-6xl font-black text-white/25 transition group-hover:rotate-12">♪</div>
                <div className="relative font-display text-base font-extrabold drop-shadow">{r.name}</div>
                <div className="relative mt-1 text-[11px] font-bold text-white/90 drop-shadow">
                  {r.bpm} BPM · {minutes(recipeLength(r))} · {THEMES[r.theme].name}
                </div>
                {busy === r.id && <div className="relative mt-1 animate-pulse text-[11px] font-extrabold">{t("rhythmMaking")}</div>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/50 pt-3">
            <span className="text-sm font-semibold text-sky-900/80">{t("rhythmHelp")}</span>
            <label className={`glass-btn inline-flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 font-extrabold text-sky-900 ${busy === "file" ? "animate-pulse" : ""}`}>
              ♫ {busy === "file" ? t("rhythmListening") : t("rhythmPick")}
              <input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac" className="hidden" disabled={busy !== null} onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </div>
          {error && <div className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{error}</div>}
        </Panel>

        {song && def && (
          <div className="grid gap-3 lg:grid-cols-[18rem_1fr]">
            <Panel className="flex flex-col items-center gap-3 p-4">
              <Visualizer analyser={analyser} song={song} colours={colours} />
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
              {rhythmState.buffer && (
                <GlassButton onClick={() => (analyser ? stopPreview() : startPreview())}>{analyser ? `■ ${t("rhythmStop")}` : `▶ ${t("rhythmPreview")}`}</GlassButton>
              )}
              <div className="rounded-xl bg-white/60 px-3 py-2 text-center text-[11px] font-bold text-sky-900/80">{t("rhythmBeatHelp")}</div>
            </Panel>
            <div className="flex flex-col gap-3">
              <Panel className="p-4">
                <Timeline song={song} at={playAt} />
                <div className="mt-2 text-xs font-bold text-sky-900/70">{t("rhythmBuilt")}</div>
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
                <GlassButton onClick={() => { stopPreview(); setConfig({ trackId: RHYTHM_TRACK_ID, modeId: "sprint" }); goto("lobby"); }}>⇄ {t("rhythmTogether")}</GlassButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
