import { MODEL_NAMES } from "./i18n9";
import { CORE_WORDS } from "./i18n10";
import { useEffect, useMemo, useRef } from "react";
import { musicPlaying, setMusicIntensity, setMusicLevel, startMusic, stopMusic, styleFor } from "./music";
import { DICTS, I18nContext, LANGS, type Lang } from "./i18n";
import { EXTRA } from "./i18n2";
import { EXTRA2 as EXTRA_WORDS2 } from "./i18n3";
import { EXTRA2 } from "./i18n4";
import { EXTRA3 } from "./i18n5";
import { EXTRA4 } from "./i18n6";
import { EXTRA5 } from "./i18n7";
import { EXTRA6 } from "./i18n8";
import LobbyScreen from "./screens/LobbyScreen";
import RhythmScreen from "./screens/RhythmScreen";
import ModsScreen from "./screens/ModsScreen";
import { MOD_WORDS } from "./mods";
import { useGame } from "./store";
import { bindShakeScale } from "./particles";
import { useControls } from "./controls";
import { bindMuteGetter, bindVolumeGetter } from "./sound";
import { THEMES } from "./data";
import StartScreen from "./screens/StartScreen";
import SelectScreen from "./screens/SelectScreen";
import RaceCanvas from "./game/RaceCanvas";
import HUD from "./screens/HUD";
import { PauseOverlay, ResultsScreen, HighScoresScreen, HowToScreen } from "./screens/Overlays";
import OptionsScreen from "./screens/OptionsScreen";

export default function App() {
  const screen = useGame((s) => s.screen);
  const lang = useGame((s) => s.lang);
  const setLangStore = useGame((s) => s.setLang);
  const paused = useGame((s) => s.paused);
  const raceRunId = useGame((s) => s.raceRunId);
  const themeId = useGame((s) => s.theme);
  const controls = useControls();
  const graphicsQuality = useGame((s) => s.settings.graphicsQuality);
  const theme = THEMES[themeId] ?? THEMES.frutiger;
  const musicLevel = useGame((s) => s.settings.music);
  // the menus have music of their own, in the manner of the aesthetic picked;
  // a race brings its own, and rhythm mode has the player's song to listen to
  const menuTune = useRef<string | null>(null);
  useEffect(() => {
    if (screen === "race") {
      menuTune.current = null;
      return;
    }
    if (screen === "rhythm") {
      if (menuTune.current) stopMusic();
      menuTune.current = null;
      return;
    }
    setMusicLevel(musicLevel);
    if (menuTune.current !== themeId || !musicPlaying()) {
      startMusic(styleFor(themeId), `menu-${themeId}`);
      setMusicIntensity(0.2);
      menuTune.current = themeId;
    }
  }, [screen, themeId, musicLevel]);

  const isRtl = LANGS.find((l) => l.code === lang)?.rtl;

  useEffect(() => {
    bindMuteGetter(() => useGame.getState().muted);
    bindVolumeGetter(() => useGame.getState().settings.volume);
    bindShakeScale(() => useGame.getState().settings.shake);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [lang, isRtl]);

  const i18nValue = useMemo(() => {
    const merged: Record<string, string> = {
      ...DICTS.en,
      ...EXTRA.en,
      ...EXTRA_WORDS2.en,
      ...EXTRA2.en,
      ...EXTRA3.en,
      ...EXTRA4.en,
      ...EXTRA5.en,
      ...EXTRA6.en,
      ...MODEL_NAMES.en,
      ...CORE_WORDS.en,
      ...MOD_WORDS.en,
      ...DICTS[lang],
      ...EXTRA[lang],
      ...EXTRA_WORDS2[lang],
      ...EXTRA2[lang],
      ...EXTRA3[lang],
      ...EXTRA4[lang],
      ...EXTRA5[lang],
      ...EXTRA6[lang],
      ...MODEL_NAMES[lang],
      ...CORE_WORDS[lang],
      ...MOD_WORDS[lang],
    };
    return {
      lang,
      t: (key: string) => merged[key] ?? key,
      setLang: (l: Lang) => setLangStore(l),
    };
  }, [lang, setLangStore]);

  const vars = {
    "--sky-top": theme.skyTop,
    "--sky-mid": theme.skyBottom,
    "--sky-bottom": theme.fog,
    "--ground": theme.ground,
    "--glow": theme.glow,
    "--accent": theme.barrierA,
  } as React.CSSProperties;

  return (
    <I18nContext.Provider value={i18nValue}>
      <div data-graphics-quality={graphicsQuality} className={`theme-${themeId} h-screen w-screen overflow-hidden text-sky-900`} style={vars}>
        {screen === "start" && <StartScreen />}
        {screen === "select" && <SelectScreen />}
        {screen === "lobby" && <LobbyScreen />}
        {screen === "rhythm" && <RhythmScreen />}
        {screen === "mods" && <ModsScreen />}
        {screen === "highscores" && <HighScoresScreen />}
        {screen === "howto" && <HowToScreen />}
        {screen === "options" && <OptionsScreen />}
        {screen === "race" && (
          <div className="relative h-full w-full">
            <RaceCanvas key={raceRunId} controls={controls} />
            <HUD key={`hud-${raceRunId}`} controls={controls} />
            {paused && <PauseOverlay />}
          </div>
        )}
        {screen === "results" && <ResultsScreen />}
      </div>
    </I18nContext.Provider>
  );
}
