import { useEffect, useMemo } from "react";
import { DICTS, I18nContext, LANGS, type Lang } from "./i18n";
import { EXTRA } from "./i18n2";
import { EXTRA2 as EXTRA_WORDS2 } from "./i18n3";
import { EXTRA2 } from "./i18n4";
import { EXTRA3 } from "./i18n5";
import { EXTRA4 } from "./i18n6";
import { EXTRA5 } from "./i18n7";
import { EXTRA6 } from "./i18n8";
import LobbyScreen from "./screens/LobbyScreen";
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
  const theme = THEMES[themeId] ?? THEMES.frutiger;

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
      ...DICTS[lang],
      ...EXTRA[lang],
      ...EXTRA_WORDS2[lang],
      ...EXTRA2[lang],
      ...EXTRA3[lang],
      ...EXTRA4[lang],
      ...EXTRA5[lang],
      ...EXTRA6[lang],
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
      <div className={`theme-${themeId} h-screen w-screen overflow-hidden text-sky-900`} style={vars}>
        {screen === "start" && <StartScreen />}
        {screen === "select" && <SelectScreen />}
        {screen === "lobby" && <LobbyScreen />}
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
