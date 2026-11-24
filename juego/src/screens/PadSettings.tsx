import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";
import { DEFAULT_PAD_BINDS, PAD_ACTIONS, PAD_BUTTON_NAMES, PadReader, rumble, setRumbleLevel, type PadAction, type PadSnapshot } from "../gamepad";
import { GlassButton } from "../ui/common";

const PAD_LABEL: Record<PadAction, string> = {
  item: "Objeto",
  drift: "Derrape",
  turbo: "Turbo",
  ability: "Habilidad",
  swap: "Cambiar",
  fuse: "Fusión",
  lookBack: "Mirar atrás",
  pause: "Pausa",
};

const buttonName = (i: number) => PAD_BUTTON_NAMES[i] ?? `B${i}`;

/**
 * The game pad page of the options: which button does what (press the action,
 * then the button), how much of the stick is ignored in the middle, how the
 * steering grows with the stick, how hard the pad shakes, and a live view of
 * what the pad is sending so a player can see their settings work.
 */
export default function PadSettings({ Row, Slider }: { Row: (p: { label: string; children: React.ReactNode }) => React.ReactElement; Slider: (p: { value: number; onChange: (v: number) => void }) => React.ReactElement }) {
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const [snap, setSnap] = useState<PadSnapshot | null>(null);
  const [grabbing, setGrabbing] = useState<PadAction | null>(null);
  const reader = useRef(new PadReader());
  const held = useRef<number[]>([]);

  // read the pad on every frame while this page is open
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = useGame.getState().settings;
      reader.current.config = { binds: { ...DEFAULT_PAD_BINDS, ...s.padBinds }, deadzone: s.padDeadzone, curve: s.steerCurve };
      try {
        if (typeof navigator.getGamepads === "function") reader.current.read(navigator.getGamepads());
      } catch {
        /* no pads */
      }
      setSnap(reader.current.snapshot ? { ...reader.current.snapshot } : null);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // capture: the first button that goes down after choosing an action is its new button
  useEffect(() => {
    if (!grabbing || !snap) {
      held.current = snap?.buttons.map((v) => (v > 0.5 ? 1 : 0)) ?? [];
      return;
    }
    const now = snap.buttons.map((v) => (v > 0.5 ? 1 : 0));
    const pressed = now.findIndex((v, i) => v && !held.current[i] && i !== 6 && i !== 7 && (i < 12 || i > 15));
    held.current = now;
    if (pressed >= 0) {
      setSettings({ padBinds: { ...settings.padBinds, [grabbing]: pressed } });
      setGrabbing(null);
    }
  }, [snap, grabbing, settings.padBinds, setSettings]);

  const steerBar = (v: number) => (
    <div className="relative h-3 w-40 overflow-hidden rounded-full bg-white/70">
      <div className="absolute inset-y-0 left-1/2 w-px bg-sky-900/40" />
      <div className="absolute inset-y-0 bg-sky-500" style={{ left: `${50 + Math.min(0, v) * 50}%`, width: `${Math.abs(v) * 50}%` }} />
    </div>
  );

  // the steering curve, drawn: stick travel across, steering up
  const curve = Array.from({ length: 21 }, (_, i) => {
    const x = i / 20;
    const d = Math.max(0, (x - settings.padDeadzone) / (1 - settings.padDeadzone));
    return `${4 + x * 92},${96 - Math.pow(d, settings.steerCurve) * 92}`;
  }).join(" ");

  return (
    <>
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ${snap ? "bg-emerald-100/80" : "bg-white/55"}`}>
        <span className={`h-3 w-3 rounded-full ${snap ? "bg-emerald-500" : "bg-slate-400"}`} />
        <span className="text-sm font-bold text-sky-900">{snap ? snap.id.slice(0, 60) : "No hay mando. Conéctalo y pulsa cualquier botón."}</span>
      </div>
      {snap && (
        <div className="grid gap-3 rounded-2xl bg-white/55 px-4 py-3 sm:grid-cols-2">
          <div className="space-y-2 text-xs font-bold text-sky-900">
            <div className="flex items-center justify-between gap-2">Palanca {steerBar(snap.axes[0] ?? 0)}</div>
            <div className="flex items-center justify-between gap-2">Dirección {steerBar(snap.steer)}</div>
            <div className="flex items-center justify-between gap-2">Acelerador {steerBar(snap.throttle)}</div>
          </div>
          <div className="flex flex-wrap content-start gap-1">
            {snap.buttons.slice(0, 17).map((v, i) => (
              <span key={i} className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${v > 0.5 ? "bg-sky-600 text-white" : "bg-white/80 text-sky-800"}`}>
                {buttonName(i)}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="px-1 text-xs text-sky-900/70">Pulsa una acción y luego el botón del mando. Los gatillos (acelerar y frenar) y la cruceta quedan fijos.</p>
      {PAD_ACTIONS.map((a) => (
        <Row key={a} label={PAD_LABEL[a]}>
          <button
            onClick={() => setGrabbing(grabbing === a ? null : a)}
            className={`min-w-24 rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${grabbing === a ? "animate-pulse bg-amber-400 text-sky-900" : "bg-white/70"}`}
          >
            {grabbing === a ? (snap ? "Pulsa un botón…" : "Conecta un mando") : buttonName(settings.padBinds[a])}
          </button>
        </Row>
      ))}
      <Row label={`Zona muerta · ${Math.round(settings.padDeadzone * 100)}%`}>
        <Slider value={(settings.padDeadzone - 0.05) / 0.35} onChange={(v) => setSettings({ padDeadzone: 0.05 + v * 0.35 })} />
      </Row>
      <Row label={`Curva de dirección · ${settings.steerCurve.toFixed(1)}`}>
        <svg viewBox="0 0 100 100" className="h-12 w-12 rounded-lg bg-white/70">
          <polyline points={curve} fill="none" stroke="#0284c7" strokeWidth="5" strokeLinejoin="round" />
        </svg>
        <Slider value={(settings.steerCurve - 1) / 1.5} onChange={(v) => setSettings({ steerCurve: 1 + v * 1.5 })} />
      </Row>
      <Row label={`Vibración · ${Math.round(settings.vibration * 100)}%`}>
        <Slider value={settings.vibration} onChange={(v) => setSettings({ vibration: v })} />
        <GlassButton
          onClick={() => {
            setRumbleLevel(settings.vibration);
            rumble(0.8, 300);
          }}
        >
          Probar
        </GlassButton>
      </Row>
      <Row label="Restablecer mando">
        <GlassButton onClick={() => setSettings({ padBinds: DEFAULT_PAD_BINDS, padDeadzone: 0.18, steerCurve: 1, vibration: 0.7 })}>Por defecto</GlassButton>
      </Row>
    </>
  );
}
