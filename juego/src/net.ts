import { create } from "zustand";
import { BODY_COLORS, BOATS, CHARACTERS, HOVERS, MODES, PLANES, SHAPES, SUBS, type AiSkillId, type ModeId } from "./data";
import { useGame, type VehiclePrefs } from "./store";
import { setActiveTrack } from "./trackCurve";
import { rhythmState, useSong, RHYTHM_TRACK_ID, type SongFeatures } from "./rhythm";
import { setSong } from "./music";
import { audioContext } from "./sound";
import type { ThemeId } from "./data";

// ---------------------------------------------------------------------------
// Playing over a network. The server (servidor/servidor.mjs) only passes
// messages on; the game is run by the players. Each one drives its own kart
// on its own machine and tells the others where it is fifteen times a second.
// The host, the first one in, also drives the bots. When something of yours
// hits somebody else's kart, you tell them, and they take the hit.
// ---------------------------------------------------------------------------

export interface NetPlayer {
  id: number;
  name: string;
  char: string;
  partner: string;
  vehicle: VehiclePrefs;
}

/** What the host has chosen for the next race. */
export interface NetConfig {
  trackId: string;
  modeId: ModeId;
  bots: number;
  aiSkill: AiSkillId;
  lives: number;
  teams: boolean;
}

/** One kart of the race about to start: a player's or a bot's. */
export interface RosterEntry {
  /** the kart's name on the wire, the same on every machine */
  key: string;
  /** the player whose machine runs it; a bot belongs to the host */
  owner: number;
  bot: boolean;
  name: string;
  char: string;
  partner: string | null;
  vehicle: VehiclePrefs;
  team: number;
}

export interface NetSession {
  cfg: NetConfig;
  roster: RosterEntry[];
  /** counts the races of this room, so every start is a fresh one */
  run: number;
  /** on a song's circuit: what the song sounds like, so every machine builds the same road */
  song?: { features: SongFeatures; theme: ThemeId };
}

interface NetState {
  status: "off" | "connecting" | "on";
  error: string;
  id: number;
  hostId: number;
  name: string;
  players: NetPlayer[];
  cfg: NetConfig;
  session: NetSession | null;
  setName: (n: string) => void;
}

const savedName = (() => {
  try {
    return localStorage.getItem("tsc_netname") ?? "";
  } catch {
    return "";
  }
})();

export const useNet = create<NetState>((set) => ({
  status: "off",
  error: "",
  id: 0,
  hostId: 0,
  name: savedName,
  players: [],
  cfg: { trackId: "bahia", modeId: "quick", bots: 2, aiSkill: "amateur", lives: 3, teams: false },
  session: null,
  setName: (n) => {
    try {
      localStorage.setItem("tsc_netname", n);
    } catch {
      /* ignore */
    }
    set({ name: n });
    announce();
  },
}));

type Msg = { t: string; from?: number; [k: string]: unknown };
type Handler = (m: Msg) => void;

let ws: WebSocket | null = null;
/** what the race in progress wants to hear about; the lobby messages are handled here */
const raceHandlers = new Set<Handler>();

export const isHost = () => useNet.getState().status === "on" && useNet.getState().id === useNet.getState().hostId;
export const inRoom = () => useNet.getState().status === "on";

export function netSend(m: Msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
}

/** Listen to the messages of a race; returns how to stop listening. */
export function onRace(fn: Handler) {
  raceHandlers.add(fn);
  return () => {
    raceHandlers.delete(fn);
  };
}

function me(): NetPlayer {
  const g = useGame.getState();
  const n = useNet.getState();
  return { id: n.id, name: (n.name || `P${n.id}`).slice(0, 14), char: g.characterId, partner: g.partnerId, vehicle: g.vehicle };
}

/** Tell the room who I am and what I am driving. Called whenever any of it changes. */
export function announce() {
  const n = useNet.getState();
  if (n.status !== "on") return;
  const p = me();
  useNet.setState({ players: [...n.players.filter((x) => x.id !== p.id), p].sort((a, b) => a.id - b.id) });
  netSend({ t: "me", p });
}

/** The host changes what the next race will be. */
export function setConfig(patch: Partial<NetConfig>) {
  // before joining a room the choice is kept, and used if this machine ends up the host
  if (inRoom() && !isHost()) return;
  const cfg = { ...useNet.getState().cfg, ...patch };
  useNet.setState({ cfg });
  netSend({ t: "cfg", cfg });
}

/** The address to try by default: the server that served this page, if one did. */
export function defaultAddress() {
  return typeof location !== "undefined" && location.protocol.startsWith("http") ? location.host : "";
}

export function connect(address: string) {
  disconnect();
  const clean = address.trim().replace(/^(https?|wss?):\/\//, "").replace(/\/.*$/, "");
  if (!clean) {
    useNet.setState({ error: "address" });
    return;
  }
  const url = `ws://${clean.includes(":") ? clean : `${clean}:8765`}`;
  useNet.setState({ status: "connecting", error: "", players: [], session: null });
  let sock: WebSocket;
  try {
    sock = new WebSocket(url);
  } catch {
    useNet.setState({ status: "off", error: "unreachable" });
    return;
  }
  ws = sock;
  sock.onmessage = (ev) => {
    if (ws !== sock) return;
    let m: Msg;
    try {
      m = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    receive(m);
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    const was = useNet.getState().status;
    useNet.setState({ status: "off", players: [], session: null, error: was === "connecting" ? "unreachable" : was === "on" ? "lost" : useNet.getState().error });
  };
  sock.onerror = () => {
    /* onclose follows and reports it */
  };
}

export function disconnect() {
  const sock = ws;
  ws = null;
  if (sock) sock.close();
  useNet.setState({ status: "off", players: [], session: null, id: 0, hostId: 0 });
}

function receive(m: Msg) {
  const n = useNet.getState();
  switch (m.t) {
    case "hello":
      useNet.setState({ status: "on", id: m.id as number, hostId: m.host as number, error: "" });
      announce();
      break;
    case "full":
      useNet.setState({ error: "full" });
      break;
    case "join":
      // somebody new: they need to know who is here and what is set
      announce();
      if (isHost()) netSend({ t: "cfg", cfg: n.cfg });
      break;
    case "bye":
      useNet.setState({ players: n.players.filter((p) => p.id !== m.from) });
      break;
    case "host":
      useNet.setState({ hostId: m.id as number });
      break;
    case "me": {
      const p = m.p as NetPlayer;
      if (!p || p.id !== m.from) break;
      useNet.setState({ players: [...n.players.filter((x) => x.id !== p.id), p].sort((a, b) => a.id - b.id) });
      break;
    }
    case "cfg":
      if (m.from === n.hostId) useNet.setState({ cfg: m.cfg as NetConfig });
      break;
    case "start":
      if (m.from === n.hostId) begin(m.session as NetSession);
      break;
    case "song":
      if (m.from === n.hostId) songPart(m);
      break;
    case "lobby":
      // the host has called everyone back to the room
      if (m.from === n.hostId) backToLobby();
      break;
  }
  for (const fn of raceHandlers) fn(m);
}

/** Everyone, the host included, enters the race the same way. */
function begin(session: NetSession) {
  const g = useGame.getState();
  useNet.setState({ session, cfg: session.cfg });
  if (session.song && session.cfg.trackId === RHYTHM_TRACK_ID) {
    // the host's own recording, if it got here whole; otherwise the music is made up as usual
    const mine = rhythmState.features?.name === session.song.features.name && Math.abs(rhythmState.features.duration - session.song.features.duration) < 0.5;
    useSong(session.song.features, mine ? rhythmState.buffer : null, mine ? rhythmState.bytes : null, session.song.theme);
    if (!mine && incoming && incoming.got === incoming.parts.length) decodeIncoming();
  }
  g.setTrackId(session.cfg.trackId);
  // the road itself: without this everyone would race on whatever circuit was loaded last
  setActiveTrack(session.cfg.trackId);
  g.setRaceResult(null);
  g.setMode(session.cfg.modeId);
  g.setRaceSetup({ bots: session.roster.filter((r) => r.bot).length, lives: session.cfg.lives, teams: session.cfg.teams });
  g.setSettings({ aiSkill: session.cfg.aiSkill });
  g.setPaused(false);
  g.resetTelemetry();
  g.restartRace();
  g.goto("race");
}

export function backToLobby() {
  useNet.setState({ session: null });
  useGame.getState().setPaused(false);
  useGame.getState().goto("lobby");
}

/** The host calls everybody back to the room. */
export function recall() {
  if (!isHost()) return;
  netSend({ t: "lobby" });
  backToLobby();
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** The host draws up the grid and sends everyone off. */
export function startRace() {
  if (!isHost()) return;
  const n = useNet.getState();
  const cfg = n.cfg;
  const battle = cfg.modeId === "battle";
  const humans = [...n.players].sort((a, b) => a.id - b.id).slice(0, 8);
  const taken = new Set(humans.flatMap((h) => [h.char, h.partner]));
  const spare = CHARACTERS.filter((c) => !taken.has(c.id)).sort(() => Math.random() - 0.5);
  const roster: RosterEntry[] = humans.map((h) => ({ key: `h${h.id}`, owner: h.id, bot: false, name: h.name, char: h.char, partner: h.partner, vehicle: h.vehicle, team: -1 }));
  const bots = Math.max(0, Math.min(8 - humans.length, cfg.bots, MODES[cfg.modeId].aiCount === 0 ? 0 : 8));
  for (let i = 0; i < bots; i++) {
    const c = spare[i % Math.max(1, spare.length)] ?? CHARACTERS[i];
    roster.push({
      key: `b${i}`,
      owner: n.id,
      bot: true,
      name: c.name,
      char: c.id,
      partner: null,
      vehicle: {
        body: BODY_COLORS[(i * 2 + 1) % BODY_COLORS.length],
        decal: "#ffffff",
        wheel: pick(["classic", "sporty", "glow", "chrome", "spike"] as const),
        shape: pick(SHAPES).id,
        spoiler: pick(["none", "wing", "fin"] as const),
        booster: pick(["single", "twin", "neon"] as const),
        boat: pick(BOATS),
        plane: pick(PLANES),
        sub: pick(SUBS),
        hover: pick(HOVERS),
        finish: "solid",
      },
      team: -1,
    });
  }
  // two sides, dealt alternately down the grid
  if (battle && cfg.teams) roster.forEach((r, i) => (r.team = i % 2));
  const session: NetSession = { cfg, roster, run: (n.session?.run ?? 0) + 1 };
  if (cfg.trackId === RHYTHM_TRACK_ID && rhythmState.features) {
    session.song = { features: rhythmState.features, theme: rhythmState.theme };
    shareSong();
  }
  netSend({ t: "start", session });
  begin(session);
}

// what I drive, kept up to date for the others while we wait in the room
useGame.subscribe((s, prev) => {
  if (s.characterId !== prev.characterId || s.partnerId !== prev.partnerId || s.vehicle !== prev.vehicle) announce();
});

// ---------------------------------------------------------------------------
// The song itself goes to the others in pieces small enough for the server
// (one message may be up to a megabyte), before the start, so that it is
// usually there and decoded by the time the lights go green. Songs over 24 MB
// are not sent: the others race the same circuit to the made-up music.
// ---------------------------------------------------------------------------

const PART = 600 * 1024;
let incoming: { name: string; parts: string[]; got: number } | null = null;

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function shareSong() {
  const bytes = rhythmState.bytes;
  const name = rhythmState.features?.name ?? "";
  if (!bytes || bytes.byteLength > 24 * 1024 * 1024) return;
  const all = new Uint8Array(bytes);
  const n = Math.ceil(all.length / PART);
  for (let i = 0; i < n; i++) netSend({ t: "song", name, i, n, data: toBase64(all.subarray(i * PART, (i + 1) * PART)) });
}

function songPart(m: Msg) {
  const { name, i, n, data } = m as unknown as { name: string; i: number; n: number; data: string };
  if (typeof data !== "string" || !Number.isInteger(i) || !Number.isInteger(n) || n < 1 || n > 64 || i < 0 || i >= n) return;
  if (!incoming || incoming.name !== name || incoming.parts.length !== n) incoming = { name, parts: new Array(n).fill(""), got: 0 };
  if (!incoming.parts[i]) incoming.got++;
  incoming.parts[i] = data;
  // the start may already have come: then the song is put in as soon as it is whole
  if (incoming.got === n && useNet.getState().session?.song?.features.name === name) decodeIncoming();
}

function decodeIncoming() {
  const got = incoming;
  const c = audioContext();
  if (!got || !c) return;
  const chunks = got.parts.map((p) => Uint8Array.from(atob(p), (ch) => ch.charCodeAt(0)));
  const all = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
  let at = 0;
  for (const ch of chunks) (all.set(ch, at), (at += ch.length));
  const bytes = all.buffer;
  c.decodeAudioData(bytes.slice(0))
    .then((buffer) => {
      const song = useNet.getState().session?.song;
      if (!song || song.features.name !== got.name) return;
      rhythmState.buffer = buffer;
      rhythmState.bytes = bytes;
      setSong(buffer, RHYTHM_TRACK_ID, song.features.bpm, song.features.offset);
    })
    .catch(() => {});
}
