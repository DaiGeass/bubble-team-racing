import type { ReactNode } from "react";
import { LANGS, useI18n } from "../i18n";
import { useGame } from "../store";
import { resumeAudio, sfx } from "../sound";

export function Bubbles({ count = 14 }: { count?: number }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((i) => {
        const size = 14 + Math.random() * 46;
        const left = Math.random() * 100;
        const duration = 10 + Math.random() * 14;
        const delay = Math.random() * 12;
        return (
          <span
            key={i}
            className="bubble"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function GlassButton({
  children,
  onClick,
  className = "",
  disabled,
  big,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <button
      onClick={() => {
        resumeAudio();
        sfx.click();
        onClick?.();
      }}
      disabled={disabled}
      className={`glass-btn rounded-2xl font-semibold text-sky-900 disabled:opacity-40 ${
        big ? "px-10 py-4 text-xl" : "px-5 py-2.5 text-sm"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  className = "",
  big,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  big?: boolean;
}) {
  return (
    <button
      onClick={() => {
        resumeAudio();
        sfx.click();
        onClick?.();
      }}
      className={`rounded-2xl font-bold text-white shadow-lg transition active:translate-y-0.5 active:scale-[0.98] ${
        big ? "px-12 py-5 text-2xl" : "px-6 py-3 text-base"
      } ${className}`}
      style={{
        background: "linear-gradient(180deg, #ff9f6e 0%, #ff6b6b 55%, #ff4d6d 100%)",
        boxShadow: "0 10px 24px rgba(255, 90, 90, 0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-panel rounded-3xl ${className}`}>{children}</div>;
}

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const storeLang = useGame((s) => s.setLang);
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "max-w-[220px]" : "max-w-md"} justify-center`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => {
            setLang(l.code);
            storeLang(l.code);
          }}
          title={l.label}
          className={`rounded-xl px-2 py-1 text-lg transition ${
            lang === l.code ? "glass-btn scale-110" : "opacity-60 hover:opacity-100"
          }`}
        >
          {l.flag}
        </button>
      ))}
    </div>
  );
}

export function StatBar({ value, max = 5, color = "#0ea5e9" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="h-2.5 w-4 rounded-full"
          style={{ background: i < value ? color : "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.8)" }}
        />
      ))}
    </div>
  );
}
