import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import { Bubbles, GlassButton, LanguageSwitcher, PrimaryButton } from "../ui/common";
import Vehicle, { type KartVisualState } from "../game/Vehicle";
import { CHARACTERS, THEMES, THEME_LIST, type ThemeId } from "../data";
import Portrait from "../ui/Portrait";

function HeroKart({ themeId }: { themeId: ThemeId }) {
  const ref = useRef<Group>(null);
  const characterId = useGame((s) => s.characterId);
  const vehicle = useGame((s) => s.vehicle);
  const visual = useRef<KartVisualState>({
    boosting: true,
    shielded: false,
    steer: 0,
    speedFrac: 0.7,
    stunned: false,
    mode: "land",
    drift: false,
  });
  const theme = THEMES[themeId];
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
  useFrame((state, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.55;
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.12;
    }
    visual.current.boosting = Math.sin(state.clock.elapsedTime * 2.4) > -0.5;
  });
  return (
    <>
      <ambientLight intensity={1.05} color={theme.ambientColor} />
      <directionalLight position={[4, 6, 3]} intensity={theme.sunIntensity} color={theme.sun} />
      <pointLight position={[-3, 1.5, -3]} intensity={40} color={theme.glow} distance={16} />
      <group ref={ref} position={[0, -0.35, 0]}>
        <Vehicle character={char} vehicle={vehicle} stateRef={visual} scale={1.55} isPlayer glow={theme.glow} />
      </group>
    </>
  );
}

export default function StartScreen() {
  const { t } = useI18n();
  const goto = useGame((s) => s.goto);
  const muted = useGame((s) => s.muted);
  const toggleMuted = useGame((s) => s.toggleMuted);
  const theme = useGame((s) => s.theme);
  const setTheme = useGame((s) => s.setTheme);
  const characterId = useGame((s) => s.characterId);
  const setCharacter = useGame((s) => s.setCharacter);
  const th = THEMES[theme];

  return (
    <div className="relative h-full w-full overflow-hidden aero-gradient">
      <Bubbles count={18} />
      <div className="pointer-events-none absolute -left-20 -top-10 h-72 w-72 rounded-full blur-3xl" style={{ background: th.glow, opacity: 0.45 }} />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-80 w-80 rounded-full blur-3xl" style={{ background: th.barrierA, opacity: 0.35 }} />

      <div className="relative z-10 flex h-full w-full flex-col px-4 py-4 sm:px-8">
        <div className="flex items-start justify-between gap-2">
          <div className="pop-in">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-800/60">{t("language")}</div>
            <LanguageSwitcher />
          </div>
          <div className="pop-in flex gap-2">
            <GlassButton onClick={toggleMuted}>{muted ? "✕" : "♪"}</GlassButton>
            <GlassButton onClick={() => goto("highscores")}>⚑ {t("highScoreTable")}</GlassButton>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-1 lg:flex-row lg:items-center lg:gap-6">
          <div className="text-center lg:text-left">
            <div className="pop-in inline-block rounded-full px-4 py-1 text-xs font-extrabold uppercase tracking-[0.25em] text-white shadow-lg" style={{ background: th.barrierA }}>
              {t("appSubtitle")}
            </div>
            <h1 className="font-display text-stroke pop-in mt-2 text-5xl font-extrabold leading-[0.95] text-sky-900 drop-shadow-sm sm:text-7xl lg:text-8xl">
              TURBO
              <br />
              <span style={{ color: th.barrierA, WebkitTextStroke: "2px rgba(255,255,255,0.85)" }}>SPLASH</span>
            </h1>
            <p className="mt-2 max-w-sm text-sm font-semibold text-sky-800/80 sm:text-base">{t("tagline")}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              {THEME_LIST.map((id) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  title={THEMES[id].name}
                  className={`h-9 w-9 rounded-full ring-2 transition hover:scale-110 ${theme === id ? "scale-110 ring-white" : "ring-white/50"}`}
                  style={{ background: `linear-gradient(140deg, ${THEMES[id].skyTop}, ${THEMES[id].glow}, ${THEMES[id].barrierA})`, boxShadow: theme === id ? `0 0 16px ${THEMES[id].glow}` : undefined }}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row lg:items-start">
              <PrimaryButton big onClick={() => goto("select")}>
                ▶ {t("play")}
              </PrimaryButton>
              <GlassButton onClick={() => goto("lobby")}>⇄ {t("multiplayer")}</GlassButton>
              <GlassButton onClick={() => goto("howto")}>? {t("howToPlayTitle")}</GlassButton>
              <GlassButton onClick={() => goto("options")}>{t("options")}</GlassButton>
            </div>
          </div>

          <div className="relative h-56 w-72 shrink-0 sm:h-72 sm:w-96">
            <div className="absolute inset-6 rounded-full blur-2xl" style={{ background: th.glow, opacity: 0.5 }} />
            <Canvas camera={{ position: [3.4, 2.2, 5.4], fov: 42 }} dpr={[1, 1.6]}>
              <HeroKart themeId={theme} />
            </Canvas>
          </div>
        </div>

        <div className="mt-2">
          <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-800/60">{t("racers")}</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCharacter(c.id)}
                className={`group relative shrink-0 rounded-2xl p-1 transition hover:-translate-y-1 ${
                  characterId === c.id ? "glass-panel ring-2" : "bg-white/25 hover:bg-white/45"
                }`}
                style={characterId === c.id ? ({ ["--tw-ring-color" as string]: c.primary } as React.CSSProperties) : undefined}
              >
                <Portrait char={c} size={54} />
                <div className="font-display text-center text-[10px] font-extrabold text-sky-900">{c.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
