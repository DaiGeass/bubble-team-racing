import { useState } from "react";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import {
  CHARACTERS,
  BODY_COLORS,
  DECAL_COLORS,
  WHEEL_STYLES,
  SPOILERS,
  BOOSTERS,
  BOATS,
  PLANES,
  SUBS,
  SHAPES,
  THEMES,
  THEME_LIST,
  TRACKS,
  MODES,
  WEAPONS,
  WEAPON_META,
  FINISH_META,
  FINISHES,
  type WheelStyle,
  type ShapeId,
  type ThemeId,
  type SpoilerId,
  type BoosterId,
  type BoatId,
  type PlaneId,
  type SubId,
  type VehicleMode,
  type FinishId,
  WHEEL_EFFECTS,
  SPOILER_EFFECTS,
  BOOSTER_EFFECTS,
  partLabels,
  fusionShot,
} from "../data";
import { setActiveTrack } from "../trackCurve";
import { Bubbles, GlassButton, Panel, PrimaryButton, StatBar } from "../ui/common";
import CharacterPreview from "../game/CharacterPreview";
import Portrait from "../ui/Portrait";

type Tab = "mode" | "track" | "racer" | "partner" | "garage" | "aesthetic" | "settings";

const MODE_INFO: { id: "quick" | "trial" | "chaos" | "sprint" | "duel" | "endurance"; glyph: string; titleKey: string; descKey: string }[] = [
  { id: "quick", glyph: "⚑", titleKey: "quickRace", descKey: "quickRaceDesc" },
  { id: "sprint", glyph: "➤", titleKey: "sprintMode", descKey: "sprintDesc" },
  { id: "trial", glyph: "◷", titleKey: "timeTrial", descKey: "timeTrialDesc" },
  { id: "chaos", glyph: "✦", titleKey: "chaosMode", descKey: "chaosDesc" },
  { id: "duel", glyph: "⚔", titleKey: "duelMode", descKey: "duelDesc" },
  { id: "endurance", glyph: "∞", titleKey: "enduranceMode", descKey: "enduranceDesc" },
];

const SHAPE_GLYPH: Record<string, string> = {
  kart: "⛟", hover: "◎", buggy: "⛝", jet: "➤", cruiser: "⛴", moto: "⚑", ufo: "⏣",
  coupe: "◢", van: "▣", formula: "⏵", bubble: "◉", rocket: "▲", mono: "◆",
  tank: "◼", wedge: "▼", sled: "⩕", orbit: "◍", dune: "⬢", phantom: "◇",
};

/** Tiny SVG preview of a circuit built from its control points. */
function TrackPreview({ points, color, water }: { points: [number, number, number][]; color: string; water: string }) {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const w = maxX - minX || 1, h = maxZ - minZ || 1;
  const s = 88 / Math.max(w, h);
  const ox = (100 - w * s) / 2, oy = (100 - h * s) / 2;
  const pts = points.map((p) => `${(p[0] - minX) * s + ox},${(p[2] - minZ) * s + oy}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24">
      <polygon points={pts} fill="none" stroke="rgba(10,50,80,0.3)" strokeWidth="10" strokeLinejoin="round" />
      <polygon points={pts} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" />
      <polygon points={pts} fill="none" stroke={water} strokeWidth="2" strokeDasharray="6 10" strokeLinejoin="round" />
    </svg>
  );
}

export default function SelectScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("racer");
  const [previewMode, setPreviewMode] = useState<VehicleMode>("land");
  const goto = useGame((s) => s.goto);
  const modeId = useGame((s) => s.modeId);
  const setMode = useGame((s) => s.setMode);
  const theme = useGame((s) => s.theme);
  const setTheme = useGame((s) => s.setTheme);
  const characterId = useGame((s) => s.characterId);
  const partnerId = useGame((s) => s.partnerId);
  const setCharacter = useGame((s) => s.setCharacter);
  const setPartner = useGame((s) => s.setPartner);
  const vehicle = useGame((s) => s.vehicle);
  const setVehicle = useGame((s) => s.setVehicle);
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const restartRace = useGame((s) => s.restartRace);
  const setRaceResult = useGame((s) => s.setRaceResult);
  const resetTelemetry = useGame((s) => s.resetTelemetry);

  const mainChar = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
  const partnerChar = CHARACTERS.find((c) => c.id === partnerId) ?? CHARACTERS[1];

  const trackId = useGame((s) => s.trackId);
  const setTrackId = useGame((s) => s.setTrackId);

  const tabs: { id: Tab; label: string; glyph: string }[] = [
    { id: "racer", label: t("selectRacer"), glyph: "◕" },
    { id: "partner", label: t("selectPartner"), glyph: "⇄" },
    { id: "garage", label: t("customize"), glyph: "⚙" },
    { id: "track", label: t("trackTab"), glyph: "➰" },
    { id: "aesthetic", label: t("aesthetics"), glyph: "❖" },
    { id: "mode", label: t("selectMode"), glyph: "⚑" },
    { id: "settings", label: t("settings"), glyph: "☰" },
  ];

  function handleStart() {
    setActiveTrack(trackId);
    setRaceResult(null);
    resetTelemetry();
    restartRace();
    goto("race");
  }

  return (
    <div className="relative h-full w-full overflow-hidden aero-gradient">
      <Bubbles count={12} />
      <div className="pointer-events-none absolute -left-16 top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: THEMES[theme].glow, opacity: 0.35 }} />
      <div className="pointer-events-none absolute -right-10 bottom-10 h-72 w-72 rounded-full blur-3xl" style={{ background: THEMES[theme].barrierA, opacity: 0.3 }} />

      <div className="relative z-10 flex h-full w-full flex-col px-3 py-3 sm:px-8 sm:py-5">
        <div className="flex items-center justify-between gap-2">
          <GlassButton onClick={() => goto("start")}>← {t("back")}</GlassButton>
          <h2 className="font-display text-stroke truncate text-2xl font-extrabold text-sky-900 sm:text-4xl">
            {tabs.find((x) => x.id === tab)?.label}
          </h2>
          <div className="w-24" />
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm ${
                tab === tb.id ? "glass-btn text-sky-900 scale-105" : "bg-white/25 text-sky-800/70 hover:bg-white/40"
              }`}
            >
              <span className="mr-1">{tb.glyph}</span>
              {tb.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex-1 overflow-y-auto pb-2">
          {/* ---------------- RACER / PARTNER ---------------- */}
          {(tab === "racer" || tab === "partner") && (
            <div className="flex flex-col gap-3 lg:flex-row">
              <Panel className="flex flex-col items-center justify-center gap-2 p-4 lg:w-72">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl"
                    style={{ background: (tab === "racer" ? mainChar : partnerChar).primary, opacity: 0.55 }}
                  />
                  <Portrait char={tab === "racer" ? mainChar : partnerChar} size={150} className="relative drop-shadow-xl" />
                </div>
                <div className="font-display text-3xl font-extrabold text-sky-900">
                  {(tab === "racer" ? mainChar : partnerChar).name}
                </div>
                <div className="rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ background: (tab === "racer" ? mainChar : partnerChar).accent }}>
                  {t(`role_${(tab === "racer" ? mainChar : partnerChar).role}`)}
                </div>
                <div className="mt-2 w-full space-y-1.5 text-xs font-semibold text-sky-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 opacity-70">{t("speed")}</span>
                    <StatBar value={(tab === "racer" ? mainChar : partnerChar).speed} color="#ff4d6d" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 opacity-70">{t("accel")}</span>
                    <StatBar value={(tab === "racer" ? mainChar : partnerChar).accel} color="#ffb703" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 opacity-70">{t("handling")}</span>
                    <StatBar value={(tab === "racer" ? mainChar : partnerChar).handling} color="#38bdf8" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 opacity-70">{t("weight")}</span>
                    <StatBar value={(tab === "racer" ? mainChar : partnerChar).weight} color="#4ade80" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 opacity-70">{t("fuse")}</span>
                    <span className="flex items-center gap-1.5 rounded-full bg-white/50 px-2 py-0.5 text-[10px] font-extrabold tracking-wide">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: fusionShot((tab === "racer" ? mainChar : partnerChar).id).color }} />
                      {fusionShot((tab === "racer" ? mainChar : partnerChar).id).name}
                    </span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs font-bold text-sky-800">
                  <span style={{ color: WEAPON_META[(tab === "racer" ? mainChar : partnerChar).favorite].color, fontSize: 18 }}>
                    {WEAPON_META[(tab === "racer" ? mainChar : partnerChar).favorite].glyph}
                  </span>
                  {t(`weapon_${(tab === "racer" ? mainChar : partnerChar).favorite}`)}
                </div>
              </Panel>

              <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4">
                {CHARACTERS.map((c) => {
                  const selected = tab === "racer" ? characterId === c.id : partnerId === c.id;
                  const disabled = tab === "partner" && c.id === characterId;
                  return (
                    <button
                      key={c.id}
                      disabled={disabled}
                      onClick={() => (tab === "racer" ? setCharacter(c.id) : setPartner(c.id))}
                      className={`group relative flex flex-col items-center rounded-3xl p-2 transition ${
                        disabled ? "opacity-30" : "hover:-translate-y-1"
                      } ${selected ? "glass-panel ring-4" : "bg-white/25 hover:bg-white/45"}`}
                      style={selected ? ({ ["--tw-ring-color" as string]: c.primary } as React.CSSProperties) : undefined}
                    >
                      <div
                        className="absolute inset-x-3 top-1 h-8 rounded-full blur-lg transition group-hover:opacity-80"
                        style={{ background: c.primary, opacity: selected ? 0.7 : 0.25 }}
                      />
                      <Portrait char={c} size={76} className="relative" />
                      <span className="font-display relative mt-1 text-sm font-extrabold text-sky-900">{c.name}</span>
                      <span className="relative text-[10px] font-semibold text-sky-800/70">{t(`role_${c.role}`)}</span>
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-emerald-600 shadow">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------- GARAGE ---------------- */}
          {tab === "garage" && (
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
              <div className="w-full max-w-xs lg:w-80">
                <div className="h-52 w-full lg:h-72">
                  <CharacterPreview character={mainChar} vehicle={vehicle} theme={THEMES[theme]} mode={previewMode} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ["land", "▬", "modeLand"],
                      ["boat", "≈", "modeBoat"],
                      ["plane", "✈", "modePlane"],
                      ["sub", "◒", "modeSub"],
                    ] as [VehicleMode, string, string][]
                  ).map(([m, g, k]) => (
                    <button
                      key={m}
                      onClick={() => setPreviewMode(m)}
                      className={`rounded-xl px-1 py-1.5 text-[11px] font-bold transition ${
                        previewMode === m ? "glass-btn text-sky-900 scale-105" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                      }`}
                    >
                      <div className="text-base leading-none">{g}</div>
                      {t(k)}
                    </button>
                  ))}
                </div>
              </div>
              <Panel className="w-full max-w-md space-y-4 p-4">
                <div>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("shape")}</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {SHAPES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setVehicle({ shape: s.id as ShapeId })}
                        className={`rounded-2xl px-2 py-2 text-xs font-bold transition ${
                          vehicle.shape === s.id ? "glass-btn text-sky-900 scale-105" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                        }`}
                      >
                        <div className="text-lg">{SHAPE_GLYPH[s.id] ?? "⛟"}</div>
                        {t(`shape_${s.id}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("bodyColor")}</div>
                  <div className="flex flex-wrap gap-2">
                    {BODY_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setVehicle({ body: c })}
                        className={`h-9 w-9 rounded-full transition ${vehicle.body === c ? "scale-115 ring-4 ring-white" : "ring-2 ring-white/60 hover:scale-110"}`}
                        style={{ background: c, boxShadow: vehicle.body === c ? `0 0 16px ${c}` : undefined }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("decalColor")}</div>
                  <div className="flex flex-wrap gap-2">
                    {DECAL_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setVehicle({ decal: c })}
                        className={`h-9 w-9 rounded-full transition ${vehicle.decal === c ? "scale-115 ring-4 ring-white" : "ring-2 ring-white/60 hover:scale-110"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("wheelStyle")}</div>
                  <div className="flex flex-wrap gap-2">
                    {WHEEL_STYLES.map((wl) => (
                      <button
                        key={wl}
                        onClick={() => setVehicle({ wheel: wl as WheelStyle })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                          vehicle.wheel === wl ? "glass-btn text-sky-900" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                        }`}
                      >
                        {wl}
                        <span className="mt-0.5 block text-[9px] font-semibold normal-case opacity-70">
                          {partLabels(WHEEL_EFFECTS[wl as WheelStyle]).map(([k, v]) => `${t(k)} ${v}`).join(" · ") || "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("spoilerPart")}</div>
                    <div className="flex flex-wrap gap-2">
                      {SPOILERS.map((sp) => (
                        <button
                          key={sp}
                          onClick={() => setVehicle({ spoiler: sp as SpoilerId })}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            vehicle.spoiler === sp ? "glass-btn text-sky-900" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                          }`}
                        >
                          {t(`sp_${sp}`)}
                        <span className="mt-0.5 block text-[9px] font-semibold normal-case opacity-70">
                          {partLabels(SPOILER_EFFECTS[sp as SpoilerId]).map(([k, v]) => `${t(k)} ${v}`).join(" · ") || "—"}
                        </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("boosterPart")}</div>
                    <div className="flex flex-wrap gap-2">
                      {BOOSTERS.map((bo) => (
                        <button
                          key={bo}
                          onClick={() => setVehicle({ booster: bo as BoosterId })}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            vehicle.booster === bo ? "glass-btn text-sky-900" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                          }`}
                        >
                          {t(`bo_${bo}`)}
                        <span className="mt-0.5 block text-[9px] font-semibold normal-case opacity-70">
                          {partLabels(BOOSTER_EFFECTS[bo as BoosterId]).map(([k, v]) => `${t(k)} ${v}`).join(" · ") || "—"}
                        </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* boats / planes / submarines */}
                {(
                  [
                    { label: "boatPart", list: BOATS as string[], prefix: "boat_", cur: vehicle.boat, set: (v: string) => { setVehicle({ boat: v as BoatId }); setPreviewMode("boat"); } },
                    { label: "planePart", list: PLANES as string[], prefix: "plane_", cur: vehicle.plane, set: (v: string) => { setVehicle({ plane: v as PlaneId }); setPreviewMode("plane"); } },
                    { label: "subPart", list: SUBS as string[], prefix: "sub_", cur: vehicle.sub, set: (v: string) => { setVehicle({ sub: v as SubId }); setPreviewMode("sub"); } },
                  ]
                ).map((row) => (
                  <div key={row.label}>
                    <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t(row.label)}</div>
                    <div className="flex flex-wrap gap-2">
                      {row.list.map((id) => (
                        <button
                          key={id}
                          onClick={() => row.set(id)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            row.cur === id ? "glass-btn text-sky-900" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                          }`}
                        >
                          {t(`${row.prefix}${id}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </Panel>
            </div>
          )}

          {/* ---------------- TRACKS ---------------- */}
          {tab === "track" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TRACKS.map((trk) => {
                const th = THEMES[theme];
                const sel = trackId === trk.id;
                return (
                  <button key={trk.id} onClick={() => setTrackId(trk.id)} className="transition hover:-translate-y-1">
                    <Panel className={`flex h-full flex-col items-center p-4 ${sel ? "ring-4 ring-white" : ""}`}>
                      <TrackPreview points={trk.points} color={th.barrierA} water={th.water} />
                      <div className="font-display mt-1 text-lg font-extrabold text-sky-900">{t(`trk_${trk.id}`)}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs font-bold text-sky-800/70">
                        {t("difficulty")}
                        <span className="text-amber-500">{"★".repeat(trk.difficulty)}{"☆".repeat(3 - trk.difficulty)}</span>
                      </div>
                      <div className="mt-2 flex gap-1.5 text-[10px] font-bold text-sky-700">
                        <span className="rounded-full bg-white/60 px-2 py-0.5">≈ {t("modeBoat")}</span>
                        <span className="rounded-full bg-white/60 px-2 py-0.5">✈ {t("modePlane")}</span>
                      </div>
                      {sel && <span className="mt-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-emerald-600 shadow">✓</span>}
                    </Panel>
                  </button>
                );
              })}
            </div>
          )}

          {/* ---------------- AESTHETICS ---------------- */}
          {tab === "aesthetic" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {THEME_LIST.map((id) => {
                const th = THEMES[id as ThemeId];
                const ink = th.dark ? "text-white" : "text-sky-950";
                const inkSub = th.dark ? "text-white/70" : "text-sky-900/70";
                return (
                  <button key={id} onClick={() => setTheme(id)} className={`group relative overflow-hidden rounded-3xl p-4 text-left transition hover:-translate-y-1 ${theme === id ? "ring-4 ring-white" : ""}`}>
                    <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${th.skyTop}, ${th.skyBottom} 55%, ${th.ground})` }} />
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-xl" style={{ background: th.glow, opacity: 0.8 }} />
                    <div className="relative">
                      <div className={`font-display text-xl font-extrabold drop-shadow-sm ${ink}`}>{th.name}</div>
                      <div className="mt-3 flex gap-1.5">
                        {[th.road, th.roadLine, th.barrierA, th.barrierB, th.glow, th.water].map((c, i) => (
                          <span key={i} className="h-5 w-5 rounded-full ring-2 ring-white/70" style={{ background: c }} />
                        ))}
                      </div>
                      <div className={`mt-2 text-[11px] font-semibold ${inkSub}`}>
                        {th.prop.toUpperCase()} · {t("bloomOn")} {Math.round(th.bloom * 100)}%
                      </div>
                    </div>
                    {theme === id && (
                      <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-emerald-600 shadow">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ---------------- MODE ---------------- */}
          {tab === "mode" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MODE_INFO.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id as any)} className={`text-left transition hover:-translate-y-1 ${modeId === m.id ? "" : ""}`}>
                  <Panel className={`h-full p-5 ${modeId === m.id ? "ring-4 ring-white" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-4xl font-extrabold" style={{ color: THEMES[theme].barrierA }}>
                        {m.glyph}
                      </span>
                      <span className="font-display text-xl font-extrabold text-sky-900">{t(m.titleKey)}</span>
                    </div>
                    <p className="mt-2 text-sm text-sky-800/80">{t(m.descKey)}</p>
                    <div className="mt-3 flex gap-2 text-[11px] font-bold text-sky-700">
                      <span className="rounded-full bg-white/60 px-2 py-0.5">{MODES[m.id].laps} {t("lap")}</span>
                      <span className="rounded-full bg-white/60 px-2 py-0.5">{MODES[m.id].aiCount} ✦</span>
                      <span className="rounded-full bg-white/60 px-2 py-0.5">{MODES[m.id].itemsEnabled ? t("weapons") : "—"}</span>
                    </div>
                  </Panel>
                </button>
              ))}
              <Panel className="p-4 sm:col-span-3">
                <div className="font-display mb-2 text-lg font-extrabold text-sky-900">{t("weapons")}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                  {WEAPONS.map((wid) => (
                    <div key={wid} className="glass-panel flex items-center gap-2 rounded-2xl p-2">
                      <span className="text-2xl" style={{ color: WEAPON_META[wid].color, textShadow: `0 0 12px ${WEAPON_META[wid].glow}` }}>
                        {WEAPON_META[wid].glyph}
                      </span>
                      <div>
                        <div className="text-xs font-extrabold text-sky-900">{t(`weapon_${wid}`)}</div>
                        <div className="text-[10px] leading-tight text-sky-800/70">{t(`wdesc_${wid}`)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold text-sky-800/70">{t("zoneInfo")}</p>
              </Panel>
            </div>
          )}

          {/* ---------------- SETTINGS ---------------- */}
          {tab === "settings" && (
            <Panel className="mx-auto w-full max-w-md space-y-3 p-5">
              {(
                [
                  { key: "autoGas" as const, label: t("autoGas") },
                  { key: "steerAssist" as const, label: t("steerAssist") },
                  { key: "bloom" as const, label: t("bloomOn") },
                ]
              ).map((row) => (
                <button key={row.key} onClick={() => setSettings({ [row.key]: !settings[row.key] })} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/30 px-4 py-3 text-left transition hover:bg-white/45">
                  <span className="font-semibold text-sky-900">{row.label}</span>
                  <span className={`relative h-7 w-12 rounded-full transition ${settings[row.key] ? "bg-emerald-400" : "bg-sky-900/20"}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${settings[row.key] ? "left-6" : "left-1"}`} />
                  </span>
                </button>
              ))}
              <div>
                <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("controlPreset")}</div>
                <div className="flex flex-col gap-2">
                  {(["A", "B"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setSettings({ controlPreset: p })}
                      className={`rounded-2xl px-4 py-2.5 text-left text-sm font-bold transition ${
                        settings.controlPreset === p ? "glass-btn text-sky-900" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                      }`}
                    >
                      {t(p === "A" ? "presetA" : "presetB")}
                    </button>
                  ))}
                                <div className="col-span-full">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t("finish")}</div>
                  <div className="flex flex-wrap gap-2">
                    {FINISHES.map((fin: any) => (
                      <button
                        key={fin}
                        onClick={() => setVehicle({ finish: fin })}
                        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          vehicle.finish === fin ? "glass-btn text-sky-900" : "bg-white/25 text-sky-800/70 hover:bg-white/45"
                        }`}
                      >
                        <span className="h-4 w-4 rounded-full border-2 border-white/70" style={{ background: FINISH_META[fin as FinishId].swatch }} />
                        {t(FINISH_META[fin as FinishId].labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
</div>
              </div>
            </Panel>
          )}
        </div>

        <div className="mt-2 flex items-center justify-center gap-3">
          <div className="hidden items-center gap-1 sm:flex">
            <Portrait char={mainChar} size={40} />
            <span className="font-display text-lg font-extrabold text-sky-900">+</span>
            <Portrait char={partnerChar} size={40} />
          </div>
          <PrimaryButton big onClick={handleStart}>
            ▶ {t("start")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
