import { backToLobby, inRoom, isHost, recall } from "../net";
import { useState } from "react";
import { useI18n, ordinal } from "../i18n";
import { useGame } from "../store";
import { Bubbles, GlassButton, Panel, PrimaryButton } from "../ui/common";
import { CHARACTERS, WEAPONS, WEAPON_META, THEMES, type ThemeId } from "../data";
import Portrait from "../ui/Portrait";

function formatTime(ms: number) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export function PauseOverlay() {
  const { t } = useI18n();
  const setPaused = useGame((s) => s.setPaused);
  const restartRace = useGame((s) => s.restartRace);
  const goto = useGame((s) => s.goto);
  const resetTelemetry = useGame((s) => s.resetTelemetry);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-sky-950/45 backdrop-blur-md">
      <Panel className="pop-in w-[92%] max-w-sm p-7 text-center">
        <h2 className="font-display text-stroke text-4xl font-extrabold text-sky-900">❚❚ {t("paused")}</h2>
        <div className="mt-6 flex flex-col gap-2.5">
          <PrimaryButton onClick={() => setPaused(false)}>▶ {t("resume")}</PrimaryButton>
          <GlassButton
            onClick={() => {
              resetTelemetry();
              restartRace();
            }}
          >
            ↻ {t("restart")}
          </GlassButton>
          <GlassButton
            onClick={() => {
              setPaused(false);
              goto("select");
            }}
          >
            ⌂ {t("mainMenu")}
          </GlassButton>
        </div>
      </Panel>
    </div>
  );
}

export function ResultsScreen() {
  const { t } = useI18n();
  const result = useGame((s) => s.raceResult);
  const goto = useGame((s) => s.goto);
  const restartRace = useGame((s) => s.restartRace);
  const resetTelemetry = useGame((s) => s.resetTelemetry);
  const addHighScore = useGame((s) => s.addHighScore);
  const modeId = useGame((s) => s.modeId);
  const characterId = useGame((s) => s.characterId);
  const partnerId = useGame((s) => s.partnerId);
  const theme = useGame((s) => s.theme);
  const highScores = useGame((s) => s.highScores);
  const setRaceResult = useGame((s) => s.setRaceResult);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  const character = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
  const partner = CHARACTERS.find((c) => c.id === partnerId) ?? CHARACTERS[1];

  if (!result) {
    return (
      <div className="relative flex h-full w-full items-center justify-center aero-gradient">
        <Panel className="p-8 text-center">
          <p className="text-sky-900">{t("raceFinished")}</p>
          <GlassButton className="mt-4" onClick={() => goto("select")}>
            {t("mainMenu")}
          </GlassButton>
        </Panel>
      </div>
    );
  }

  const isTop = highScores.length < 10 || result.score > (highScores[highScores.length - 1]?.score ?? 0);

  function handleSave() {
    addHighScore({ name: name.trim() || "???", score: result!.score, mode: modeId, character: characterId, theme, date: Date.now() });
    setSaved(true);
  }

  function handleRestart() {
    resetTelemetry();
    setRaceResult(null);
    restartRace();
    goto("race");
  }

  const rows = [
    { label: t("time"), value: formatTime(result.timeMs) },
    { label: t("coins"), value: `◉ ${result.coins}` },
    { label: t("rings"), value: `◎ ${result.rings}` },
    { label: t("tagBonus"), value: `⇄ ${result.tagSwaps}` },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden aero-gradient">
      <Bubbles count={16} />
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-4">
        <h1 className="font-display text-stroke pop-in text-4xl font-extrabold text-sky-900 drop-shadow-sm sm:text-6xl">
          ⚑ {t("raceFinished")}
        </h1>

        <Panel className="pop-in w-full max-w-md p-5">
          <div className="flex items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl" style={{ background: character.primary, opacity: 0.7 }} />
              <Portrait char={character} size={92} className="relative" />
            </div>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-wide text-sky-700/70">{t("finishPosition")}</div>
              <div className="font-display text-5xl font-extrabold leading-none text-rose-600">{ordinal(result.position, t)}</div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl" style={{ background: partner.primary, opacity: 0.7 }} />
              <Portrait char={partner} size={92} className="relative" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {rows.map((r) => (
              <div key={r.label} className="glass-panel rounded-2xl px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-sky-800/60">{r.label}</div>
                <div className="font-mono text-lg font-extrabold text-sky-900">{r.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "linear-gradient(90deg,#ffd166,#ff9f6e)" }}>
            <span className="font-display text-sm font-extrabold uppercase tracking-wide text-white/90">{t("grandTotal")}</span>
            <span className="font-display text-3xl font-extrabold text-white drop-shadow">{result.score}</span>
          </div>

          {!saved ? (
            <div className="mt-3">
              {isTop && <div className="mb-1.5 text-center text-sm font-extrabold text-amber-600">✦ {t("newRecord")}</div>}
              <div className="flex gap-2">
                <input
                  value={name}
                  maxLength={12}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("enterYourName")}
                  className="glass-panel flex-1 rounded-2xl px-3 py-2 font-semibold text-sky-900 outline-none placeholder:text-sky-700/50"
                />
                <GlassButton onClick={handleSave}>{t("saveScore")}</GlassButton>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-center text-sm font-bold text-emerald-600">✓ {t("saveScore")}</div>
          )}
        </Panel>

        <div className="flex flex-wrap justify-center gap-2">
          {inRoom() ? (
            <PrimaryButton onClick={() => (isHost() ? recall() : backToLobby())}>⇄ {t("backToLobby")}</PrimaryButton>
          ) : (
            <PrimaryButton onClick={handleRestart}>↻ {t("playAgain")}</PrimaryButton>
          )}
          <GlassButton onClick={() => goto("select")}>◕ {t("changeRacer")}</GlassButton>
          <GlassButton onClick={() => goto("highscores")}>⚑ {t("viewHighScores")}</GlassButton>
        </div>
      </div>
    </div>
  );
}

export function HighScoresScreen() {
  const { t } = useI18n();
  const goto = useGame((s) => s.goto);
  const highScores = useGame((s) => s.highScores);

  return (
    <div className="relative h-full w-full overflow-hidden aero-gradient">
      <Bubbles count={10} />
      <div className="relative z-10 flex h-full w-full flex-col items-center px-4 py-5">
        <div className="flex w-full max-w-lg items-center justify-between">
          <GlassButton onClick={() => goto("start")}>← {t("back")}</GlassButton>
          <h1 className="font-display text-stroke text-2xl font-extrabold text-sky-900 sm:text-4xl">⚑ {t("highScoreTable")}</h1>
          <div className="w-20" />
        </div>
        <Panel className="mt-4 w-full max-w-lg flex-1 overflow-y-auto p-3">
          {highScores.length === 0 ? (
            <p className="py-10 text-center font-semibold text-sky-700/70">{t("noScores")}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {highScores.map((h, i) => {
                const char = CHARACTERS.find((c) => c.id === h.character) ?? CHARACTERS[0];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${i === 0 ? "text-amber-700" : "text-sky-900"}`}
                    style={{
                      background: i === 0 ? "linear-gradient(90deg,#fff3bf,#ffd166)" : "rgba(255,255,255,0.4)",
                      boxShadow: i === 0 ? "0 0 18px rgba(255,209,102,0.7)" : undefined,
                    }}
                  >
                    <span className="font-display w-8 text-xl font-extrabold">#{i + 1}</span>
                    <Portrait char={char} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display truncate text-base font-extrabold">{h.name}</div>
                      <div className="text-[10px] font-semibold opacity-70">
                        {char.name} · {THEMES[(h.theme ?? "frutiger") as ThemeId]?.name}
                      </div>
                    </div>
                    <span className="font-display text-lg font-extrabold">{h.score}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function HowToScreen() {
  const { t } = useI18n();
  const goto = useGame((s) => s.goto);
  return (
    <div className="relative h-full w-full overflow-hidden aero-gradient">
      <Bubbles count={8} />
      <div className="relative z-10 flex h-full w-full flex-col items-center px-4 py-5">
        <div className="flex w-full max-w-3xl items-center justify-between">
          <GlassButton onClick={() => goto("start")}>← {t("back")}</GlassButton>
          <h1 className="font-display text-stroke text-2xl font-extrabold text-sky-900 sm:text-4xl">? {t("howToPlayTitle")}</h1>
          <div className="w-20" />
        </div>
        <div className="mt-4 grid w-full max-w-3xl grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          <Panel className="p-4">
            <h3 className="font-display mb-2 text-lg font-extrabold text-sky-900">⌨ {t("keyboardControls")}</h3>
            <ul className="space-y-1.5 text-sm font-semibold text-sky-800">
              <li><b>↑ / W</b> — {t("accelerate")}</li>
              <li><b>↓ / S</b> — {t("brake")}</li>
              <li><b>← → / A D</b> — {t("steer")}</li>
              <li><b>Shift</b> — {t("drift")}</li>
              <li><b>Space</b> — {t("useItem")}</li>
              <li><b>Q</b> — {t("swapRacer")}</li>
              <li><b>Esc / P</b> — {t("pauseGame")}</li>
            </ul>
          </Panel>
          <Panel className="p-4">
            <h3 className="font-display mb-2 text-lg font-extrabold text-sky-900">▣ {t("touchControls")}</h3>
            <ul className="space-y-1.5 text-sm font-semibold text-sky-800">
              <li><b>◀ ▶</b> — {t("steer")}</li>
              <li><b>▲</b> — {t("accelerate")}</li>
              <li><b>▼</b> — {t("brake")}</li>
              <li><b>≋</b> — {t("drift")}</li>
              <li><b>{WEAPON_META.orb.glyph}</b> — {t("useItem")}</li>
              <li><b>⇄</b> — {t("swapRacer")}</li>
            </ul>
          </Panel>
          <Panel className="p-4 sm:col-span-2">
            <h3 className="font-display mb-2 text-lg font-extrabold text-sky-900">✦ {t("weapons")}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              {WEAPONS.map((wid) => (
                <div key={wid} className="glass-panel rounded-2xl p-2 text-center">
                  <div className="text-3xl" style={{ color: WEAPON_META[wid].color, textShadow: `0 0 14px ${WEAPON_META[wid].glow}` }}>
                    {WEAPON_META[wid].glyph}
                  </div>
                  <div className="text-xs font-extrabold text-sky-900">{t(`weapon_${wid}`)}</div>
                  <div className="text-[10px] leading-tight text-sky-800/70">{t(`wdesc_${wid}`)}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-4 sm:col-span-2">
            <h3 className="font-display mb-1 text-lg font-extrabold text-sky-900">≈ {t("zoneInfo")}</h3>
            <div className="flex flex-wrap gap-2 text-xs font-bold text-sky-800">
              <span className="rounded-full bg-white/60 px-3 py-1">▬ {t("modeLand")}</span>
              <span className="rounded-full bg-white/60 px-3 py-1">≈ {t("modeBoat")}</span>
              <span className="rounded-full bg-white/60 px-3 py-1">✈ {t("modePlane")} · {t("rings")}</span>
              <span className="rounded-full bg-white/60 px-3 py-1">⇄ {t("swapRacer")}</span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
