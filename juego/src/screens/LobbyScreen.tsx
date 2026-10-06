import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { useGame } from "../store";
import { AI_SKILL_LIST, CHARACTERS, MODES, TRACKS, type ModeId } from "../data";
import { announce, connect, defaultAddress, disconnect, setConfig, startRace, useNet } from "../net";
import Portrait from "../ui/Portrait";
import { Bubbles, GlassButton, Panel, PrimaryButton } from "../ui/common";

const NET_MODES: ModeId[] = ["quick", "sprint", "chaos", "endurance", "battle"];
const MODE_TITLE: Record<string, string> = { quick: "quickRace", sprint: "sprintMode", chaos: "chaosMode", endurance: "enduranceMode", battle: "battleMode" };

const chip = (on: boolean, locked = false) =>
  `rounded-xl px-3 py-1.5 text-xs font-bold transition ${on ? "glass-btn text-sky-900" : "bg-white/25 text-sky-800/70"} ${locked ? "cursor-default" : on ? "" : "hover:bg-white/45"}`;

/** The room where players meet before a race over the network: who is in, what each drives, and what the host has set. */
export default function LobbyScreen() {
  const { t } = useI18n();
  const goto = useGame((s) => s.goto);
  const characterId = useGame((s) => s.characterId);
  const partnerId = useGame((s) => s.partnerId);
  const setCharacter = useGame((s) => s.setCharacter);
  const setPartner = useGame((s) => s.setPartner);
  const net = useNet();
  const [address, setAddress] = useState(defaultAddress());
  const [picking, setPicking] = useState<"char" | "partner">("char");
  const host = net.status === "on" && net.id === net.hostId;
  const cfg = net.cfg;
  const maxBots = Math.max(0, 8 - net.players.length);

  // straight in when the page came from the game's own server
  useEffect(() => {
    if (net.status === "off" && !net.error && defaultAddress()) connect(defaultAddress());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (net.status === "on") announce();
  }, [net.status]);
  // the host never offers more bots than there is room for
  useEffect(() => {
    if (host && cfg.bots > maxBots) setConfig({ bots: maxBots });
  }, [host, cfg.bots, maxBots]);

  const leave = () => {
    disconnect();
    goto("start");
  };
  const stepper = (value: number, min: number, max: number, set: (v: number) => void) => (
    <div className="flex items-center gap-2">
      {host && <button className={chip(false)} onClick={() => set(Math.max(min, value - 1))}>−</button>}
      <span className="font-display w-6 text-center text-xl font-extrabold text-sky-900">{value}</span>
      {host && <button className={chip(false)} onClick={() => set(Math.min(max, value + 1))}>+</button>}
    </div>
  );
  const label = (key: string) => <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-sky-900/70">{t(key)}</div>;

  return (
    <div className="aero-gradient relative h-full w-full overflow-y-auto">
      <Bubbles count={10} />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <GlassButton onClick={leave}>← {t("back")}</GlassButton>
          <h1 className="font-display text-3xl font-extrabold text-sky-900 sm:text-4xl">{t("multiplayer")}</h1>
          <span className="w-20" />
        </div>

        {net.status !== "on" ? (
          <Panel className="mx-auto w-full max-w-xl space-y-3 p-5">
            <p className="text-sm font-semibold text-sky-900/80">{t("netHowTo")}</p>
            <code className="block rounded-xl bg-sky-950/80 px-3 py-2 text-xs text-emerald-200">npm run red</code>
            <div>
              {label("yourName")}
              <input
                value={net.name}
                maxLength={14}
                onChange={(e) => net.setName(e.target.value)}
                className="w-full rounded-xl border-2 border-white/80 bg-white/70 px-3 py-2 font-bold text-sky-900 outline-none"
              />
            </div>
            <div>
              {label("serverAddress")}
              <input
                value={address}
                placeholder="192.168.1.20:8765"
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && connect(address)}
                className="w-full rounded-xl border-2 border-white/80 bg-white/70 px-3 py-2 font-mono font-bold text-sky-900 outline-none"
              />
            </div>
            {net.error && <div className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{t(`netErr_${net.error}`)}</div>}
            <PrimaryButton onClick={() => connect(address)}>{net.status === "connecting" ? t("connecting") : t("connect")}</PrimaryButton>
          </Panel>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {/* ---------------- who is here, and what I drive ---------------- */}
            <div className="flex flex-col gap-3">
              <Panel className="p-4">
                {label("players")}
                <div className="grid grid-cols-2 gap-2">
                  {net.players.map((p) => {
                    const c = CHARACTERS.find((x) => x.id === p.char) ?? CHARACTERS[0];
                    const c2 = CHARACTERS.find((x) => x.id === p.partner);
                    return (
                      <div key={p.id} className={`flex items-center gap-2 rounded-2xl p-2 ${p.id === net.id ? "bg-white/70 ring-2 ring-white" : "bg-white/35"}`}>
                        <Portrait char={c} size={40} />
                        {c2 && <Portrait char={c2} size={26} />}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-sky-900">{p.name}</div>
                          <div className="text-[10px] font-bold uppercase text-sky-800/60">
                            {p.id === net.hostId ? t("hostBadge") : ""} {p.id === net.id ? t("you") : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  {label("yourName")}
                  <input
                    value={net.name}
                    maxLength={14}
                    onChange={(e) => net.setName(e.target.value)}
                    className="w-full rounded-xl border-2 border-white/80 bg-white/70 px-3 py-1.5 text-sm font-bold text-sky-900 outline-none"
                  />
                </div>
              </Panel>
              <Panel className="p-4">
                <div className="mb-2 flex gap-1.5">
                  <button className={chip(picking === "char")} onClick={() => setPicking("char")}>{t("selectRacer")}</button>
                  <button className={chip(picking === "partner")} onClick={() => setPicking("partner")}>{t("selectPartner")}</button>
                  <button className={chip(false)} onClick={() => goto("select")}>⚙ {t("customize")}</button>
                </div>
                <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
                  {CHARACTERS.map((c) => {
                    const on = (picking === "char" ? characterId : partnerId) === c.id;
                    const other = (picking === "char" ? partnerId : characterId) === c.id;
                    return (
                      <button
                        key={c.id}
                        disabled={other}
                        onClick={() => (picking === "char" ? setCharacter(c.id) : setPartner(c.id))}
                        className={`rounded-xl p-0.5 transition ${on ? "bg-white ring-2 ring-sky-400" : other ? "opacity-30" : "bg-white/25 hover:bg-white/50"}`}
                      >
                        <Portrait char={c} size={38} />
                        <div className="text-center text-[8px] font-extrabold text-sky-900">{c.name}</div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            </div>

            {/* ---------------- what the host has set ---------------- */}
            <Panel className="flex flex-col gap-3 p-4">
              <div>
                {label("selectMode")}
                <div className="flex flex-wrap gap-1.5">
                  {NET_MODES.map((m) => (
                    <button
                      key={m}
                      disabled={!host}
                      className={chip(cfg.modeId === m, !host)}
                      onClick={() => setConfig(m === "battle" ? { modeId: m, trackId: "arena" } : { modeId: m })}
                    >
                      {t(MODE_TITLE[m])}
                    </button>
                  ))}
                </div>
                {cfg.modeId !== "battle" && <div className="mt-1 text-[11px] font-bold text-sky-800/70">{MODES[cfg.modeId].laps} {t("lap")}</div>}
              </div>
              <div>
                {label("trackTab")}
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
                  {TRACKS.map((trk) => (
                    <button key={trk.id} disabled={!host} className={`${chip(cfg.trackId === trk.id, !host)} truncate text-left`} onClick={() => setConfig({ trackId: trk.id })}>
                      {t(`trk_${trk.id}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <div>
                  {label("bots")}
                  {stepper(Math.min(cfg.bots, maxBots), 0, maxBots, (v) => setConfig({ bots: v }))}
                </div>
                <div>
                  {label("botSkill")}
                  <div className="flex gap-1.5">
                    {AI_SKILL_LIST.map((id) => (
                      <button key={id} disabled={!host} className={chip(cfg.aiSkill === id, !host)} onClick={() => setConfig({ aiSkill: id })}>
                        {t(`skill_${id}`)}
                      </button>
                    ))}
                  </div>
                </div>
                {cfg.modeId === "battle" && (
                  <>
                    <div>
                      {label("lives")}
                      {stepper(cfg.lives, 1, 8, (v) => setConfig({ lives: v }))}
                    </div>
                    <div>
                      {label("sides")}
                      <div className="flex gap-1.5">
                        <button disabled={!host} className={chip(!cfg.teams, !host)} onClick={() => setConfig({ teams: false })}>{t("freeForAll")}</button>
                        <button disabled={!host} className={chip(cfg.teams, !host)} onClick={() => setConfig({ teams: true })}>{t("twoTeams")}</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                <span className="text-xs font-bold text-sky-800/70">
                  {net.players.length + Math.min(cfg.bots, maxBots)} / 8
                </span>
                {host ? (
                  <PrimaryButton big onClick={startRace}>▶ {t("startMatch")}</PrimaryButton>
                ) : (
                  <span className="rounded-full bg-white/60 px-4 py-2 text-sm font-extrabold text-sky-900">{t("waitingHost")}</span>
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
