import { useState } from "react";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import { checkMod, EXAMPLE_MOD, loadInstalled, modReport, saveInstalled, type InstalledMod, type ModFile } from "../mods";
import { Bubbles, GlassButton, Panel, PrimaryButton } from "../ui/common";

/** Install, switch on and off, and remove mods. Changes take effect when the game starts again. */
export default function ModsScreen() {
  const { t } = useI18n();
  const goto = useGame((s) => s.goto);
  const [list, setList] = useState<InstalledMod[]>(loadInstalled());
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  const update = (next: InstalledMod[]) => {
    setList(next);
    saveInstalled(next);
    setDirty(true);
  };

  async function add(file: File | undefined) {
    if (!file) return;
    setError("");
    let mod: ModFile;
    try {
      mod = JSON.parse(await file.text());
    } catch {
      setError(t("modNotJson"));
      return;
    }
    const bad = checkMod(mod);
    if (bad) {
      setError(`${t("modInvalid")}: ${bad}`);
      return;
    }
    update([...list.filter((m) => m.mod.id !== mod.id), { mod, enabled: true }]);
  }

  function download() {
    const blob = new Blob([JSON.stringify(EXAMPLE_MOD, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mod-ejemplo.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="aero-gradient relative h-full w-full overflow-y-auto">
      <Bubbles count={8} />
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <GlassButton onClick={() => goto("start")}>← {t("back")}</GlassButton>
          <h1 className="font-display text-3xl font-extrabold text-sky-900 sm:text-4xl">✚ {t("mods")}</h1>
          <span className="w-20" />
        </div>
        <Panel className="space-y-3 p-5">
          <p className="text-sm font-semibold text-sky-900/80">{t("modsHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <label className="glass-btn inline-flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 font-extrabold text-sky-900">
              ✚ {t("modAdd")}
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => add(e.target.files?.[0])} />
            </label>
            <GlassButton onClick={download}>⬇ {t("modExample")}</GlassButton>
          </div>
          {error && <div className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{error}</div>}
        </Panel>
        {list.length === 0 ? (
          <Panel className="p-5 text-center text-sm font-bold text-sky-800/70">{t("modNone")}</Panel>
        ) : (
          list.map((m, i) => {
            const report = modReport[m.mod.id];
            return (
              <Panel key={m.mod.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-extrabold text-sky-900">{m.mod.name}</div>
                  <div className="text-xs font-semibold text-sky-800/70">
                    {m.mod.author ? `${m.mod.author} · ` : ""}
                    {(m.mod.tracks ?? []).length} {t("modTracks")} · {(m.mod.characters ?? []).length} {t("modCharacters")} · {(m.mod.themes ?? []).length} {t("modThemes")}
                  </div>
                  {m.mod.description && <div className="mt-1 text-xs text-sky-900/80">{m.mod.description}</div>}
                  {report?.errors.length ? (
                    <ul className="mt-2 list-inside list-disc rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {report.errors.slice(0, 6).map((e, k) => (
                        <li key={k}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button
                  onClick={() => update(list.map((x, k) => (k === i ? { ...x, enabled: !x.enabled } : x)))}
                  className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${m.enabled ? "bg-emerald-500 text-white" : "bg-white/70 text-sky-800"}`}
                >
                  {m.enabled ? "ON" : "OFF"}
                </button>
                <GlassButton onClick={() => update(list.filter((_, k) => k !== i))}>✕ {t("modRemove")}</GlassButton>
              </Panel>
            );
          })
        )}
        {dirty && (
          <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="text-sm font-bold text-sky-900">{t("modRestart")}</span>
            <PrimaryButton onClick={() => window.location.reload()}>↻ {t("modApply")}</PrimaryButton>
          </Panel>
        )}
      </div>
    </div>
  );
}
