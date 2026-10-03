import { useEffect, useState } from "react";
import { useGame, ACTIONS, TOUCH_SLOTS, DEFAULT_KEYBINDS, DEFAULT_TOUCH, type Action, type TouchSlot } from "../store";
import { AI_PROFILES, AI_SKILL_LIST, type AiSkillId } from "../data";
import { LANGS, useI18n } from "../i18n";
import { Bubbles, GlassButton } from "../ui/common";

const KEY_LABEL: Record<string, string> = {
  Space: "Espacio",
  ShiftLeft: "Shift izq",
  ShiftRight: "Shift der",
  ControlLeft: "Ctrl izq",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Tab: "Tab",
};

const ACTION_LABEL: Record<Action, string> = {
  item: "Objeto",
  drift: "Derrape",
  swap: "Cambiar",
  fuse: "Fusión",
  turbo: "Turbo",
  left: "Izquierda",
  right: "Derecha",
  gas: "Acelerar",
  brake: "Frenar",
};

const SLOT_LABEL: Record<TouchSlot, string> = {
  padL: "Palanca izq",
  padR: "Palanca der",
  drift: "Botón derrape",
  turbo: "Botón turbo",
  gas: "Pedal acelerador",
  brake: "Pedal freno",
  swap: "Botón cambio",
  fuse: "Botón fusión",
  item: "Botón objeto",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-3">
      <span className="text-sm font-bold text-sky-900">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition ${on ? "bg-emerald-500 text-white" : "bg-white/70 text-sky-800"}`}
    >
      {on ? "ON" : "OFF"}
    </button>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      className="w-40 accent-sky-500"
    />
  );
}

export default function OptionsScreen() {
  const { t } = useI18n();
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const goto = useGame((s) => s.goto);
  const muted = useGame((s) => s.muted);
  const toggleMuted = useGame((s) => s.toggleMuted);
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const [tab, setTab] = useState<"game" | "controls" | "touch">("game");
  const [grabbing, setGrabbing] = useState<Action | null>(null);
  const [slotFor, setSlotFor] = useState<TouchSlot | null>(null);

  // keyboard capture: click a bind, hit a key, done
  useEffect(() => {
    if (!grabbing) return;
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === "Escape") {
        setGrabbing(null);
        return;
      }
      setSettings({ keybinds: { ...settings.keybinds, [grabbing]: [e.code] } });
      setGrabbing(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [grabbing, settings.keybinds, setSettings]);

  return (
    <div className="relative min-h-screen overflow-y-auto px-4 py-8 text-sky-900">
      <Bubbles count={10} />
      <div className="relative mx-auto max-w-3xl">
        <div className="glass-panel mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
          <h1 className="font-display text-3xl font-extrabold">Opciones</h1>
          <div className="flex flex-wrap gap-2">
            {(["game", "controls", "touch"] as const).map((k) => (
              <GlassButton key={k} onClick={() => setTab(k)} className={tab === k ? "ring-4 ring-white/70" : ""}>
                {k === "game" ? "Juego" : k === "controls" ? "Controles" : "Táctil"}
              </GlassButton>
            ))}
            <GlassButton onClick={() => goto("start")}>Volver</GlassButton>
          </div>
        </div>

        <div className="glass-panel space-y-3 rounded-3xl p-5">
          {tab === "game" && (
            <>
              <Row label={`Dificultad IA · ${AI_PROFILES[settings.aiSkill ?? "pro"].name}`}>
                {AI_SKILL_LIST.map((id: AiSkillId) => (
                  <button
                    key={id}
                    onClick={() => setSettings({ aiSkill: id })}
                    className={`rounded-xl px-3 py-2 text-xs font-bold shadow-sm ${settings.aiSkill === id ? "bg-sky-600 text-white" : "bg-white/70"}`}
                  >
                    {AI_PROFILES[id].name}
                  </button>
                ))}
              </Row>
              <p className="px-1 text-xs text-sky-900/70">
                {t("aiHelp")}{" "}
                {AI_PROFILES[settings.aiSkill ?? "pro"].name}: ritmo {Math.round(AI_PROFILES[settings.aiSkill ?? "pro"].pace * 100)}% · error {Math.round(
                  AI_PROFILES[settings.aiSkill ?? "pro"].mistake * 100
                )}%/s · atajos {Math.round(AI_PROFILES[settings.aiSkill ?? "pro"].gateUse * 100)}%/s
              </p>
              <Row label="Gas automático">
                <Toggle on={settings.autoGas} onClick={() => setSettings({ autoGas: !settings.autoGas })} />
              </Row>
              <Row label="Asistencia de dirección">
                <Toggle on={settings.steerAssist} onClick={() => setSettings({ steerAssist: !settings.steerAssist })} />
              </Row>
              <Row label="Invertir dirección">
                <Toggle on={settings.invertSteer} onClick={() => setSettings({ invertSteer: !settings.invertSteer })} />
              </Row>
              <Row label={`Sacudida de cámara · ${Math.round(settings.shake * 100)}%`}>
                <Slider value={settings.shake} onChange={(v) => setSettings({ shake: v })} />
              </Row>
              <Row label={`Vibración de velocidad · ${Math.round(settings.motionBlur * 100)}%`}>
                <Slider value={settings.motionBlur} onChange={(v) => setSettings({ motionBlur: v })} />
              </Row>
              <Row label={`Volumen · ${Math.round(settings.volume * 100)}%`}>
                <Slider value={settings.volume} onChange={(v) => setSettings({ volume: v })} />
                <Toggle on={!muted} onClick={toggleMuted} />
              </Row>
              <Row label="Bloom">
                <Toggle on={settings.bloom} onClick={() => setSettings({ bloom: !settings.bloom })} />
              </Row>
              <Row label="Telemetría">
                <Toggle on={settings.telemetry} onClick={() => setSettings({ telemetry: !settings.telemetry })} />
              </Row>
              <Row label="Idioma">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold shadow-sm ${lang === l.code ? "bg-sky-600 text-white" : "bg-white/70"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </Row>
              <Row label="Restablecer">
                <GlassButton
                  onClick={() =>
                    setSettings({
                      keybinds: DEFAULT_KEYBINDS,
                      touchLayout: DEFAULT_TOUCH,
                      touchScale: 1,
                      handed: "right",
                      aiSkill: "pro",
                      invertSteer: false,
                      shake: 1,
                      motionBlur: 0,
                      volume: 0.8,
                      autoGas: false,
                      steerAssist: true,
                      bloom: true,
                      telemetry: false,
                    })
                  }
                >
                  Volver a valores por defecto
                </GlassButton>
              </Row>
            </>
          )}

          {tab === "controls" && (
            <>
              <p className="px-1 text-xs text-sky-900/70">Pulsa una tecla y luego la que quieras asignar. Escape cancela.</p>
              {ACTIONS.map((a) => (
                <Row key={a} label={ACTION_LABEL[a]}>
                  <button
                    onClick={() => setGrabbing(a)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${grabbing === a ? "animate-pulse bg-amber-400 text-sky-900" : "bg-white/70"}`}
                  >
                    {grabbing === a ? "Pulsa una tecla…" : (settings.keybinds[a] ?? []).map((k) => KEY_LABEL[k] ?? k).join(" / ") || "—"}
                  </button>
                </Row>
              ))}
              <Row label="Preset">
                {(["A", "B"] as const).map((p) => (
                  <GlassButton key={p} onClick={() => setSettings({ controlPreset: p })} className={settings.controlPreset === p ? "ring-4 ring-white/70" : ""}>
                    {p}
                  </GlassButton>
                ))}
              </Row>
            </>
          )}

          {tab === "touch" && (
            <>
              <p className="px-1 text-xs text-sky-900/70">Cada hueco de la pantalla puede hacer lo que quieras.</p>
              {TOUCH_SLOTS.map((slot) => (
                <Row key={slot} label={SLOT_LABEL[slot]}>
                  {slotFor === slot ? (
                    <div className="flex flex-wrap gap-1">
                      {ACTIONS.map((a) => (
                        <button
                          key={a}
                          onClick={() => {
                            setSettings({ touchLayout: { ...settings.touchLayout, [slot]: a } });
                            setSlotFor(null);
                          }}
                          className="rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-bold text-white"
                        >
                          {ACTION_LABEL[a]}
                        </button>
                      ))}
                      <button onClick={() => setSlotFor(null)} className="rounded-lg bg-white/70 px-2 py-1 text-[11px] font-bold">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSlotFor(slot)}
                      className="rounded-xl bg-white/70 px-4 py-2 text-sm font-bold shadow-sm"
                    >
                      {ACTION_LABEL[settings.touchLayout[slot] ?? "item"]}
                    </button>
                  )}
                </Row>
              ))}
              <Row label={`Tamaño botones · ${Math.round(settings.touchScale * 100)}%`}>
                <Slider value={settings.touchScale} onChange={(v) => setSettings({ touchScale: v })} />
              </Row>
              <Row label="Mano">
                {(["right", "left"] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setSettings({ handed: h })}
                    className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${settings.handed === h ? "bg-sky-600 text-white" : "bg-white/70"}`}
                  >
                    {h === "right" ? "Diestro" : "Zurdo"}
                  </button>
                ))}
              </Row>
              <Row label="Restablecer táctil">
                <GlassButton onClick={() => setSettings({ touchLayout: DEFAULT_TOUCH, touchScale: 1, handed: "right" })}>
                  Por defecto
                </GlassButton>
              </Row>
            </>
          )}
        </div>
      </div>
    </div>
  );
}