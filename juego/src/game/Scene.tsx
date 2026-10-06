import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Track from "./Track";
import Vehicle, { type KartVisualState, type VehicleConfig } from "./Vehicle";
import ParticleSystem from "./ParticleSystem";
import type { UseControlsReturn } from "../controls";
import { useGame } from "../store";
import { useNet, netSend, onRace, isHost } from "../net";
import {
  CHARACTERS,
  MODES,
  BODY_COLORS,
  THEMES,
  mutateTheme,
  themeOnLap,
  SHAPES,
  BOATS,
  PLANES,
  SUBS,
  HOVERS,
  WEAPON_META,
  raceSnapshot,
  hazardState,
  rollWeapon,
  AI_PROFILES,
  zoneAt,
  craftSpeed,
  craftHandling,
  fusionShot,
  WHEEL_EFFECTS,
  SPOILER_EFFECTS,
  BOOSTER_EFFECTS,
  type FusionShot,
  type ShotEffect,
  type CharacterDef,
  type WeaponId,
  type VehicleMode,
} from "../data";
import { trackPointAt, trackTangentAt, lateralOffsetFrom, getActiveTrack, surfaceYAt, halfWidthAt, trapPhase, trapTransform, getPaths, getPads, plainRoadAt, getSkyRings, getSkyBlocks, sectorMix, plainStretches, terrainY, FLY_BASE, FLIGHT, groundAt, makeGround, mainIndexAt, pathPoint } from "../trackCurve";
import { moveBody, makeResult, placeBody, respawnBody, aimAhead, bendAhead, collideBodies, progDelta, GRAVITY, type Body, type StepOpts } from "../physics";
import { emitParticles, emitDebris, addShake, shakeState } from "../particles";
import { setSkid, sfx } from "../sound";

const TAG_COOLDOWN_MAX = 3.6;
// scratch objects for the per-frame physics calls, so the loop allocates nothing
const stepOpts: StepOpts = { rideOffset: 0, bobbing: false, fly: false, flyAlt: 0, flyMargin: 4, ghost: false };
const stepRes = makeResult();
const aimV = new THREE.Vector3();
const camG = makeGround();
const sunTint = new THREE.Color();
const sunTint2 = new THREE.Color();

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

interface Racer extends Body {
  id: string;
  isPlayer: boolean;
  main: CharacterDef;
  partner: CharacterDef | null;
  activeIsPartner: boolean;
  vehicle: VehicleConfig;
  /** visual pitch in radians: the slope on the ground, the arc in the air */
  pitch: number;
  /** seconds spent wedged with the throttle open */
  pinnedFor: number;
  /** furthest it has got, and seconds since that last moved (AI only) */
  bestTotal: number;
  noProgressFor: number;
  respawnLock: number;
  /** whole laps completed */
  lapsDone: number;
  /** side a drift is committed to: +1 left, -1 right, 0 when not drifting */
  driftDir: number;
  /** seconds into the current drift */
  driftAge: number;
  /** how far the nose is swung into the turn, for the look of it; and the little hop a drift starts with */
  yaw: number;
  hop: number;
  /** race clock at the last fall, to spot a racer that keeps falling at the same place */
  lastFall: number;
  /** cooldown so one pad fires once */
  padCd: number;
  /** ribbon the AI has decided to take, 0 for the main loop, and the junction it last decided at */
  aiRoute: number;
  aiSeen: number;
  /** lateral line it is holding, smoothed, and its own preferred offset from the ideal one */
  aiLat: number;
  aiLane: number;
  /** race clock when it was last hit, so nobody is hit twice in a row */
  lastHit: number;
  /** how far above the cruising line the pilot is holding the plane */
  flyOff: number;
  /** being fired by a cannon: a scripted arc from where it was to where it lands */
  launch: null | { from: THREE.Vector3; to: THREE.Vector3; idx: number; e: number; dur: number; lift: number };
  steerSmooth: number;
  t: number;
  lap: number;
  finished: boolean;
  weapon: WeaponId | null;
  /** a second item, waiting behind the first */
  weapon2: WeaponId | null;
  /** 0..1: how settled it is in the slipstream of the kart in front */
  draft: number;
  boostTimer: number;
  boostMult: number;
  shieldActive: boolean;
  shieldTimer: number;
  swapInvuln: number;
  stunTimer: number;
  slowTimer: number;
  tagCooldown: number;
  /** the fusion this racer is part of, as driver or as gunner, and the cooldown before the next one */
  pair: FusionPair | null;
  /** riding on someone else's kart as the gunner: it has no body of its own for now */
  riding: boolean;
  fuseCd: number;
  /** what the cooldown started at, for the ring round the button */
  fuseCdMax: number;
  /** the partner's own turret, out when there was nobody to fuse with: seconds left, time to the next shot, where it points */
  turretTimer: number;
  turretCd: number;
  turretAim: number;
  /** battle: the upgrade the turret is running on, picked up from a box */
  turretMod: TurretMod | null;
  turboMeter: number;
  hazardCd: number;
  magnetTimer: number;
  ghostTimer: number;
  /** seconds left of the roulette: the item is drawn but not yet usable */
  rollTimer: number;
  /** grown huge: faster, untouchable, flattens whoever it touches */
  giantTimer: number;
  /** frozen solid, and burning (losing speed) */
  frozenTimer: number;
  burnTimer: number;
  /** mini-turbo level the current drift has reached, 0..3 */
  driftLevel: number;
  /** where the turret is pointing, relative to the nose */
  explodeTimer: number;
  /** battle: lives left, the side it fights on (-1 for none), out of it, and the moment of grace after losing one */
  lives: number;
  team: number;
  out: boolean;
  lifeCd: number;
  /** network: this kart is run on another machine, and here it only follows what that machine says */
  remote: boolean;
  fix: NetFix | null;
  /** the name shown for it: a player's own, or the character's */
  label: string;
  /** who landed the last hit on it, and what it looked like when its owner last reported, to spot what we did to it since */
  hitBy: string;
  seen: { hit: number; stun: number; frozen: number; slow: number; burn: number; vy: number };
  exploding: boolean;
  portalCd: number;
  driftCharge: number;
  isDrifting: boolean;
  mode: VehicleMode;
  aiPhase: number;
  aiLookahead: number;
  aiWeaponDelay: number;
  aiMult: number;
  /** per-racer personality offset so the field is not a wall of clones */
  aiQuirk: number;
  /** seconds of remaining brain-fart: while positive the AI runs wide */
  aiMistake: number;
  coins: number;
  boostsUsed: number;
  tagSwaps: number;
  rings: number;
  ringCd: number[];
  bumpCd: number;
  particleAccum: number;
  visual: React.MutableRefObject<KartVisualState>;
  group: React.MutableRefObject<THREE.Group | null>;
}

/**
 * Two racers fused into one kart, Crash Tag Team style: one drives, the other
 * rides on top manning a turret that turns the full circle. They share one
 * health bar; when it runs out nobody is eliminated, they come apart and both
 * are stunned for three seconds.
 */
interface FusionPair {
  driver: Racer;
  gunner: Racer;
  /** 1 down to 0 */
  hp: number;
  age: number;
  /** where the turret points, relative to the driver's nose */
  aim: number;
  fireCd: number;
  swapCd: number;
  /** rival the turret has locked on to */
  lock: Racer | null;
  /** when two opponents go their own ways again */
  life: number;
}

/** A gunner riding on another kart is not on the road in its own right: nothing hits or targets it. */
const gone = (o: Racer) => o.finished || o.riding || o.out;

interface Projectile {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  type: WeaponId;
  ownerId: string;
  life: number;
  targetId: string | null;
  /** a turret shot: what it does on a hit, how hard, and its colour */
  effect: ShotEffect | null;
  power: number;
  color: string;
  homing: boolean;
  /** the kart the shooter is riding on, which its own shots pass through */
  allyId: string;
  /** a missile follows the road it was fired on, ribbon by ribbon, until it is close enough to go straight for its target */
  road: boolean;
  path: number;
  idx: number;
  lat: number;
  /** network: only the picture of a shot fired on another machine, which hits nothing here */
  fake: boolean;
  /** network: the others have been told about it */
  told: boolean;
}

/** How fast a missile runs along the road: quicker than any kart, boost or no boost. */
const MISSILE_SPEED = 52;

interface Puddle {
  active: boolean;
  pos: THREE.Vector3;
  ownerId: string;
  ignoreUntil: number;
  life: number;
  kind: "slime" | "mine";
  /** dropped by a turret: what it does to whoever drives into it */
  effect: ShotEffect | null;
  power: number;
  /** network: the others have been told about it */
  told: boolean;
}

/** Where another machine last said one of its karts was, and how it was moving. */
interface NetFix {
  x: number;
  y: number;
  z: number;
  h: number;
  vx: number;
  vz: number;
  age: number;
}

function activeChar(r: Racer) {
  return r.activeIsPartner && r.partner ? r.partner : r.main;
}

function shapeBonus(shape: VehicleConfig["shape"]) {
  return SHAPES.find((s) => s.id === shape)?.bonus ?? { speed: 0, handling: 0 };
}

/**
 * What a racer can do, from the character driving and the kart it is driving.
 * Every number on the character card and every part in the garage is in here:
 * speed, acceleration and handling are what they say; weight makes a kart
 * slower to get going and a little faster flat out, harder to shove and harder
 * to stop with a hit.
 */
function statsFor(char: CharacterDef, vehicle: VehicleConfig) {
  const b = shapeBonus(vehicle.shape);
  const water = vehicle.shape === "cruiser" || vehicle.shape === "hover";
  const parts = [WHEEL_EFFECTS[vehicle.wheel] ?? {}, SPOILER_EFFECTS[vehicle.spoiler ?? "none"] ?? {}, BOOSTER_EFFECTS[vehicle.booster ?? "single"] ?? {}];
  const mul = (k: "speed" | "accel" | "turn" | "drift" | "turbo" | "boostTime" | "boostPower" | "grip") => parts.reduce((acc, p) => acc * (p[k] ?? 1), 1);
  const heavy = char.weight - 3; // -2 .. +2
  return {
    // top speed runs from 24 to 27.75 across the speed stat: enough to feel, not
    // enough for the fastest character to lap the slowest in three laps
    maxSpeed: (21.5 + char.speed * 1.25 + b.speed * 0.8) * mul("speed") * (1 + heavy * 0.012),
    accel: (11 + char.accel * 3.4) * mul("accel") * (1 - heavy * 0.045),
    turnRate: (1.75 + char.handling * 0.4 + b.handling * 0.28) * mul("turn"),
    boatBonus: water ? 1.12 : 1,
    planeBonus: vehicle.shape === "jet" ? 1.18 : 1,
    /** how fast a drift charges: good handling charges sooner */
    driftRate: (0.8 + char.handling * 0.07) * mul("drift"),
    turboRate: mul("turbo"),
    boostTime: mul("boostTime"),
    boostPower: mul("boostPower"),
    /** share of a slowdown that gets through: heavy karts and spiked tyres shrug more of it off */
    grip: mul("grip") * (1 - heavy * 0.08),
  };
}

/** Charge at which a drift reaches each of its three mini-turbo levels. */
const DRIFT_LEVELS = [0.35, 0.85, 1.45];
/** What each level gives: seconds of boost, speed multiplier, share of the turbo bar. */
const DRIFT_BOOST: [number, number, number][] = [[0.6, 1.3, 0.1], [1.0, 1.5, 0.2], [1.4, 1.7, 0.34]];
const DRIFT_COLOURS = ["#8be9ff", "#ffb347", "#ff5fd2"];
/** How fast a sliding kart's direction of travel catches up with its nose (1/s), and the widest angle between them. */
const SLIP_RATE = 2.7;
const SLIP_MAX = 0.62;
/** Tyre marks kept on the road at once. */
const SKID_POOL = 700;
/**
 * The partner's own turret, for when there is nobody near to fuse with. It is
 * the same shot at a little over half strength and a slower rate, it aims
 * itself, it lasts a few seconds, and it costs the long cooldown: while that
 * runs there is no fusing with anyone either.
 */
const SOLO_TIME = 7;
const SOLO_COOLDOWN = 16;
const SOLO_POWER = 0.55;
const SOLO_RATE = 1.6;
/**
 * Battle only: what a box can do to your turret instead of handing you an
 * item. The turret comes out by itself, at full strength, changed like this.
 */
type TurretMod = "rapid" | "triple" | "heavy" | "seeker" | "burst";
const TURRET_MODS: TurretMod[] = ["rapid", "triple", "heavy", "seeker", "burst"];
const UPGRADE_TIME = 12;
const UPGRADE_COLOUR = "#ffd166";
function upgraded(shot: FusionShot, mod: TurretMod): FusionShot {
  switch (mod) {
    case "rapid":
      return { ...shot, rate: shot.rate * 0.45 };
    case "triple":
      return { ...shot, kind: shot.kind === "bolt" || shot.kind === "rear" ? "fan" : shot.kind, count: shot.count + 2 };
    case "heavy":
      return { ...shot, power: shot.power * 1.7, rate: shot.rate * 1.2 };
    case "seeker":
      return { ...shot, kind: shot.kind === "nova" || shot.kind === "lance" ? shot.kind : "homing", rate: shot.rate * 0.85 };
    case "burst":
      return { ...shot, kind: "nova", rate: shot.rate * 1.3 };
  }
}

export default function Scene({ controls: controlsApi }: { controls: UseControlsReturn }) {
  const { poll } = controlsApi;
  const { camera } = useThree();

  const modeId = useGame((s) => s.modeId);
  const characterId = useGame((s) => s.characterId);
  const partnerId = useGame((s) => s.partnerId);
  const vehicleCfg = useGame((s) => s.vehicle);
  const settings = useGame((s) => s.settings);
  // every circuit has the aesthetic it was designed for, and the map mutates on
  // top of it: the palette, the vegetation and the hazard patterns shift each lap
  const aestheticLap = useGame((s) => s.telemetry.lap);
  const theme = useMemo(() => mutateTheme(THEMES[getActiveTrack().theme], aestheticLap - 1), [aestheticLap]);
  const mode = MODES[modeId];
  const battle = modeId === "battle";
  // a race over the network: who is in it, which of them I am, and whether the bots are mine to drive
  const session = useMemo(() => useNet.getState().session, []);
  const myNetId = useMemo(() => useNet.getState().id, []);
  const hosting = useMemo(() => isHost(), []);
  // read once: the terms of a race do not change while it is being run
  const setup = useMemo(() => useGame.getState().raceSetup, []);


  const skyRings = useMemo(() => getSkyRings(), []);
  const skyBlocks = useMemo(() => getSkyBlocks(), []);

  const racers = useMemo<Racer[]>(() => {
    const list: Racer[] = [];
    const mainChar = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
    const partnerChar = CHARACTERS.find((c) => c.id === partnerId) ?? null;
    // never more than eight on the road
    // in a network race the grid is the one the host drew up: my own kart first here, the rest in its order
    const mine = session?.roster.find((x) => !x.bot && x.owner === myNetId) ?? null;
    const grid = session && mine ? [mine, ...session.roster.filter((x) => x !== mine)] : null;
    const total = grid ? grid.length : 1 + Math.max(0, Math.min(7, setup.bots ?? mode.aiCount));
    const charOf = (id: string | null) => CHARACTERS.find((c) => c.id === id) ?? null;
    const mainPath = getPaths()[0];
    // the opponents are drawn at random each race from everyone the player is not using,
    // and each brings its own stats: the same numbers that apply to the player
    const pool = CHARACTERS.filter((c) => c.id !== mainChar.id && c.id !== partnerChar?.id);
    for (let k = pool.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
    for (let i = 0; i < total; i++) {
      const isPlayer = i === 0;
      const e = grid ? grid[i] : null;
      // everyone lines up in the same place on every machine
      const slot = e && session ? session.roster.indexOf(e) : i;
      const row = Math.floor(slot / 2);
      const col = slot % 2 === 0 ? -1 : 1;
      // grid starts just AHEAD of the finish line so the first crossing = lap 1 done
      const aiChar = pool[(i - 1 + pool.length) % pool.length] ?? CHARACTERS[i % CHARACTERS.length];
      list.push({
        id: e ? e.key : isPlayer ? "player" : `ai-${i}`,
        isPlayer,
        main: e ? charOf(e.char) ?? aiChar : isPlayer ? mainChar : aiChar,
        partner: e ? charOf(e.partner) : isPlayer ? partnerChar : null,
        activeIsPartner: false,
        vehicle: e
          ? e.vehicle
          : isPlayer
          ? vehicleCfg
          : {
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
            },
        pos: new THREE.Vector3(),
        y: 0,
        vy: 0,
        airborne: false,
        groundY: 0,
        slopeAlong: 0,
        lat: 0,
        half: 10,
        touching: false,
        path: 0,
        idx: 0,
        prog: 0,
        total: 0,
        safePath: 0,
        safeIdx: 0,
        pitch: 0,
        pinnedFor: 0,
        bestTotal: 0,
        noProgressFor: 0,
        respawnLock: 0,
        lapsDone: 0,
        course: 0,
        driftDir: 0,
        driftAge: 0,
        yaw: 0,
        hop: 0,
        lastFall: -1e9,
        padCd: 0,
        aiRoute: 0,
        aiSeen: -1,
        aiLat: 0,
        aiLane: (((i * 7) % 5) - 2) * 0.7,
        lastHit: -1e9,
        flyOff: 0,
        launch: null,
        heading: 0,
        speed: 0,
        steerSmooth: 0,
        t: 0,
        lap: 1,
        finished: false,
        weapon: null,
        weapon2: null,
        draft: 0,
        boostTimer: 0,
        boostMult: 1,
        shieldActive: false,
        shieldTimer: 0,
        swapInvuln: 0,
        stunTimer: 0,
        slowTimer: 0,
        tagCooldown: 0,
        pair: null,
        riding: false,
        fuseCd: 0,
        fuseCdMax: 9,
        turretTimer: 0,
        turretCd: 0,
        turretAim: 0,
        turretMod: null,
        turboMeter: 0,
        hazardCd: 0,
        magnetTimer: 0,
        ghostTimer: 0,
        rollTimer: 0,
        giantTimer: 0,
        frozenTimer: 0,
        burnTimer: 0,
        driftLevel: 0,
        explodeTimer: 0,
        lives: setup.lives,
        team: e ? e.team : battle && setup.teams ? i % 2 : -1,
        out: false,
        lifeCd: 0,
        remote: e ? (e.bot ? !hosting : e.owner !== myNetId) : false,
        fix: null,
        label: e && !e.bot ? e.name : "",
        hitBy: "",
        seen: { hit: 0, stun: 0, frozen: 0, slow: 0, burn: 0, vy: 0 },
        exploding: false,
        portalCd: 0,
        driftCharge: 0,
        isDrifting: false,
        mode: "land",
        aiPhase: Math.random() * Math.PI * 2,
        aiLookahead: 0.03 + Math.random() * 0.012,
        aiWeaponDelay: 0,
        aiMult: 1,
        aiQuirk: ((i * 7) % 5) / 12 - 0.16,
        aiMistake: 0,
        coins: 0,
        boostsUsed: 0,
        tagSwaps: 0,
        rings: 0,
        ringCd: skyRings.map(() => 0),
        bumpCd: 0,
        particleAccum: 0,
        visual: { current: { boosting: false, shielded: false, steer: 0, speedFrac: 0, stunned: false, mode: "land", drift: false } },
        group: { current: null },
      });
      const me = list[i];
      placeBody(me, 0, Math.round((4 + row * 3.4) / mainPath.ds), col * 3.3);
      me.total = me.prog;
      // nothing has been done to it yet: what was last seen of it is what it is now
      me.seen.hit = me.lastHit;
      me.bestTotal = me.total;
      me.t = me.prog;
      me.course = me.heading;
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(racers.map((r) => [r.id, r])), [racers]);
  const netClock = useRef(0);

  // ---- what the other machines tell mine during a race ----
  useEffect(() => {
    if (!session) return;
    return onRace((m) => {
      if (m.t === "s") {
        for (const a of m.a as unknown[][]) accept(a);
      } else if (m.t === "hit") {
        const r = byId.get(m.k as string);
        if (r && !r.remote && !gone(r)) applyHit(r, !!m.spin);
      } else if (m.t === "fx") {
        const r = byId.get(m.k as string);
        if (!r || r.remote || gone(r) || protectedNow(r)) return;
        r.stunTimer = Math.max(r.stunTimer, m.stun as number);
        r.frozenTimer = Math.max(r.frozenTimer, m.frozen as number);
        r.slowTimer = Math.max(r.slowTimer, m.slow as number);
        r.burnTimer = Math.max(r.burnTimer, m.burn as number);
        if ((m.vy as number) > 3) {
          r.vy = m.vy as number;
          r.airborne = true;
        }
        r.speed = Math.min(r.speed, Math.max(0, m.speed as number));
        r.lastHit = raceClock.current;
        if (r.isPlayer) {
          addShake(0.3);
          sfx.hit();
        }
      } else if (m.t === "proj") {
        const p = projectiles.find((x) => !x.active);
        if (!p) return;
        p.active = true;
        p.fake = true;
        p.told = true;
        p.road = false;
        p.type = m.w as WeaponId;
        p.ownerId = m.o as string;
        p.allyId = "";
        p.targetId = (m.tg as string | null) ?? null;
        p.effect = null;
        p.power = 1;
        p.color = m.c as string;
        p.homing = !!m.hm;
        p.life = m.life as number;
        p.pos.set(m.x as number, m.y as number, m.z as number);
        p.vel.set(m.vx as number, m.vy as number, m.vz as number);
      } else if (m.t === "mine") {
        const p = puddles.find((x) => !x.active);
        if (!p) return;
        p.active = true;
        p.told = true;
        p.kind = m.kind as "slime" | "mine";
        p.ownerId = m.o as string;
        p.ignoreUntil = 0;
        p.life = m.life as number;
        p.effect = (m.fx as ShotEffect | null) ?? null;
        p.power = (m.pw as number) ?? 1;
        p.pos.set(m.x as number, m.y as number, m.z as number);
      } else if (m.t === "bye") {
        // whoever left takes their kart with them, and a host takes the bots too
        for (const r of racers) {
          const e = session.roster.find((x) => x.key === r.id);
          if (e && e.owner === m.from && r.remote) {
            r.out = true;
            r.finished = true;
            if (r.group.current) r.group.current.visible = false;
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemBoxes = useMemo(() => {
    const boxes: { t: number; pos: THREE.Vector3; active: boolean; respawn: number; group: React.MutableRefObject<THREE.Group | null> }[] = [];
    // Rows of three across the road, so the pack splits to take them. Only on
    // road that is really there: never over a jump, a cannon shot, a flight or the sea.
    const rows = Math.max(4, Math.round(10 * (mode.itemFrequency || 1)));
    for (let i = 0; i < rows; i++) {
      let t = (i + 0.5) / rows;
      const whole = (z: ReturnType<typeof zoneAt>) => !!z && z.t1 - z.t0 >= 0.99;
      for (let guard = 0; guard < 30 && ((zoneAt(t) && !whole(zoneAt(t))) || !plainRoadAt(t, 30)); guard++) t = (t + 0.017) % 1;
      const center = trackPointAt(t);
      const tangent = trackTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const gap = Math.min(4.8, halfWidthAt(t) - 3.2);
      for (const side of [-1, 0, 1]) {
        boxes.push({
          t,
          pos: center.clone().addScaledVector(normal, side * gap),
          active: mode.itemsEnabled,
          respawn: 0,
          group: { current: null },
        });
      }
    }
    return boxes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coinSpots = useMemo(() => {
    const coins: { pos: THREE.Vector3; active: boolean; respawn: number; group: React.MutableRefObject<THREE.Group | null> }[] = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.35) / count;
      if (!plainRoadAt(t, 8)) continue; // nothing to collect in mid-air over a gap
      const center = trackPointAt(t);
      const tangent = trackTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const zone = zoneAt(t);
      const y = surfaceYAt(t) + (zone?.type === "sky" ? FLY_BASE + 0.6 : 1.1);
      coins.push({ pos: center.clone().addScaledVector(normal, (i % 2 === 0 ? 1 : -1) * 1.9).setY(y), active: true, respawn: 0, group: { current: null } });
    }
    // coin bait along every alternate route
    const all = getPaths();
    for (let k = 1; k < all.length; k++) {
      const N = 9;
      for (let i = 0; i < N; i++) {
        const p = pathPoint(k, Math.round(((i + 0.5) / N) * (all[k].n - 1)), 0, new THREE.Vector3());
        p.y += 1.1;
        coins.push({ pos: p, active: true, respawn: 0, group: { current: null } });
      }
    }
    return coins;
  }, []);

  const pads = useMemo(() => getPads(), []);
  const trackDef = useMemo(() => getActiveTrack(), []);

  // Slow traffic: a few blobs trundling along the plain stretches, on the
  // outer lanes. Each keeps to one stretch and starts it again at the end.
  const traffic = useMemo(() => {
    const want = getActiveTrack().traffic ?? 0;
    const runs = plainStretches();
    const main = getPaths()[0];
    const list: { from: number; to: number; i: number; side: number; speed: number; pos: THREE.Vector3; heading: number; group: { current: THREE.Group | null } }[] = [];
    for (let k = 0; k < want && runs.length; k++) {
      const [from, to] = runs[k % runs.length];
      list.push({
        from, to,
        i: from + ((to - from) * ((k * 0.37 + 0.2) % 1)),
        side: k % 2 ? 1 : -1,
        speed: (8 + (k % 3) * 2) / main.ds,
        pos: new THREE.Vector3(),
        heading: 0,
        group: { current: null },
      });
    }
    return list;
  }, []);

  /** First sample at or after `idx` of the main loop with whole road for a good way ahead. */
  function safeAhead(idx: number) {
    const main = getPaths()[0];
    for (let k = 0; k < 200; k++) {
      const i = (idx + k * 3) % main.n;
      if (plainRoadAt(main.prog[i], 45)) return i;
    }
    return idx;
  }

  /** Back on the road after a fall or when wedged, with enough speed to take the next jump. */
  function recover(r: Racer, pace: number) {
    // Falling again straight after being put back means the run-up is not
    // enough for whoever this is: set it down past the obstacle, on the main
    // road, instead of feeding it to the same gap for ever.
    const again = raceClock.current - r.lastFall < 7000;
    r.lastFall = raceClock.current;
    if (again) {
      placeBody(r, 0, mainIndexAt(r.prog + 0.035));
      const spot = safeAhead(r.idx);
      if (spot !== r.idx) placeBody(r, 0, spot);
    } else {
      respawnBody(r);
    }
    r.speed = pace;
    r.respawnLock = 1;
    r.pinnedFor = 0;
    r.noProgressFor = 0;
    r.stunTimer = 0;
    r.isDrifting = false;
    r.driftCharge = 0;
    r.driftLevel = 0;
    r.driftDir = 0;
    r.aiRoute = 0;
    r.swapInvuln = Math.max(r.swapInvuln, 1.5);
    r.t = r.prog;
    emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: theme.glow, count: 26, speed: 5, spread: 1.4, size: 0.22, life: 0.6 });
    if (r.isPlayer) {
      addShake(0.22);
      sfx.swap();
    }
  }

  const PROJ_POOL = 18;
  const projectiles = useMemo<Projectile[]>(
    () => Array.from({ length: PROJ_POOL }, () => ({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), type: "orb" as WeaponId, ownerId: "", life: 0, targetId: null, effect: null, power: 1, color: "#ffffff", homing: false, allyId: "", road: false, path: 0, idx: 0, lat: 0, fake: false, told: false })),
    []
  );
  const projRefs = useMemo(() => Array.from({ length: PROJ_POOL }, () => ({ current: null as THREE.Group | null })), []);

  const PUDDLE_POOL = 10;
  const puddles = useMemo<Puddle[]>(
    () => Array.from({ length: PUDDLE_POOL }, () => ({ active: false, pos: new THREE.Vector3(0, -999, 0), ownerId: "", ignoreUntil: 0, life: 0, kind: "slime" as const, effect: null, power: 1, told: false })),
    []
  );
  const puddleRefs = useMemo(() => Array.from({ length: PUDDLE_POOL }, () => ({ current: null as THREE.Group | null })), []);

  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight();
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera;
    c.left = -110;
    c.right = 110;
    c.top = 110;
    c.bottom = -110;
    c.far = 320;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0008;
    return l;
  }, []);
  useEffect(() => {
    sun.color.set(theme.sun);
    sun.intensity = theme.sunIntensity;
  }, [sun, theme]);

  const started = useRef(false);
  const raceClock = useRef(0);
  const finishedOnce = useRef(false);
  /** the little celebration after the flag: the kart hops and spins while the camera circles it */
  const victory = useRef<null | { t: number; podium: boolean; heading: number; y: number }>(null);
  const frame = useRef(0);
  const uiClock = useRef(1);
  const clockRef = useRef(0);
  const camPos = useRef(new THREE.Vector3(0, 6, -14));
  const camLook = useRef(new THREE.Vector3());
  const camSlip = useRef(0);
  const camAim = useRef(0);

  // tyre marks: strips of rubber left on the road by a slide, the oldest replaced by the newest
  const skids = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.3, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: "#0c0d12", transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      SKID_POOL
    );
    mesh.frustumCulled = false;
    mesh.count = 0;
    return { mesh, next: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, "YXZ"), p: new THREE.Vector3(), s: new THREE.Vector3() };
  }, []);
  useEffect(() => () => {
    skids.mesh.geometry.dispose();
    (skids.mesh.material as THREE.Material).dispose();
    setSkid(0);
  }, [skids]);
  function laySkid(x: number, y: number, z: number, dir: number, slope: number, length: number) {
    skids.e.set(-Math.atan(slope), dir, 0);
    skids.q.setFromEuler(skids.e);
    skids.m.compose(skids.p.set(x, y + 0.06, z), skids.q, skids.s.set(1, 1, Math.max(0.4, length)));
    skids.mesh.setMatrixAt(skids.next, skids.m);
    skids.next = (skids.next + 1) % SKID_POOL;
    if (skids.mesh.count < SKID_POOL) skids.mesh.count++;
    skids.mesh.instanceMatrix.needsUpdate = true;
  }
  const beamRef = useRef<THREE.Mesh>(null);
  /** line of fire of the turret the player is on, and the ring round whoever is locked on to */
  const aimRef = useRef<THREE.Mesh>(null);
  const lockRef = useRef<THREE.Mesh>(null);
  const itemLock = useRef<Racer | null>(null);
  const warnClock = useRef(0);
  const beamTimer = useRef(0);
  const beamFrom = useRef(new THREE.Vector3());
  const beamTo = useRef(new THREE.Vector3());

  useEffect(() => {
    raceSnapshot.theme = theme;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    hazardState.lap = 1;
    useGame.getState().resetTelemetry();
    useGame.getState().setTelemetry({ totalLaps: mode.laps, totalRacers: racers.length, countdown: 3 });
    const timers: number[] = [];
    sfx.countdown();
    [1000, 2000, 3000].forEach((ms, idx) => {
      timers.push(
        window.setTimeout(() => {
          useGame.getState().setTelemetry({ countdown: 2 - idx });
          if (idx < 2) sfx.countdown();
          else sfx.go();
        }, ms)
      );
    });
    timers.push(window.setTimeout(() => (started.current = true), 3000));
    timers.push(window.setTimeout(() => useGame.getState().setTelemetry({ countdown: -1 }), 3900));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function spawnProjectile(type: WeaponId, owner: Racer, targetId: string | null, angle = 0) {
    const p = projectiles.find((x) => !x.active);
    if (!p) return null;
    p.road = false;
    p.fake = false;
    const heading = owner.heading + angle;
    const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    p.active = true;
    p.type = type;
    p.ownerId = owner.id;
    p.targetId = targetId;
    p.effect = null;
    p.allyId = "";
    p.power = 1;
    p.color = WEAPON_META[type].color;
    p.homing = type === "missile";
    p.life = 3.2;
    p.pos.copy(owner.pos).addScaledVector(fwd, 1.6).setY(owner.y + 0.7);
    p.vel.copy(fwd).multiplyScalar(type === "missile" ? 40 : 30);
    return p;
  }

  /** Whoever is closest behind, within `maxGap` of a lap. */
  function findTargetBehind(r: Racer, maxGap: number) {
    let best: Racer | null = null;
    let bestDiff = Infinity;
    for (const o of racers) {
      if (o === r || gone(o)) continue;
      const gap = r.total - o.total;
      if (gap > 0.002 && gap < maxGap && gap < bestDiff) {
        bestDiff = gap;
        best = o;
      }
    }
    return best;
  }

  function findTargetAhead(r: Racer, maxGap: number) {
    let best: Racer | null = null;
    let bestDiff = Infinity;
    const my = r.total;
    for (const o of racers) {
      if (o === r || gone(o)) continue;
      const gap = o.total - my;
      if (gap > 0.004 && gap < maxGap && gap < bestDiff) {
        bestDiff = gap;
        best = o;
      }
    }
    return best;
  }

  function protectedNow(r: Racer) {
    return r.shieldActive || r.swapInvuln > 0 || r.ghostTimer > 0 || r.giantTimer > 0;
  }

  /** Nearest rival all round the kart, or only behind it: the turret turns the full circle. */
  function findTurretTarget(r: Racer, behindOnly: boolean): Racer | null {
    let best: Racer | null = null;
    let bd = 70 * 70;
    const fx = Math.sin(r.heading);
    const fz = Math.cos(r.heading);
    for (const o of racers) {
      if (o === r || gone(o) || o.launch || Math.abs(o.y - r.y) > 10) continue;
      const dx = o.pos.x - r.pos.x;
      const dz = o.pos.z - r.pos.z;
      if (behindOnly && dx * fx + dz * fz > 0) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** A turret shot lands: each character's does its own thing to the victim. */
  function applyShot(v: Racer, owner: Racer, effect: ShotEffect, power: number, color: string) {
    if (battle && owner !== v && owner.team >= 0 && owner.team === v.team) return;
    if (protectedNow(v)) {
      v.shieldActive = false;
      v.shieldTimer = 0;
      emitParticles({ position: v.pos.clone().setY(v.y + 0.9), color: theme.glow, count: 14, speed: 3.2, spread: 1.2, size: 0.2, life: 0.5 });
      return;
    }
    // a fused pair takes it on the turret's health instead
    if (v.pair) return applyHit(v.pair.driver, false, owner);
    v.lastHit = raceClock.current;
    v.hitBy = owner.id;
    if (battle) takeLife(v);
    // what a shot wins goes to the kart the shooter is on
    const body = owner.pair ? owner.pair.driver : owner;
    const give = statsFor(activeChar(v), v.vehicle).grip;
    switch (effect) {
      case "stun":
        v.stunTimer = Math.max(v.stunTimer, 0.8 * power);
        v.speed *= 1 - 0.3 * give;
        break;
      case "spin":
        v.stunTimer = Math.max(v.stunTimer, 1.2 * power);
        v.speed *= 1 - 0.6 * give;
        break;
      case "slow":
        v.slowTimer = Math.max(v.slowTimer, 1.6 * power * give);
        break;
      case "freeze":
        v.frozenTimer = Math.max(v.frozenTimer, 1.4 * power);
        break;
      case "drain": {
        const taken = Math.abs(v.speed) * 0.4 * power;
        v.speed *= 1 - 0.4 * power;
        body.speed += taken;
        body.boostTimer = Math.max(body.boostTimer, 0.8);
        body.boostMult = Math.max(body.boostMult, 1.4);
        break;
      }
      case "shove": {
        const dx = v.pos.x - owner.pos.x;
        const dz = v.pos.z - owner.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        v.pos.x += (dx / d) * 3.4 * power * give;
        v.pos.z += (dz / d) * 3.4 * power * give;
        v.speed *= 0.86;
        break;
      }
      case "lift":
        v.vy = 9 * power;
        v.airborne = true;
        v.speed *= 0.8;
        break;
      case "coins": {
        const n = Math.min(v.coins, Math.round(3 * power));
        v.coins -= n;
        owner.coins += n;
        v.speed *= 0.9;
        break;
      }
      case "steal":
        if (v.weapon && !body.weapon) {
          body.weapon = v.weapon;
          v.weapon = null;
          if (body.isPlayer) useGame.getState().setTelemetry({ weapon: body.weapon });
          if (v.isPlayer) useGame.getState().setTelemetry({ weapon: null });
        } else {
          v.stunTimer = Math.max(v.stunTimer, 0.5);
        }
        break;
      case "blind":
        blind(v, 2.4 * power);
        break;
      case "burn":
        v.burnTimer = Math.max(v.burnTimer, 2.6 * power * give);
        break;
      case "tug":
        v.speed *= 1 - 0.5 * power * give;
        body.boostTimer = Math.max(body.boostTimer, 0.6);
        body.boostMult = Math.max(body.boostMult, 1.3);
        break;
    }
    emitParticles({ position: v.pos.clone().setY(v.y + 0.8), color, count: 18, speed: 4, spread: 1.3, size: 0.22, life: 0.55 });
    if (v.isPlayer) {
      addShake(0.25);
      sfx.hit();
    }
  }

  /** Cover a racer's view: error windows over the player's screen, a spell of hesitation for an opponent. */
  function blind(v: Racer, seconds: number) {
    if (v.isPlayer) useGame.getState().setTelemetry({ popupUntil: Date.now() + seconds * 1000 });
    else v.aiMistake = Math.max(v.aiMistake, seconds * 0.8);
  }

  /** One volley from the turret. Every character's shot leaves it and lands in its own way. */
  function fireShot(r: Racer, shot: FusionShot, target: Racer | null, aimWorld: number, ally: Racer | null) {
    const from = r.pos.clone().setY(r.y + 2.1);
    const SPEED = 54;
    // aim where the target is going to be, not where it is
    let aimAt = aimWorld;
    let climb = 0;
    if (target) {
      const tt = Math.min(1.4, from.distanceTo(target.pos) / SPEED);
      const lx = target.pos.x + Math.sin(target.course) * target.speed * tt;
      const lz = target.pos.z + Math.cos(target.course) * target.speed * tt;
      aimAt = Math.atan2(lx - r.pos.x, lz - r.pos.z);
      climb = (target.y + 0.8 - from.y) / Math.max(0.15, tt);
    }
    const launch = (angle: number, homing: boolean) => {
      const p = projectiles.find((x) => !x.active);
      if (!p) return;
      p.active = true;
      p.fake = false;
      p.type = "missile";
      p.ownerId = r.id;
      p.targetId = homing && target ? target.id : null;
      p.homing = homing;
      p.allyId = ally ? ally.id : "";
      p.effect = shot.effect;
      p.power = shot.power;
      p.color = shot.color;
      p.life = 2.6;
      p.pos.copy(from);
      p.vel.set(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(homing ? 42 : SPEED);
      p.vel.y = climb;
    };
    switch (shot.kind) {
      case "bolt":
      case "rear":
        for (let i = 0; i < shot.count; i++) launch(aimAt + (i - (shot.count - 1) / 2) * 0.07, false);
        break;
      case "fan":
        for (let i = 0; i < shot.count; i++) launch(aimAt + (i - (shot.count - 1) / 2) * 0.2, false);
        break;
      case "homing":
        for (let i = 0; i < shot.count; i++) launch(aimAt + (i - (shot.count - 1) / 2) * 0.3, true);
        break;
      case "lance":
        // an instant beam: it lands the moment it is fired
        if (target) {
          const to = target.pos.clone().setY(target.y + 1);
          for (let i = 0; i <= 10; i++) emitParticles({ position: from.clone().lerp(to, i / 10), color: shot.color, count: 3, speed: 1.2, spread: 0.3, size: 0.2, life: 0.35, gravity: 0 });
          applyShot(target, r, shot.effect, shot.power, shot.color);
        }
        break;
      case "nova":
        // a burst all round: everyone within reach gets it
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          emitParticles({ position: from.clone().add(new THREE.Vector3(Math.sin(a) * 4, -0.6, Math.cos(a) * 4)), color: shot.color, count: 3, speed: 6, spread: 0.6, size: 0.24, life: 0.5, gravity: 0 });
        }
        for (const o of racers) {
          if (o === r || o === ally || gone(o) || Math.abs(o.y - r.y) > 5) continue;
          if (o.pos.distanceToSquared(r.pos) < 15 * 15) applyShot(o, r, shot.effect, shot.power, shot.color);
        }
        break;
      case "mortar":
        // lobbed into the road in front of the target, to be driven into
        if (target) {
          const pd = puddles.find((x) => !x.active);
          if (pd) {
            pd.active = true;
            pd.kind = shot.effect === "slow" ? "slime" : "mine";
            pd.effect = shot.effect;
            pd.power = shot.power;
            pd.ownerId = r.id;
            pd.ignoreUntil = performance.now() + 400;
            pd.life = 9;
            const lead = Math.max(6, Math.abs(target.speed) * 0.45);
            pd.pos.set(target.pos.x + Math.sin(target.heading) * lead, target.groundY + 0.1, target.pos.z + Math.cos(target.heading) * lead);
            emitParticles({ position: pd.pos.clone().setY(pd.pos.y + 3), color: shot.color, count: 14, speed: 2, spread: 0.8, size: 0.24, life: 0.5 });
          }
        }
        break;
    }
    emitParticles({ position: from, color: shot.color, count: 8, speed: 2.5, spread: 0.5, size: 0.18, life: 0.4 });
  }

  /** Two racers become one kart: `a` drives, `b` climbs on top and mans the turret. */
  function fuse(a: Racer, b: Racer) {
    const pair: FusionPair = { driver: a, gunner: b, hp: 1, age: 0, aim: 0, fireCd: 0.6, swapCd: 0.8, lock: null, life: 11 + Math.random() * 7 };
    a.pair = pair;
    b.pair = pair;
    b.riding = true;
    b.isDrifting = false;
    b.driftCharge = 0;
    b.driftLevel = 0;
    b.driftDir = 0;
    b.yaw = 0;
    b.launch = null;
    a.boostTimer = Math.max(a.boostTimer, 0.8);
    a.boostMult = Math.max(a.boostMult, 1.35);
    emitParticles({ position: a.pos.clone().setY(a.y + 1), color: theme.glow, count: 40, speed: 5.5, spread: 1.4, size: 0.26, life: 0.85 });
    emitParticles({ position: b.pos.clone().setY(b.y + 1), color: activeChar(b).primary, count: 22, speed: 4, spread: 1.1, size: 0.2, life: 0.7 });
    if (a.isPlayer || b.isPlayer) {
      addShake(0.35);
      sfx.swap();
    }
  }

  /** The pair comes apart. Broken (health gone) leaves both stunned for three seconds; let go by choice does not. */
  function split(pair: FusionPair, broken: boolean) {
    const { driver, gunner } = pair;
    driver.pair = null;
    gunner.pair = null;
    gunner.riding = false;
    // the gunner drops onto the road beside the kart it was riding
    const room = Math.max(1, driver.half - 2.2);
    const lat = THREE.MathUtils.clamp(driver.lat + (driver.lat > 0 ? -3.4 : 3.4), -room, room);
    placeBody(gunner, driver.path, driver.idx, lat);
    gunner.heading = driver.heading;
    gunner.course = driver.course;
    gunner.speed = driver.speed;
    gunner.t = gunner.prog;
    gunner.aiRoute = driver.aiRoute;
    gunner.aiLat = lat;
    driver.fuseCd = driver.fuseCdMax = broken ? 9 : 5;
    gunner.fuseCd = gunner.fuseCdMax = broken ? 9 : 5;
    if (broken) {
      for (const r of [driver, gunner]) {
        r.stunTimer = 3;
        r.speed *= 0.5;
        r.boostTimer = 0;
        r.boostMult = 1;
      }
      emitParticles({ position: driver.pos.clone().setY(driver.y + 1), color: WEAPON_META.mine.glow, count: 40, speed: 6, spread: 1.8, size: 0.26, life: 0.9 });
    } else {
      emitParticles({ position: driver.pos.clone().setY(driver.y + 1), color: theme.glow, count: 18, speed: 4, spread: 1.2, size: 0.22, life: 0.6 });
    }
    if (driver.isPlayer || gunner.isPlayer) {
      addShake(broken ? 0.5 : 0.2);
      if (broken) sfx.bump();
      else sfx.swap();
    }
  }

  /** The two change seats: whoever was on the turret takes the wheel, on the spot. */
  function swapSeats(pair: FusionPair) {
    const d = pair.driver;
    const g = pair.gunner;
    // the new driver takes over the body exactly where it is
    g.pos.copy(d.pos);
    for (const k of ["y", "vy", "airborne", "heading", "course", "speed", "path", "idx", "safePath", "safeIdx", "groundY", "slopeAlong", "lat", "half", "touching", "mode", "flyOff", "boostTimer", "boostMult", "aiRoute", "aiSeen", "launch"] as const) {
      (g as unknown as Record<string, unknown>)[k] = d[k];
    }
    g.total += progDelta(g.prog, d.prog);
    g.prog = d.prog;
    g.t = g.prog;
    g.steerSmooth = 0;
    g.aiLat = d.lat;
    d.launch = null;
    d.isDrifting = false;
    d.driftCharge = 0;
    d.driftLevel = 0;
    d.driftDir = 0;
    d.yaw = 0;
    d.riding = true;
    g.riding = false;
    pair.driver = g;
    pair.gunner = d;
    pair.aim = 0;
    pair.swapCd = 1;
    pair.lock = null;
    emitParticles({ position: g.pos.clone().setY(g.y + 1.4), color: activeChar(g).primary, count: 24, speed: 4.5, spread: 1.1, size: 0.22, life: 0.6 });
    if (d.isPlayer || g.isPlayer) sfx.swap();
  }

  /** Nearest racer a kart can fuse with: close by, on the same road, free, and not in mid-air on a cannon. */
  function fuseMate(r: Racer): Racer | null {
    let best: Racer | null = null;
    let bd = 13 * 13;
    for (const o of racers) {
      if (o === r || gone(o) || o.pair || o.launch || o.exploding || o.fuseCd > 0 || o.mode !== r.mode) continue;
      // opponents fuse with each other, never by force with the player
      if (o.isPlayer && !r.isPlayer) continue;
      if (Math.abs(o.y - r.y) > 3) continue;
      const d = o.pos.distanceToSquared(r.pos);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /**
   * The gunner's turn. It has no body of its own: it is carried by the driver
   * and keeps the same place on the lap. The player aims with the steering and
   * fires with the item button; an opponent aims and fires by itself.
   */
  function rideAlong(r: Racer, dt: number, controls: ReturnType<typeof poll> | null) {
    const pair = r.pair!;
    const d = pair.driver;
    r.pos.copy(d.pos);
    r.y = d.y;
    r.vy = 0;
    r.airborne = d.airborne;
    r.heading = d.heading;
    r.course = d.course;
    r.speed = d.speed;
    r.path = d.path;
    r.idx = d.idx;
    r.groundY = d.groundY;
    r.lat = d.lat;
    r.half = d.half;
    r.safePath = d.safePath;
    r.safeIdx = d.safeIdx;
    r.mode = d.mode;
    r.total += progDelta(r.prog, d.prog);
    r.prog = d.prog;
    r.t = r.prog;
    r.bestTotal = Math.max(r.bestTotal, r.total);
    countLap(r);
    if (r.stunTimer > 0) r.stunTimer -= dt;

    const shot = fusionShot(activeChar(r).id, d.mode);
    let fire = false;
    if (r.isPlayer && controls) {
      // steering turns the turret, all the way round; the item button or the drift button fires
      pair.aim = wrapAngle(pair.aim - controls.steer * 2.9 * dt);
      fire = controls.item || controls.drift;
      const world = d.heading + pair.aim;
      // lock on to whoever is nearest the line of the barrel
      let best: Racer | null = null;
      let score = 0.42;
      for (const o of racers) {
        if (o === r || o === d || gone(o) || Math.abs(o.y - d.y) > 12) continue;
        const dist = Math.hypot(o.pos.x - d.pos.x, o.pos.z - d.pos.z);
        if (dist > 95 || dist < 2) continue;
        const off = Math.abs(wrapAngle(Math.atan2(o.pos.x - d.pos.x, o.pos.z - d.pos.z) - world));
        const sc = off + dist * 0.0012;
        if (sc < score) {
          score = sc;
          best = o;
        }
      }
      pair.lock = best;
      if (controls.swapPressed && pair.swapCd <= 0) return swapSeats(pair);
      if (controls.fusePressed && pair.age > 0.5) return split(pair, false);
    } else {
      // an opponent on the turret: finds its own target and gives whoever was just hit a respite
      let target = findTurretTarget(d, shot.kind === "rear");
      const spare = AI_PROFILES[settings.aiSkill].mercy * 1000 + 1200;
      if (target && raceClock.current - target.lastHit < spare) target = null;
      pair.lock = target;
      const bearing = target ? wrapAngle(Math.atan2(target.pos.x - d.pos.x, target.pos.z - d.pos.z) - d.heading) : shot.kind === "rear" ? Math.PI : 0;
      pair.aim = wrapAngle(pair.aim + wrapAngle(bearing - pair.aim) * Math.min(1, dt * 7));
      fire = !!target && Math.abs(wrapAngle(bearing - pair.aim)) < 0.3;
    }
    if (fire && pair.fireCd <= 0 && r.stunTimer <= 0 && d.stunTimer <= 0) {
      pair.fireCd = shot.rate;
      fireShot(r, shot, pair.lock, d.heading + pair.aim, d);
      if (r.isPlayer || d.isPlayer) sfx.boost();
    }

    // it rides on top of the driver's kart, turned the way the turret points
    r.visual.current.mode = d.mode === "plane" ? "plane" : "land";
    r.visual.current.gunning = true;
    r.visual.current.boosting = false;
    r.visual.current.shielded = false;
    r.visual.current.stunned = false;
    r.visual.current.steer = 0;
    r.visual.current.speedFrac = 0;
    if (r.group.current) {
      r.group.current.visible = true;
      r.group.current.position.set(d.pos.x, d.y + 1.25, d.pos.z);
      r.group.current.rotation.order = "YXZ";
      r.group.current.rotation.set(0, d.heading + d.yaw + pair.aim, 0);
      r.group.current.scale.setScalar(0.62);
    }
  }

  /** A lap is counted from distance really driven, so reversing over the line gains nothing. */
  function countLap(r: Racer) {
    const lapsNow = Math.floor(r.total);
    if (lapsNow > r.lapsDone) {
      r.lapsDone = lapsNow;
      r.lap = lapsNow + 1;
      hazardState.lap = Math.max(hazardState.lap, r.lap); // the map mutates: hazard patterns shift each lap
      if (r.isPlayer) {
        addShake(0.14);
        sfx.coin();
        emitParticles({ position: r.pos.clone().setY(r.y + 1.4), color: theme.glow, count: 20, speed: 4, spread: 1.4, size: 0.22, life: 0.7 });
      }
    }
  }

  /** Battle: a hit that lands costs a life, and the last life puts you out. */
  function takeLife(r: Racer) {
    if (r.lifeCd > 0 || r.out) return;
    r.lives--;
    r.lifeCd = 1.8;
    emitParticles({ position: r.pos.clone().setY(r.y + 1.6), color: "#ff4d6d", count: 16, speed: 4, spread: 1.2, size: 0.26, life: 0.7 });
    if (r.lives > 0) return;
    r.out = true;
    r.speed = 0;
    if (r.pair) split(r.pair, false);
    if (r.group.current) r.group.current.visible = false;
    emitParticles({ position: r.pos.clone().setY(r.y + 1), color: activeChar(r).primary, count: 50, speed: 8, spread: 2, size: 0.3, life: 1 });
    emitDebris({ position: r.pos.clone().setY(r.y + 0.9), color: activeChar(r).primary, count: 10, speed: 7, spread: 1.5, size: 0.42, life: 4.5 });
  }

  function applyHit(r: Racer, spinner: boolean, by?: Racer) {
    // nobody on your own side can hurt you, and nothing can for a moment after a life goes
    if (battle && by && by !== r && by.team >= 0 && by.team === r.team) return;
    if (battle && r.lifeCd > 0) return;
    if (protectedNow(r)) {
      r.shieldActive = false;
      r.shieldTimer = 0;
      emitParticles({ position: r.pos.clone().setY(r.y + 0.9), color: theme.glow, count: 18, speed: 3.4, spread: 1.3, size: 0.2, life: 0.55 });
      if (r.isPlayer) sfx.item();
      return;
    }
    // A fused pair takes the hit on its shared health. When that runs out
    // nobody is out of the race: they come apart, stunned for three seconds.
    if (r.pair) {
      const pair = r.pair;
      pair.hp -= 0.34;
      pair.driver.lastHit = raceClock.current;
      pair.driver.speed *= 0.86;
      emitParticles({ position: pair.driver.pos.clone().setY(pair.driver.y + 1.2), color: WEAPON_META.zap.glow, count: 16, speed: 3.6, spread: 1.3, size: 0.2, life: 0.55 });
      if (pair.driver.isPlayer || pair.gunner.isPlayer) {
        addShake(0.3);
        sfx.hit();
      }
      if (pair.hp <= 0.01) split(pair, true);
      return;
    }
    // heavy hit -> chance to explode for big destruction
    if (!protectedNow(r) && !r.exploding && Math.random() < 0.15) {
      r.exploding = true;
      r.explodeTimer = 0.8;
      emitParticles({ position: r.pos.clone().setY(r.y + 1.2), color: theme.glow, count: 60, speed: 8, spread: 2, size: 0.3, life: 0.9 });
      emitParticles({ position: r.pos.clone().setY(r.y + 1.2), color: WEAPON_META.quake.glow, count: 40, speed: 10, spread: 2.2, size: 0.26, life: 0.7 });
      // the chassis comes apart: panels in the body's own colours fall to the road
      const body = activeChar(r);
      emitDebris({ position: r.pos.clone().setY(r.y + 0.9), color: body.primary, count: 9, speed: 7, spread: 1.5, size: 0.42, life: 4.5 });
      emitDebris({ position: r.pos.clone().setY(r.y + 0.8), color: body.secondary, count: 6, speed: 5.5, spread: 1.3, size: 0.34, life: 4 });
      emitDebris({ position: r.pos.clone().setY(r.y + 0.7), color: body.accent, count: 5, speed: 9, spread: 1.1, size: 0.26, life: 3.5 });
      if (r.isPlayer) { addShake(0.8); sfx.bump(); }
    }
    r.lastHit = raceClock.current;
    if (r.isPlayer) useGame.getState().setTelemetry({ hitAt: Date.now() });
    r.hitBy = by?.id ?? "";
    if (battle) takeLife(r);
    r.stunTimer = spinner ? 1.25 : 0.95;
    r.speed *= 1 - (spinner ? 0.65 : 0.45) * statsFor(activeChar(r), r.vehicle).grip;
    r.boostTimer = 0;
    r.boostMult = 1;
    emitParticles({ position: r.pos.clone().setY(r.y + 0.7), color: "#ffffff", count: 22, speed: 4.5, spread: 1.6, size: 0.22, life: 0.65 });
    emitParticles({ position: r.pos.clone().setY(r.y + 0.5), color: WEAPON_META.missile.color, count: 12, speed: 3, spread: 1.2, size: 0.2, life: 0.5 });
    if (r.isPlayer) {
      addShake(0.4);
      sfx.hit();
    }
  }

  /**
   * Whether an opponent holding an item should use it now. Attacks need a
   * victim in range who has not just been hit; traps need someone on its tail;
   * speed is kept for a straight.
   */
  function wantsItem(r: Racer, mercy: number, straight: boolean): boolean {
    const fair = (o: Racer | null) => !!o && raceClock.current - o.lastHit > mercy * 1000 && !protectedNow(o);
    const tailed = () => racers.some((o) => o !== r && !gone(o) && r.total - o.total > 0.002 && r.total - o.total < 0.03);
    switch (r.weapon) {
      case "orb":
        return straight && r.boostTimer <= 0;
      case "missile":
        return fair(findTargetAhead(r, 0.25));
      case "beam":
        return fair(findTargetAhead(r, 0.12));
      case "zap":
        return fair(findTargetAhead(r, 0.28));
      case "swap":
        return fair(findTargetAhead(r, 0.45));
      case "magnet":
        return !!findTargetAhead(r, 0.08);
      case "slime":
      case "mine":
        return tailed();
      case "bubble":
        return !r.shieldActive && (tailed() || !!findTargetAhead(r, 0.05));
      case "ghost":
        return r.ghostTimer <= 0 && (tailed() || !straight);
      case "quake":
        return racers.some((o) => o !== r && !gone(o) && Math.abs(o.total - r.total) < 0.15 && fair(o));
      case "freeze":
        return fair(findTargetAhead(r, 0.25));
      case "steal":
        return racers.some((o) => o !== r && !gone(o) && !!o.weapon && o.total > r.total && o.total - r.total < 0.4 && fair(o));
      case "popup":
        return racers.some((o) => o !== r && !gone(o) && o.total > r.total && fair(o));
      case "giant":
        return racers.some((o) => o !== r && !gone(o) && Math.abs(o.total - r.total) < 0.04);
      case "warp":
        return straight && r.path === 0 && r.mode === "land";
      case "wave":
        return racers.some((o) => o !== r && !gone(o) && o.mode === r.mode && o.pos.distanceToSquared(r.pos) < 100 && fair(o));
      default:
        return true;
    }
  }

  function fireWeapon(r: Racer, preferredTarget?: string | null, back = false) {
    const w = r.weapon;
    if (!w) return;
    r.weapon = null;
    if (r.isPlayer) useGame.getState().setTelemetry({ weapon: null });
    const col = WEAPON_META[w].color;
    if (w === "orb") {
      r.boostTimer = 1.25;
      r.boostMult = 1.62;
      if (r.isPlayer) {
        r.boostsUsed++;
        addShake(0.25);
        sfx.boost();
      }
      emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: col, count: 24, speed: 4.5, spread: 0.9, size: 0.22, life: 0.55 });
    } else if (w === "missile" && back) {
      // fired over the shoulder with the brake held: it goes for whoever is on your tail
      const chaser = findTargetBehind(r, 0.2);
      const shot = spawnProjectile("missile", r, chaser ? chaser.id : null, Math.PI);
      if (shot) shot.life = 3.4;
      if (r.isPlayer) {
        addShake(0.18);
        sfx.boost();
      }
      emitParticles({ position: r.pos.clone().setY(r.y + 0.7), color: col, count: 14, speed: 3, spread: 0.5, size: 0.18, life: 0.4 });
    } else if (w === "missile") {
      // a missile runs along the road after whoever is in front: round the bends,
      // up the spiral and over the bridge, it does not fly off at the first corner
      const auto = findTargetAhead(r, 0.45);
      const target = preferredTarget && racers.some((x) => x.id === preferredTarget) ? { id: preferredTarget } : auto;
      const shot = spawnProjectile("missile", r, target ? target.id : null);
      if (shot && r.mode !== "plane") {
        shot.road = true;
        shot.homing = false;
        shot.path = r.path;
        shot.idx = r.idx + 2;
        shot.lat = r.lat;
        shot.life = 8;
      }
      if (r.isPlayer) {
        r.boostsUsed++;
        addShake(0.18);
        sfx.boost();
      }
      emitParticles({ position: r.pos.clone().setY(r.y + 0.7), color: col, count: 14, speed: 3, spread: 0.5, size: 0.18, life: 0.4 });
    } else if (w === "bubble") {
      r.shieldActive = true;
      r.shieldTimer = 7;
      if (r.isPlayer) sfx.item();
      emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: col, count: 16, speed: 2.2, spread: 1.1, size: 0.2, life: 0.55 });
    } else if (w === "slime") {
      const puddle = puddles.find((p) => !p.active);
      if (puddle) {
        const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
        puddle.active = true;
        puddle.effect = null;
        puddle.kind = "slime";
        puddle.ownerId = r.id;
        puddle.ignoreUntil = performance.now() + 1000;
        puddle.life = 14;
        puddle.pos.copy(r.pos).addScaledVector(fwd, -2.6).setY(r.groundY + 0.08);
      }
      if (r.isPlayer) sfx.item();
    } else if (w === "beam") {
      const target = findTargetAhead(r, 0.14);
      if (target) {
        const stolen = Math.abs(target.speed) * 0.42;
        target.speed *= 0.58;
        target.stunTimer = Math.max(target.stunTimer, 0.4);
        r.speed += stolen;
        r.boostTimer = 0.9;
        r.boostMult = Math.max(r.boostMult, 1.45);
        beamFrom.current.copy(r.pos).setY(r.y + 0.8);
        beamTo.current.copy(target.pos).setY(target.y + 0.8);
        beamTimer.current = 0.4;
        for (let i = 0; i < 8; i++) {
          const p = beamFrom.current.clone().lerp(beamTo.current, i / 8);
          emitParticles({ position: p, color: col, count: 3, speed: 1.4, spread: 0.4, size: 0.16, life: 0.4 });
        }
        if (target.isPlayer) addShake(0.3);
        if (r.isPlayer) {
          r.boostsUsed++;
          addShake(0.22);
          sfx.swap();
        }
      } else {
        r.boostTimer = 0.5;
        r.boostMult = Math.max(r.boostMult, 1.2);
      }
    } else if (w === "zap") {
      // lightning: chain-stun up to 3 rivals ahead
      let hits = 0;
      const my = r.total;
      for (const o of racers) {
        if (o === r || gone(o) || hits >= 3) continue;
        const gap = o.total - my;
        if (gap > 0.004 && gap < 0.3) {
          hits++;
          if (!protectedNow(o)) {
            o.stunTimer = Math.max(o.stunTimer, 1.0);
            o.speed *= 0.55;
            const p0 = r.pos.clone().setY(r.y + 1);
            const p1 = o.pos.clone().setY(o.y + 1);
            for (let i = 0; i < 6; i++) {
              emitParticles({ position: p0.clone().lerp(p1, i / 6), color: WEAPON_META.zap.color, count: 3, speed: 2, spread: 0.5, size: 0.16, life: 0.4, gravity: 0 });
            }
            if (o.isPlayer) addShake(0.35);
          } else {
            o.shieldActive = false;
            o.shieldTimer = 0;
          }
        }
      }
      if (r.isPlayer) {
        addShake(0.2);
        sfx.hit();
      }
      emitParticles({ position: r.pos.clone().setY(r.y + 1), color: WEAPON_META.zap.glow, count: 22, speed: 4, spread: 1.2, size: 0.2, life: 0.55 });
    } else if (w === "mine") {
      const mine = puddles.find((p) => !p.active);
      if (mine) {
        const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
        mine.active = true;
        mine.effect = null;
        mine.kind = "mine";
        mine.ownerId = r.id;
        mine.ignoreUntil = performance.now() + 1100;
        mine.life = 16;
        mine.pos.copy(r.pos).addScaledVector(fwd, -3.2).setY(r.groundY + 0.12);
      }
      if (r.isPlayer) sfx.item();
    } else if (w === "swap") {
      // position swap: trade places with the racer right in front
      const target = r.pair ? null : findTargetAhead(r, 0.5);
      // trading places needs both karts to be mine to move
      if (target && !target.pair && !target.remote) {
        const myPos = r.pos.clone();
        r.pos.copy(target.pos);
        target.pos.copy(myPos);
        // everything that says where on the lap a car is changes hands with it
        for (const k of ["t", "lap", "lapsDone", "heading", "y", "vy", "airborne", "path", "idx", "prog", "total", "bestTotal", "safePath", "safeIdx", "groundY"] as const) {
          const mine = r[k];
          (r as unknown as Record<string, unknown>)[k] = target[k];
          (target as unknown as Record<string, unknown>)[k] = mine;
        }
        [r.mode, target.mode] = [target.mode, r.mode];
        r.swapInvuln = 1;
        target.swapInvuln = 0.6;
        emitParticles({ position: r.pos.clone().setY(r.y + 1), color: col, count: 32, speed: 5.5, spread: 1.5, size: 0.24, life: 0.8 });
        emitParticles({ position: target.pos.clone().setY(target.y + 1), color: col, count: 32, speed: 5.5, spread: 1.5, size: 0.24, life: 0.8 });
        if (r.isPlayer || target.isPlayer) addShake(0.45);
        if (r.isPlayer) sfx.swap();
      }
    } else if (w === "magnet") {
      // coin magnet + slipstream pull toward the racer ahead
      r.magnetTimer = 6;
      r.boostTimer = Math.max(r.boostTimer, 0.6);
      r.boostMult = Math.max(r.boostMult, 1.25);
      emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: col, count: 22, speed: 3.4, spread: 1.2, size: 0.2, life: 0.6 });
      if (r.isPlayer) sfx.item();
    } else if (w === "ghost") {
      // phase mode: untouchable + can cut through walls for a while
      r.ghostTimer = 5;
      r.swapInvuln = Math.max(r.swapInvuln, 5);
      emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: col, count: 26, speed: 3, spread: 1.3, size: 0.22, life: 0.7 });
      if (r.isPlayer) sfx.item();
    } else if (w === "quake") {
      // ground slam: everyone on the same lap section gets bounced
      for (const o of racers) {
        if (o === r || gone(o)) continue;
        if (Math.abs(o.total - (r.total)) > 0.2) continue;
        if (protectedNow(o)) continue;
        o.stunTimer = Math.max(o.stunTimer, 0.9);
        o.speed *= 0.6;
        // thrown into the air for real
        o.vy = 7;
        o.airborne = true;
        emitParticles({ position: o.pos.clone().setY(o.y + 0.5), color: col, count: 16, speed: 4, spread: 1.4, size: 0.22, life: 0.6 });
        if (o.isPlayer) addShake(0.4);
      }
      for (let i = 0; i < 4; i++) {
        emitParticles({ position: r.pos.clone().setY(r.groundY + 0.2), color: WEAPON_META.quake.glow, count: 14, speed: 6 + i, spread: 2.2, size: 0.24, life: 0.7, upBias: 0.2 });
      }
      if (r.isPlayer) {
        addShake(0.55);
        sfx.hit();
      }
    } else if (w === "freeze") {
      // ice: the racer in front is frozen where it is
      const target = findTargetAhead(r, 0.3);
      if (target && !protectedNow(target)) {
        target.frozenTimer = 1.7;
        target.lastHit = raceClock.current;
        emitParticles({ position: target.pos.clone().setY(target.y + 1), color: col, count: 30, speed: 3, spread: 1.4, size: 0.24, life: 0.8, gravity: 0 });
        if (target.isPlayer) {
          addShake(0.3);
          sfx.hit();
        }
      } else if (target) {
        target.shieldActive = false;
        target.shieldTimer = 0;
      }
      if (r.isPlayer) sfx.item();
    } else if (w === "steal") {
      // thief: takes the item of the nearest racer ahead who has one, or failing that some coins
      let victim: Racer | null = null;
      let near = 0.5;
      for (const o of racers) {
        const gap = o.total - r.total;
        if (o !== r && !gone(o) && !o.remote && o.weapon && gap > 0 && gap < near && !protectedNow(o)) {
          near = gap;
          victim = o;
        }
      }
      if (victim) {
        if (r.weapon2) r.weapon = victim.weapon;
        else r.weapon2 = victim.weapon;
        victim.weapon = null;
        if (victim.isPlayer) useGame.getState().setTelemetry({ weapon: null });
        if (r.isPlayer) useGame.getState().setTelemetry({ weapon: r.weapon });
        emitParticles({ position: victim.pos.clone().setY(victim.y + 1), color: col, count: 20, speed: 4, spread: 1.2, size: 0.22, life: 0.6 });
      } else {
        const rich = findTargetAhead(r, 0.3);
        if (rich) {
          const n = Math.min(rich.coins, 4);
          rich.coins -= n;
          r.coins += n;
        }
      }
      if (r.isPlayer) sfx.swap();
    } else if (w === "popup") {
      // error windows over the screen of everyone ahead
      for (const o of racers) {
        const gap = o.total - r.total;
        if (o === r || gone(o) || gap <= 0 || gap > 0.5 || protectedNow(o)) continue;
        blind(o, 3.2);
        emitParticles({ position: o.pos.clone().setY(o.y + 1.4), color: col, count: 10, speed: 2, spread: 1, size: 0.3, life: 0.6, gravity: 0 });
      }
      if (r.isPlayer) sfx.item();
    } else if (w === "giant") {
      // grow: faster, nothing sticks to it, and it flattens whoever it touches
      r.giantTimer = 6;
      r.stunTimer = 0;
      r.slowTimer = 0;
      r.frozenTimer = 0;
      r.burnTimer = 0;
      emitParticles({ position: r.pos.clone().setY(r.y + 1), color: col, count: 34, speed: 5, spread: 1.6, size: 0.28, life: 0.8 });
      if (r.isPlayer) {
        addShake(0.3);
        sfx.boost();
      }
    } else if (w === "warp") {
      // jump a stretch further down the main road, onto a place it is safe to land
      emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: col, count: 28, speed: 5, spread: 1.4, size: 0.24, life: 0.6 });
      placeBody(r, 0, safeAhead(mainIndexAt(r.prog + 0.035)));
      r.t = r.prog;
      r.course = r.heading;
      r.speed = Math.max(r.speed, statsFor(activeChar(r), r.vehicle).maxSpeed * 0.9);
      r.boostTimer = Math.max(r.boostTimer, 0.9);
      r.boostMult = Math.max(r.boostMult, 1.4);
      r.launch = null;
      emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: WEAPON_META.warp.glow, count: 28, speed: 5, spread: 1.4, size: 0.24, life: 0.6 });
      if (r.isPlayer) {
        addShake(0.3);
        sfx.swap();
      }
    } else if (w === "wave") {
      // shockwave: shove and slow everyone close by
      emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: WEAPON_META.wave.color, count: 34, speed: 6, spread: 2, size: 0.24, life: 0.6 });
      for (const o of racers) {
        if (o === r || gone(o)) continue;
        const d = o.pos.distanceTo(r.pos);
        if (d < 11 && r.mode === o.mode) {
          const dir = o.pos.clone().sub(r.pos).setY(0).normalize();
          o.pos.addScaledVector(dir, 4.2);
          o.slowTimer = Math.max(o.slowTimer, 1.2);
          o.speed *= 0.75;
          if (!protectedNow(o)) o.stunTimer = Math.max(o.stunTimer, 0.35);
          emitParticles({ position: o.pos.clone().setY(o.y + 0.7), color: WEAPON_META.wave.glow, count: 12, speed: 3, spread: 1, size: 0.18, life: 0.5 });
          if (o.isPlayer) addShake(0.3);
        }
      }
      if (r.isPlayer) {
        addShake(0.3);
        sfx.boost();
      }
    }
  }

  function updateRacer(r: Racer, dt: number, controls: ReturnType<typeof poll> | null) {
    // riding on the turret of someone else's kart: aim and fire, nothing else
    if (r.pair && r.pair.gunner === r) return rideAlong(r, dt, controls);

    const char = activeChar(r);
    const st = statsFor(char, r.vehicle);
    if (r.pair) {
      r.pair.age += dt;
      r.pair.fireCd -= dt;
      r.pair.swapCd -= dt;
      // two opponents go their own ways again after a while
      if (!r.pair.driver.isPlayer && !r.pair.gunner.isPlayer && r.pair.age > r.pair.life) split(r.pair, false);
    }

    // ---- timers ----
    if (r.stunTimer > 0) r.stunTimer -= dt;
    if (r.slowTimer > 0) r.slowTimer -= dt;
    if (r.boostTimer > 0) {
      r.boostTimer -= dt;
      if (r.boostTimer <= 0) r.boostMult = 1;
    }
    if (r.shieldTimer > 0) {
      r.shieldTimer -= dt;
      if (r.shieldTimer <= 0) r.shieldActive = false;
    }
    if (r.swapInvuln > 0) r.swapInvuln -= dt;
    if (r.tagCooldown > 0) r.tagCooldown -= dt;
    if (r.fuseCd > 0) r.fuseCd -= dt;
    // ---- the partner on the turret: finds its own target, turns to it and fires ----
    if (r.turretTimer > 0) {
      // an upgrade works for anyone, on their own character's shot if they have no partner
      const gunner = (r.activeIsPartner ? r.main : r.partner) ?? (r.turretMod ? r.main : null);
      r.turretTimer -= dt;
      if (r.turretCd > 0) r.turretCd -= dt;
      if (!gunner || r.pair || r.turretTimer <= 0) {
        r.turretTimer = 0;
        // an upgrade costs nothing when it runs out; the partner's own turret costs the long wait
        if (!r.turretMod) r.fuseCd = r.fuseCdMax = SOLO_COOLDOWN;
        r.turretMod = null;
      } else {
        const base = fusionShot(gunner.id, r.mode);
        const shot = r.turretMod ? upgraded(base, r.turretMod) : base;
        const target = findTurretTarget(r, shot.kind === "rear");
        const bearing = target ? wrapAngle(Math.atan2(target.pos.x - r.pos.x, target.pos.z - r.pos.z) - r.heading) : shot.kind === "rear" ? Math.PI : 0;
        r.turretAim = wrapAngle(r.turretAim + wrapAngle(bearing - r.turretAim) * Math.min(1, dt * 6));
        if (target && r.turretCd <= 0 && r.stunTimer <= 0 && !r.launch && Math.abs(wrapAngle(bearing - r.turretAim)) < 0.3) {
          r.turretCd = shot.rate * (r.turretMod ? 1 : SOLO_RATE);
          fireShot(r, r.turretMod ? shot : { ...shot, power: shot.power * SOLO_POWER, count: Math.max(1, Math.ceil(shot.count / 2)) }, target, r.heading + r.turretAim, null);
          if (r.isPlayer) sfx.click();
        }
      }
    }
    if (r.bumpCd > 0) r.bumpCd -= dt;
    for (let i = 0; i < r.ringCd.length; i++) if (r.ringCd[i] > 0) r.ringCd[i] -= dt;
    if (r.padCd > 0) r.padCd -= dt;
    if (r.aiMistake > 0) r.aiMistake -= dt;
    else if (!r.isPlayer && Math.random() < AI_PROFILES[useGame.getState().settings.aiSkill].hesitate * dt) r.aiMistake = 0.6 + Math.random() * 0.6;
    if (r.portalCd > 0) r.portalCd -= dt;
    if (r.magnetTimer > 0) r.magnetTimer -= dt;
    if (r.ghostTimer > 0) r.ghostTimer -= dt;
    if (r.giantTimer > 0) r.giantTimer -= dt;
    if (r.rollTimer > 0) r.rollTimer -= dt;
    // the item in waiting comes to hand as soon as the hand is empty
    if (!r.weapon && r.weapon2) {
      r.weapon = r.weapon2;
      r.weapon2 = null;
    }
    if (r.burnTimer > 0) r.burnTimer -= dt;
    if (r.frozenTimer > 0) {
      // frozen solid: no drive, no steering, and it grinds to a halt
      r.frozenTimer -= dt;
      r.stunTimer = Math.max(r.stunTimer, 0.1);
      r.speed *= Math.max(0, 1 - 4 * dt);
      if (frame.current % 4 === 0) emitParticles({ position: r.pos.clone().setY(r.y + 0.9), color: "#e0f2fe", count: 2, speed: 0.8, spread: 0.8, size: 0.2, life: 0.5, gravity: 0 });
    }

    // ---- fired by a cannon: a scripted arc, nothing else happens until it lands ----
    if (r.launch) {
      const L = r.launch;
      L.e = Math.min(1, L.e + dt / L.dur);
      const ease = L.e * L.e * (3 - 2 * L.e);
      const before = r.y;
      r.pos.lerpVectors(L.from, L.to, ease);
      r.y = r.pos.y + Math.sin(L.e * Math.PI) * L.lift;
      r.pos.y = r.y;
      r.heading += wrapAngle(Math.atan2(L.to.x - L.from.x, L.to.z - L.from.z) - r.heading) * Math.min(1, dt * 6);
      r.pitch = THREE.MathUtils.lerp(r.pitch, THREE.MathUtils.clamp((r.y - before) / Math.max(1e-3, dt) / 50, -0.7, 0.7), 0.2);
      if (frame.current % 2 === 0) emitParticles({ position: r.pos.clone(), color: theme.glow, count: 2, speed: 0.8, spread: 0.3, size: 0.22, life: 0.5, gravity: 0 });
      if (L.e >= 1) {
        r.launch = null;
        placeBody(r, 0, L.idx);
        r.t = r.prog;
        r.speed = st.maxSpeed;
        r.boostTimer = Math.max(r.boostTimer, 1.2);
        r.boostMult = Math.max(r.boostMult, 1.45);
        r.padCd = 1;
        emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: theme.glow, count: 30, speed: 5, spread: 1.4, size: 0.24, life: 0.7 });
        if (r.isPlayer) {
          addShake(0.3);
          sfx.bump();
        }
      }
      r.visual.current.boosting = true;
      r.visual.current.speedFrac = 1;
      r.visual.current.steer = 0;
      if (r.group.current) {
        r.group.current.position.set(r.pos.x, r.y, r.pos.z);
        r.group.current.rotation.order = "YXZ";
        r.group.current.rotation.y = r.heading;
        r.group.current.rotation.x = -r.pitch;
      }
      return;
    }

    // ---- zone / mode ----
    const zone = zoneAt(r.t);
    const newMode: VehicleMode = !zone ? "land" : zone.type === "water" ? "boat" : zone.type === "sub" ? "sub" : zone.type === "mag" ? "hover" : "plane";
    if (newMode !== r.mode) {
      r.mode = newMode;
      if (r.isPlayer) {
        addShake(0.18);
        sfx.swap();
        emitParticles({
          position: r.pos.clone().setY(r.y + 0.6),
          color: newMode === "boat" ? theme.water : theme.glow,
          count: 26,
          speed: 4,
          spread: 1.2,
          size: 0.22,
          life: 0.7,
        });
      }
    }
    // plane and submarine both move freely up and down inside their stretch
    const flight = r.mode === "plane" ? FLIGHT.sky : r.mode === "sub" ? FLIGHT.sub : null;
    const inSky = flight && zone ? (r.t - zone.t0) / (zone.t1 - zone.t0) : 0;

    // ---- input ----
    let steerIn = 0;
    let throttleIn = 0;
    let driftHeld = false;
    let itemPressed = false;
    let itemBack = false;
    let swapPressed = false;
    let fusePressed = false;
    let turboPressed = false;

    if (r.isPlayer && controls) {
      // camera faces +z, so screen-right = -x: negate input so D/→ turns right
      steerIn = -controls.steer;
      throttleIn = controls.throttle;
      driftHeld = controls.drift;
      itemPressed = controls.itemPressed;
      // brake held as the item goes: it is thrown backwards
      itemBack = controls.throttle < 0;
      swapPressed = controls.swapPressed;
      fusePressed = controls.fusePressed;
      turboPressed = controls.turboPressed;
      if (settings.autoGas && throttleIn === 0 && r.stunTimer <= 0) throttleIn = 1;
      // in the air the pedals fly the plane: up climbs, down dives, the engine runs by itself
      if (flight) {
        r.flyOff = THREE.MathUtils.clamp(r.flyOff + controls.throttle * (r.mode === "plane" ? 12 : 8) * dt, flight.down, flight.up);
        throttleIn = r.stunTimer > 0 ? 0 : 1;
      }
    } else if (!r.isPlayer) {
      // every opponent drives properly whatever the level: the level decides how
      // hard it pushes and how much it gets out of each thing it does
      const ai = AI_PROFILES[useGame.getState().settings.aiSkill];
      const all = getPaths();

      // route choice: decided once per junction, a little before reaching it
      if (r.aiSeen > 0 && (!all[r.aiSeen] || progDelta(all[r.aiSeen].t0, r.prog) > 0.05)) r.aiSeen = -1;
      if (r.aiRoute === 0) {
        for (let k = 1; k < all.length; k++) {
          const rel = progDelta(all[k].t0, r.prog);
          if (rel > -0.03 && rel < 0 && r.aiSeen !== k) {
            r.aiSeen = k;
            // a cut with no barriers is a gamble the careful levels rarely take
            if (Math.random() < (all[k].def?.kind === "cut" ? ai.cutUse : ai.routeUse)) r.aiRoute = k;
          }
        }
      }

      // ---- the line: inside of the bend it is in, by as much as the level dares ----
      const room = Math.max(1, r.half - 2.6);
      const near = bendAhead(r.path, r.idx, 55);
      const far = bendAhead(r.path, r.idx, 120);
      // +lateral is the right-hand side of the road, and a bend to the left is negative: same sign
      let line = Math.sign(near) * Math.min(1, Math.abs(near) / 0.7) * ai.line * room + r.aiLane * (1 - Math.min(1, Math.abs(near) / 0.5));

      // a drift slides the kart towards the inside by itself: go in from the middle of the road
      if (Math.abs(near) >= ai.driftFrom || r.isDrifting) line *= 0.2;

      // unit vectors of the road under it, to place things relative to its own lane
      const here = all[r.path] ?? all[0];
      const hi = Math.min(here.n - 1, Math.max(0, r.idx));
      const tx = here.tx[hi];
      const tz = here.tz[hi];
      const reach = 16 + Math.abs(r.speed) * 0.9;

      // a boost pad coming up on this road is worth a change of line
      for (const pad of pads) {
        if (pad.kind === "cannon" || Math.abs(pad.pos.y - r.y) > 3) continue;
        const dx = pad.pos.x - r.pos.x;
        const dz = pad.pos.z - r.pos.z;
        const ahead = dx * tx + dz * tz;
        if (ahead < 4 || ahead > 75) continue;
        const padLat = r.lat + (-dx * tz + dz * tx);
        if (Math.abs(padLat) < room + 1) line = padLat;
      }

      // ---- go round whatever is in the way: traffic, hazards, mines, slower karts ----
      const dodge = (x: number, y: number, z: number, radius: number) => {
        if (Math.abs(y - r.y) > 3) return;
        const dx = x - r.pos.x;
        const dz = z - r.pos.z;
        const ahead = dx * tx + dz * tz;
        if (ahead < 1 || ahead > reach) return;
        const at = r.lat + (-dx * tz + dz * tx);
        const clear = radius + 2.3;
        if (Math.abs(at - line) > clear) return;
        // pass on the side with more road
        const left = at + clear;
        const right = at - clear;
        line = left <= room && (right < -room || Math.abs(left - line) <= Math.abs(right - line)) ? left : right >= -room ? right : at > 0 ? -room : room;
      };
      for (const tr of traffic) dodge(tr.pos.x, tr.pos.y, tr.pos.z, 1.6);
      if (r.mode === "land") for (const hz of hazardState.positions) dodge(hz.x, hz.y, hz.z, 1.4);
      for (const pd of puddles) if (pd.active && pd.ownerId !== r.id) dodge(pd.pos.x, pd.pos.y, pd.pos.z, 1.1);
      for (const o of racers) if (o !== r && !gone(o) && o.speed < r.speed - 2) dodge(o.pos.x, o.y, o.pos.z, 0.9);

      line = THREE.MathUtils.clamp(line, -room, room);
      r.aiLat += (line - r.aiLat) * Math.min(1, dt * 3.5);

      // aim along the road it is taking, in 3D: the bridge and the road under it are different roads
      // look less far ahead inside a bend, or the aim point cuts the corner for it
      const lookDist = 9 + Math.abs(r.speed) * (Math.abs(near) > 0.4 ? 0.3 : 0.5);
      r.aiRoute = aimAhead(r, r.aiRoute, lookDist, THREE.MathUtils.clamp(r.aiLat / room, -0.95, 0.95), aimV);
      // an aim point that is not in front is one it would circle for ever: take the main road instead
      if (r.aiRoute > 0 && (aimV.x - r.pos.x) * tx + (aimV.z - r.pos.z) * tz < 3) {
        r.aiRoute = 0;
        aimAhead(r, 0, lookDist, THREE.MathUtils.clamp(r.aiLat / room, -0.95, 0.95), aimV);
      }
      const desired = Math.atan2(aimV.x - r.pos.x, aimV.z - r.pos.z);
      // sliding, where it is going is not where the nose points: aim with a bit of both
      const err = wrapAngle(desired - (r.isDrifting ? r.heading - wrapAngle(r.heading - r.course) * 0.6 : r.heading));
      // steer at the aim point, and lean back towards the line it is meant to be on
      // (+lateral is to the right, and steering right is negative)
      steerIn = THREE.MathUtils.clamp(err * 3.4 - (r.aiLat - r.lat) * 0.09, -1, 1);

      // flying or diving: line up with the next ring on the line it is on
      if (flight) {
        let want = 0;
        let next = 0.2;
        for (const ring of skyRings) {
          if (ring.path !== r.path) continue;
          const d = progDelta(r.prog, ring.prog);
          if (d > 0 && d < next) {
            next = d;
            want = ring.offset - flight.base;
          }
        }
        r.flyOff += THREE.MathUtils.clamp(want * (0.7 + 0.3 * ai.line) - r.flyOff, -10 * dt, 10 * dt);
      }

      // ---- throttle: flat out, except pointing the wrong way, hesitating, or late off the line ----
      throttleIn = Math.abs(err) > 0.8 ? 0.55 : 1;
      if (r.aiMistake > 0) throttleIn = Math.min(throttleIn, 0.65);
      if (raceClock.current < ai.reaction * 1000 * (0.6 + ((r.aiLane + 1.4) / 2.8) * 0.8)) throttleIn = 0;
      if (r.stunTimer > 0) throttleIn = 0;

      // ---- drift through the bends that are worth it, for as long as the level holds one ----
      const onRoad = r.mode !== "plane" && !r.airborne && !r.touching && r.aiMistake <= 0;
      // never into a jump: the road has to be whole for a good way ahead
      // and never where there are no barriers to catch a slide
      const whole = r.path === 0 ? plainRoadAt(r.prog + 35 / all[0].length, 45) : !all[r.path].def?.holes?.length && all[r.path].def?.walls !== false;
      if (!r.isDrifting) {
        driftHeld = onRoad && whole && Math.abs(near) >= ai.driftFrom && steerIn * -near > 0 && Math.abs(r.steerSmooth) > 0.3;
      } else {
        // let go at the exit of the bend, once it has what this level comes for,
        // or when the road wants it to turn the other way
        driftHeld = onRoad && whole && r.driftCharge < ai.driftHold && Math.abs(bendAhead(r.path, r.idx, 26)) > 0.14 && steerIn * r.driftDir > -0.2;
        // in a drift the wheel sets how tight the arc is, so ask for the arc that gives the turn it wants
        steerIn = r.driftDir * THREE.MathUtils.clamp((steerIn * r.driftDir - 0.3) / 0.55, -1, 1);
      }

      // ---- turbo: on a straight, once the bar is where this level likes it ----
      turboPressed = r.turboMeter >= Math.min(0.99, ai.turboAt) && Math.abs(far) < 0.3 && onRoad && whole && r.boostTimer <= 0;

      // ---- catch-up: by how much it presses on when you are ahead, and eases off when you are behind ----
      const gap = racers[0].total - r.total;
      r.aiMult = 1 + mode.rubberband * (ai.catchUp * THREE.MathUtils.clamp(gap / 0.15, 0, 1) - ai.wait * THREE.MathUtils.clamp(-gap / 0.2, 0, 1));

      // ---- items: each one used for what it is for ----
      if (r.weapon) {
        r.aiWeaponDelay -= dt;
        if (r.aiWeaponDelay <= 0 && r.rollTimer <= 0 && wantsItem(r, ai.mercy, Math.abs(far) < 0.35)) itemPressed = true;
        // out in front with a missile and somebody on its tail: over the shoulder it goes
        else if (r.aiWeaponDelay <= 0 && r.rollTimer <= 0 && r.weapon === "missile" && !findTargetAhead(r, 0.45)) {
          const chaser = findTargetBehind(r, 0.035);
          if (chaser && raceClock.current - chaser.lastHit > ai.mercy * 1000 && !protectedNow(chaser)) {
            itemPressed = true;
            itemBack = true;
          }
        }
      } else {
        r.aiWeaponDelay = ai.itemDelay * (0.7 + Math.random() * 0.6);
      }

      // ---- fusion: with someone to shoot at and the partner ready ----
      if (!session && !r.pair && r.fuseCd <= 0 && raceClock.current > 12000 && Math.random() < ai.fuse * dt) fusePressed = true;
    }

    if (r.stunTimer > 0) {
      throttleIn = 0;
      steerIn *= 0.25;
    }

    // ---- smoothed steering (comfortable, analog-like) ----
    const response = settings.steerAssist ? 9.5 : 7;
    r.steerSmooth += (steerIn - r.steerSmooth) * Math.min(1, dt * response);

    // ---- drift ----
    // Holding drift into a bend commits the kart to that side with a hop. From
    // then on it keeps turning that way whatever the wheel does: steering into
    // the bend tightens the arc, steering out of it opens it. The nose swings
    // into the turn, sparks come off the back, and the longer and tighter it is
    // held the higher the mini-turbo it pays on release, in three levels.
    {
      const canDrift = !r.airborne && (r.mode === "land" || r.mode === "boat" || r.mode === "hover") && r.speed > st.maxSpeed * 0.32 && r.stunTimer <= 0;
      if (!r.isDrifting && driftHeld && canDrift && Math.abs(r.steerSmooth) > 0.25) {
        r.isDrifting = true;
        r.driftDir = r.steerSmooth > 0 ? 1 : -1;
        r.driftAge = 0;
        r.driftCharge = 0;
        r.driftLevel = 0;
        r.hop = 0.24;
        // the tail steps out at once: the nose is into the bend before the kart is
        r.heading += r.driftDir * 0.14;
        if (r.isPlayer) sfx.click();
      }
      if (r.isDrifting && driftHeld && r.speed > st.maxSpeed * 0.25 && (r.mode === "land" || r.mode === "boat" || r.mode === "hover") && r.stunTimer <= 0) {
        r.driftAge += dt;
        // -1 steering out of the bend .. +1 steering into it
        const into = r.steerSmooth * r.driftDir;
        // tighter charges faster; good handling and a fin charge faster still
        r.driftCharge = Math.min(1.7, r.driftCharge + dt * st.driftRate * (0.75 + Math.max(0, into) * 0.5));
        r.turboMeter = Math.min(1, r.turboMeter + dt * 0.3 * st.turboRate);
        const level = r.driftCharge >= DRIFT_LEVELS[2] ? 3 : r.driftCharge >= DRIFT_LEVELS[1] ? 2 : r.driftCharge >= DRIFT_LEVELS[0] ? 1 : 0;
        if (level > r.driftLevel) {
          // each level announces itself: a flash of its colour, and a click you can time the release to
          r.driftLevel = level;
          emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: DRIFT_COLOURS[level - 1], count: 14, speed: 3.5, spread: 0.9, size: 0.2, life: 0.4 });
          if (r.isPlayer) {
            sfx.click();
            addShake(0.06 * level);
          }
        }
        // sparks off the back wheels, in the colour of the level reached
        if (frame.current % 2 === 0 && !r.airborne) {
          const nose = r.heading + r.yaw;
          const colour = r.driftLevel ? DRIFT_COLOURS[r.driftLevel - 1] : "#ffffff";
          for (const side of [-0.75, 0.75]) {
            const wx = r.pos.x - Math.sin(nose) * 1.1 + Math.cos(nose) * side;
            const wz = r.pos.z - Math.cos(nose) * 1.1 - Math.sin(nose) * side;
            emitParticles({
              position: new THREE.Vector3(wx, r.y + 0.2, wz),
              color: colour, count: 1, speed: 2.4, spread: 0.6, size: 0.12 + r.driftLevel * 0.03, life: 0.28,
            });
            // rubber on the road, and the smoke that comes off it; a hull leaves spray
            if (r.mode === "land") laySkid(wx, r.y, wz, r.course, r.slopeAlong, Math.abs(r.speed) * dt * 2.3);
            if (frame.current % 4 === 0)
              emitParticles({
                position: new THREE.Vector3(wx, r.y + 0.25, wz),
                color: r.mode === "boat" ? "#e0f7ff" : "#e8e8ee", count: 1, speed: 0.9, spread: 0.9, size: 0.34, life: 0.55, upBias: 1.1, gravity: r.mode === "boat" ? 9 : -1.5,
              });
          }
        }
      } else if (r.isDrifting) {
        // let go: the charge becomes a mini-turbo, and the nose comes back round
        r.isDrifting = false;
        if (r.driftLevel > 0 && r.stunTimer <= 0) {
          const [time, power, bar] = DRIFT_BOOST[r.driftLevel - 1];
          r.boostTimer = Math.max(r.boostTimer, time * st.boostTime);
          r.boostMult = Math.max(r.boostMult, 1 + (power - 1) * st.boostPower);
          r.turboMeter = Math.min(1, r.turboMeter + bar * st.turboRate);
          r.boostsUsed++;
          if (r.isPlayer) {
            addShake(0.12 + r.driftLevel * 0.08);
            sfx.boost();
          }
          emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: DRIFT_COLOURS[r.driftLevel - 1], count: 12 + r.driftLevel * 8, speed: 4.5, spread: 0.8, size: 0.22, life: 0.6 });
        }
        r.driftCharge = 0;
        r.driftLevel = 0;
        r.driftDir = 0;
      }
      // the nose swings into the turn, further the tighter it is held, and back out on release
      const lean = r.isDrifting ? r.driftDir * (0.22 + 0.14 * Math.max(-0.5, r.steerSmooth * r.driftDir)) : 0;
      r.yaw += (lean - r.yaw) * Math.min(1, dt * (r.isDrifting ? 9 : 7));
      if (r.hop > 0) r.hop -= dt;
    }

    // ---- speed ----
    // the skill tier sets how fast and how eager an opponent is, on top of the catch-up
    const tier = r.isPlayer ? null : AI_PROFILES[settings.aiSkill];
    let effMax = st.maxSpeed * r.boostMult * (tier ? r.aiMult * tier.pace : 1);
    if (r.mode === "boat") effMax *= st.boatBonus * 0.94 * craftSpeed(r.vehicle.boat, 1);
    if (r.mode === "sub") effMax *= st.boatBonus * 0.9 * craftSpeed(r.vehicle.sub, 1);
    if (r.mode === "plane") effMax *= st.planeBonus * 1.12 * craftSpeed(r.vehicle.plane, 1);
    // nothing touches the road: no rolling resistance at all
    if (r.mode === "hover") effMax *= 1.1 * craftSpeed(r.vehicle.hover, 1);
    if (r.slowTimer > 0) effMax *= 0.55;
    if (r.burnTimer > 0) {
      effMax *= 0.75;
      if (frame.current % 4 === 0) emitParticles({ position: r.pos.clone().setY(r.y + 0.7), color: "#fb923c", count: 2, speed: 1.6, spread: 0.5, size: 0.18, life: 0.4, upBias: 1.4 });
    }
    if (r.giantTimer > 0) effMax *= 1.1;
    // two engines
    if (r.pair) effMax *= 1.06;
    // the last lap is flat out for everybody
    if (mode.laps > 1 && r.lap >= mode.laps) effMax *= 1.03;

    // ---- slipstream: sit in the hole the kart in front makes, then pull out and sling past ----
    {
      let tow = false;
      if (!r.airborne && r.mode !== "sub" && r.speed > st.maxSpeed * 0.6) {
        const fx = Math.sin(r.course);
        const fz = Math.cos(r.course);
        for (const o of racers) {
          if (o === r || gone(o) || o.mode !== r.mode || Math.abs(o.y - r.y) > 3) continue;
          const dx = o.pos.x - r.pos.x;
          const dz = o.pos.z - r.pos.z;
          const ahead = dx * fx + dz * fz;
          if (ahead < 2.5 || ahead > 17 || Math.abs(dx * fz - dz * fx) > 1.9) continue;
          tow = true;
          break;
        }
      }
      if (tow) {
        r.draft = Math.min(1, r.draft + dt / 1.3);
        if (r.isPlayer && r.draft > 0.3 && frame.current % 3 === 0) {
          emitParticles({ position: r.pos.clone().setY(r.y + 0.9), color: "#ffffff", count: 2, speed: 9, spread: 1.6, size: 0.1, life: 0.22, gravity: 0 });
        }
      } else if (r.draft >= 0.95) {
        // out of the tow with it fully built: the sling
        r.draft = 0;
        r.boostTimer = Math.max(r.boostTimer, 0.75 * st.boostTime);
        r.boostMult = Math.max(r.boostMult, 1 + 0.24 * st.boostPower);
        if (r.isPlayer) {
          r.boostsUsed++;
          addShake(0.14);
          sfx.boost();
        }
        emitParticles({ position: r.pos.clone().setY(r.y + 0.5), color: "#ffffff", count: 16, speed: 4.5, spread: 0.9, size: 0.18, life: 0.45 });
      } else r.draft = Math.max(0, r.draft - dt * 1.5);
      effMax *= 1 + 0.07 * r.draft;
    }

    // hills cost speed going up and give it back coming down
    const hill = r.airborne || r.mode === "plane" || r.mode === "hover" ? 0 : THREE.MathUtils.clamp(r.slopeAlong, -0.35, 0.35);
    effMax *= 1 - hill * (r.speed >= 0 ? 0.55 : -0.55);
    if (hill !== 0) r.speed -= GRAVITY * 0.4 * hill * dt;

    const accelNow = st.accel * (r.mode === "plane" ? 1.25 : 1) * (tier ? tier.accel : 1);
    if (throttleIn > 0) r.speed += accelNow * dt;
    else if (throttleIn < 0) r.speed -= accelNow * 1.4 * dt;
    else {
      r.speed -= Math.sign(r.speed) * 8 * dt;
      if (Math.abs(r.speed) < 0.3) r.speed = 0;
    }
    r.speed = THREE.MathUtils.clamp(r.speed, -effMax * 0.35, effMax);

    // ---- turning ----
    const speedFrac = THREE.MathUtils.clamp(Math.abs(r.speed) / st.maxSpeed, 0, 1);
    const authority = (0.4 + speedFrac * 0.6) * (1 - speedFrac * 0.18);
    const modeMul =
      r.mode === "boat"
        ? 1.25 * craftHandling(r.vehicle.boat, 1)
        : r.mode === "sub"
          ? 1.15 * craftHandling(r.vehicle.sub, 1)
          : r.mode === "plane"
            ? 0.8 * craftHandling(r.vehicle.plane, 1)
            : r.mode === "hover"
              ? 1.12 * craftHandling(r.vehicle.hover, 1)
              : 1;
    const dir = r.speed >= 0 ? 1 : -1;
    if (r.isDrifting) {
      // always round the same way: the wheel only sets how tight. It bites over
      // the first quarter of a second, so the start is a slide and not a snap.
      const into = r.steerSmooth * r.driftDir;
      const arc = THREE.MathUtils.clamp(0.3 + 0.55 * into, 0.08, 0.9) * Math.min(1, 0.35 + r.driftAge * 2.6);
      r.heading += r.driftDir * st.turnRate * authority * arc * modeMul * dt;
    } else {
      r.heading += r.steerSmooth * st.turnRate * authority * modeMul * dir * dt;
    }

    // ---- movement: ground, barriers, gravity and lap progress live in physics.ts ----
    const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
    // a hull has no tyres: on water the boat keeps going the way it was going and
    // the bow leads it round, so a turn is a slide
    // A drifting kart does the same on tarmac: the nose is round the bend and the
    // kart is still catching up with it, sliding. Let go and the tyres bite: it
    // shoots off where the nose points.
    {
      // a levitating craft has nothing to grip with either: it glides round a bend
      const follow = r.mode === "boat" ? (r.isDrifting ? 2.1 : 3.6) : r.mode === "hover" ? (r.isDrifting ? 2.4 : 5) : r.isDrifting ? SLIP_RATE : 13;
      if (r.mode !== "boat" && r.mode !== "hover" && !r.isDrifting && Math.abs(wrapAngle(r.heading - r.course)) < 0.01) r.course = r.heading;
      else r.course += wrapAngle(r.heading - r.course) * Math.min(1, dt * follow);
      const slip = wrapAngle(r.heading - r.course);
      if (Math.abs(slip) > SLIP_MAX) r.course = r.heading - Math.sign(slip) * SLIP_MAX;
    }
    const mx = Math.sin(r.course) * r.speed * dt;
    const mz = Math.cos(r.course) * r.speed * dt;
    const bob = performance.now();
    stepOpts.fly = !!flight;
    // a plane may stray a little past the edge of its line; a submarine stays inside its tube
    stepOpts.flyMargin = r.mode === "sub" ? -2.6 : 4;
    // the plane lifts off as the flying stretch begins and comes back down onto the road at its end
    const lift = THREE.MathUtils.smoothstep(inSky, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(inSky, 0.9, 1));
    if (!flight) r.flyOff = 0;
    stepOpts.flyAlt = flight ? lift * (flight.base + r.flyOff) : 0;
    stepOpts.bobbing = r.mode === "boat" || r.mode === "sub" || r.mode === "hover";
    // off a ramp or over a gap, a levitating craft floats down instead of dropping
    stepOpts.gravityMul = r.mode === "hover" ? 0.4 : 1;
    stepOpts.rideOffset =
      r.mode === "boat" ? -0.12 + Math.sin(bob * 0.004 + r.aiPhase) * 0.09 : r.mode === "sub" ? 0.35 + Math.sin(bob * 0.003 + r.aiPhase) * 0.1 : r.mode === "hover" ? 0.55 + Math.sin(bob * 0.005 + r.aiPhase) * 0.12 : 0;
    moveBody(r, mx, mz, dt, stepOpts, stepRes);

    // run a drift into a barrier and the charge is gone
    if (r.isDrifting && stepRes.wallFirst && stepRes.wallImpact > 0.45) {
      r.isDrifting = false;
      r.driftCharge = 0;
      r.driftLevel = 0;
      r.driftDir = 0;
    }
    // a barrier is felt once, in proportion to how hard it was hit; sliding along it is silent
    if (stepRes.wallFirst && stepRes.wallImpact > 0.12 && r.bumpCd <= 0) {
      r.bumpCd = 0.45;
      if (r.isPlayer) {
        addShake(0.05 + 0.22 * stepRes.wallImpact);
        sfx.bump();
        emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: theme.particles[0], count: 8, speed: 2.4, spread: 0.7, size: 0.16, life: 0.35 });
      }
    }
    // scraping along a barrier throws sparks: you can see what is costing you speed
    if (r.touching && Math.abs(r.speed) > 8 && frame.current % 3 === 0) {
      emitParticles({ position: r.pos.clone().setY(r.y + 0.35), color: "#ffd166", count: 2, speed: 3, spread: 0.6, size: 0.12, life: 0.3 });
    }
    if (stepRes.landed > 4 && r.mode !== "plane" && r.mode !== "sub") {
      // dust thrown out either side where it comes down, more of it the harder it lands
      const n = Math.min(14, Math.round(stepRes.landed * 0.7));
      emitParticles({ position: r.pos.clone().setY(r.y + 0.15), color: r.mode === "boat" ? "#e8fbff" : theme.roadEdge, count: n, speed: 3 + stepRes.landed * 0.12, spread: 1.6, size: 0.3, life: 0.5, upBias: 0.25, gravity: 6 });
    }
    if (stepRes.landed > 8) {
      emitParticles({ position: r.pos.clone().setY(r.y + 0.2), color: theme.particles[1], count: 10, speed: 2.6, spread: 1.1, size: 0.18, life: 0.4 });
      if (r.isPlayer) {
        addShake(Math.min(0.3, stepRes.landed * 0.012));
        sfx.bump();
      }
    }

    if (r.exploding) {
      r.explodeTimer -= dt;
      if (r.group.current) r.group.current.visible = Math.floor(r.explodeTimer * 10) % 2 === 0;
      r.speed *= 0.2;
      if (r.explodeTimer <= 0) {
        r.exploding = false;
        if (r.group.current) r.group.current.visible = true;
        // back on its wheels in the middle of the road it was on
        placeBody(r, r.safePath, r.safeIdx);
        r.respawnLock = 1.1;
        r.speed = 5;
        r.stunTimer = 1.2;
        r.ghostTimer = 2.2;
        emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: theme.glow, count: 40, speed: 6, spread: 1.8, size: 0.26, life: 0.8 });
      }
    }

    // on the ground the nose follows the slope, in the air it follows the arc
    const nose = r.airborne ? THREE.MathUtils.clamp(Math.atan2(r.vy, Math.max(10, Math.abs(r.speed))), -0.6, 0.6) : Math.atan(r.slopeAlong);
    r.pitch = THREE.MathUtils.lerp(r.pitch, nose, r.mode === "plane" ? 0.05 : r.airborne ? 0.1 : 0.25);

    // ---- pads painted on the road ----
    if (!r.airborne) {
      for (const pad of pads) {
        // a cannon always fires: having just crossed a boost pad must not let anyone drive into the gap behind it
        if (pad.kind !== "cannon" && r.padCd > 0) continue;
        const px = pad.pos.x - r.pos.x;
        const pz = pad.pos.z - r.pos.z;
        if (Math.abs(pad.pos.y - r.y) > 2) continue;
        // a cannon spans the whole road, so nobody drives round it; a pad is as
        // wide as it is painted
        const ahead = px * Math.sin(pad.heading) + pz * Math.cos(pad.heading);
        const reach = pad.kind === "cannon" ? 200 : 20;
        if (Math.abs(ahead) > 3.5 || px * px + pz * pz > reach) continue;
        r.padCd = 0.9;
        if (pad.kind === "cannon") {
          const main = getPaths()[0];
          const to = new THREE.Vector3(main.px[pad.toIdx], main.py[pad.toIdx], main.pz[pad.toIdx]);
          const from = r.pos.clone().setY(r.y);
          r.launch = { from, to, idx: pad.toIdx, e: 0, dur: THREE.MathUtils.clamp(from.distanceTo(to) / 62, 1, 2.8), lift: pad.lift };
          r.isDrifting = false;
          r.driftCharge = 0;
        } else if (pad.kind === "jump") {
          r.vy = pad.power ?? 13;
          r.airborne = true;
        } else {
          r.boostTimer = Math.max(r.boostTimer, 1.1);
          r.boostMult = Math.max(r.boostMult, pad.power ?? 1.45);
          r.speed = Math.max(r.speed, st.maxSpeed * 0.85);
        }
        emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: theme.glow, count: 18, speed: 4.5, spread: 0.9, size: 0.2, life: 0.5 });
        if (r.isPlayer) {
          r.boostsUsed++;
          addShake(0.16);
          sfx.boost();
        }
        break;
      }
    }

    // ---- rescue: out of the circuit, or wedged ----
    if (r.respawnLock > 0) r.respawnLock -= dt;
    const trying = r.isPlayer ? throttleIn !== 0 : true;
    if (trying && r.stunTimer <= 0 && !r.exploding && r.respawnLock <= 0 && Math.abs(r.speed) < 2.5) r.pinnedFor += dt;
    else r.pinnedFor = Math.max(0, r.pinnedFor - dt * 2);
    if (r.total > r.bestTotal + 0.0004) {
      r.bestTotal = r.total;
      r.noProgressFor = 0;
    } else if (!r.isPlayer && r.stunTimer <= 0) {
      r.noProgressFor += dt;
    }
    // down the hillside, or into the sea: out of the circuit as soon as it gets there
    let sunk = false;
    if (r.airborne && r.y < r.groundY - 3 && trackDef.floor !== undefined) {
      const sea = trackDef.sea;
      if (sea !== undefined && r.mode === "land" && r.y < sea - 0.8) sunk = true;
      else if (r.y < terrainY(r.pos.x, r.pos.z) - 0.4) sunk = true;
      if (sunk) emitParticles({ position: r.pos.clone().setY(r.y + 0.5), color: sea !== undefined ? theme.water : theme.particles[0], count: 22, speed: 5, spread: 1.6, size: 0.24, life: 0.6 });
    }
    if (stepRes.fell || sunk || r.pinnedFor > 2.5 || r.noProgressFor > 7) {
      recover(r, st.maxSpeed * 0.85);
      if (r.isPlayer) useGame.getState().setTelemetry({ shortcutFlash: Date.now() });
    }

    // ---- lap: counted from distance really driven, so reversing over the line gains nothing ----
    r.t = r.prog;
    countLap(r);

    // ---- magnet slipstream: get yanked toward the racer ahead ----
    if (r.magnetTimer > 0) {
      const target = findTargetAhead(r, 0.08);
      if (target) {
        const pull = target.pos.clone().sub(r.pos).setY(0).normalize();
        r.pos.addScaledVector(pull, 9 * dt);
        if (frame.current % 3 === 0) {
          emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: WEAPON_META.magnet.glow, count: 2, speed: 1.2, spread: 0.4, size: 0.16, life: 0.35, gravity: 0 });
        }
      }
    }

    // ---- pickups ----
    for (const box of itemBoxes) {
      if (!box.active) continue;
      if (Math.hypot(box.pos.x - r.pos.x, box.pos.z - r.pos.z) < 2.9 && Math.abs(box.pos.y - r.y) < (r.mode === "plane" ? 12 : r.mode === "sub" ? 7 : 3)) {
        if (battle && !r.pair && Math.random() < 0.35) {
          // battle: one box in three goes to the turret instead
          r.turretMod = TURRET_MODS[Math.floor(Math.random() * TURRET_MODS.length)];
          r.turretTimer = UPGRADE_TIME;
          r.turretCd = 0.3;
          r.turretAim = 0;
          box.active = false;
          box.respawn = 4.5 + Math.random() * 2.5;
          emitParticles({ position: box.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), color: UPGRADE_COLOUR, count: 22, speed: 4, spread: 1.2, size: 0.24, life: 0.6 });
          if (r.isPlayer) {
            addShake(0.12);
            sfx.swap();
          }
        } else if (!r.weapon || !r.weapon2) {
          let ahead = 0;
          for (const o of racers) if (o !== r && o.total > r.total) ahead++;
          const rolled: WeaponId = rollWeapon(racers.length > 1 ? ahead / (racers.length - 1) : 0.5);
          // an empty hand takes it, with the roulette; a full one keeps it in waiting
          if (!r.weapon) {
            r.weapon = rolled;
            r.rollTimer = 0.85;
          } else r.weapon2 = rolled;
          box.active = false;
          box.respawn = 4.5 + Math.random() * 2.5;
          emitParticles({ position: box.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), color: WEAPON_META[rolled].color, count: 14, speed: 3.2, spread: 1, size: 0.2, life: 0.5 });
          if (r.isPlayer) {
            addShake(0.09);
            sfx.item();
            useGame.getState().setTelemetry({ weapon: r.weapon });
          }
        }
        break;
      }
    }

    for (const coin of coinSpots) {
      if (!coin.active) continue;
      if (r.mode === "plane") continue;
      const magnetOn = r.magnetTimer > 0;
      if (coin.pos.distanceTo(r.pos) < (magnetOn ? 11 : 2)) {
        if (magnetOn && r.pos.distanceTo(coin.pos) > 2) {
          coin.pos.lerp(r.pos, 0.18); // coin magnet
          continue;
        }
        coin.active = false;
        coin.respawn = 7;
        r.coins++;
        if (r.isPlayer) {
          sfx.coin();
          emitParticles({ position: coin.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), color: WEAPON_META.orb.color, count: 12, speed: 2.6, spread: 0.6, size: 0.15, life: 0.45, upBias: 1.6 });
        }
      }
    }

    // ---- sky rings ----
    if (flight) {
      for (let i = 0; i < skyRings.length; i++) {
        if (r.ringCd[i] > 0) continue;
        const ring = skyRings[i];
        const d = Math.hypot(ring.pos.x - r.pos.x, ring.pos.z - r.pos.z);
        if (d < (ring.kind === "sky" ? 3.8 : 3) && Math.abs(ring.pos.y - (r.y + 0.8)) < FLIGHT[ring.kind].clear) {
          r.ringCd[i] = 3;
          r.rings++;
          r.boostTimer = Math.max(r.boostTimer, 0.55);
          r.boostMult = Math.max(r.boostMult, 1.35);
          emitParticles({ position: ring.pos.clone(), color: theme.glow, count: 20, speed: 4, spread: 1.4, size: 0.22, life: 0.6 });
          if (r.isPlayer) {
            addShake(0.2);
            sfx.coin();
          }
        }
      }
    }

    // ---- things hanging in the flight path ----
    if (flight && r.hazardCd <= 0) {
      for (const blk of skyBlocks) {
        const dx = blk.pos.x - r.pos.x;
        const dy = blk.pos.y - (r.y + 0.6);
        const dz = blk.pos.z - r.pos.z;
        if (dx * dx + dy * dy + dz * dz < (blk.kind === "sky" ? 7.5 : 4.4)) {
          r.hazardCd = 1.2;
          applyHit(r, false);
          break;
        }
      }
    }

    // ---- puddles ----
    for (const p of puddles) {
      if (!p.active) continue;
      if (p.ownerId === r.id && performance.now() < p.ignoreUntil) continue;
      if (r.mode === "plane") continue;
      const hitR = p.kind === "mine" ? 1.9 : 1.5;
      if (p.pos.distanceTo(r.pos) < hitR) {
        const dropper = p.effect ? racers.find((o) => o.id === p.ownerId) : null;
        if (p.effect && dropper) {
          applyShot(r, dropper, p.effect, p.power, WEAPON_META[p.kind].color);
        } else if (p.kind === "mine") {
          applyHit(r, true);
          emitParticles({ position: p.pos.clone().setY(p.pos.y + 0.5), color: WEAPON_META.mine.glow, count: 28, speed: 5, spread: 1.6, size: 0.24, life: 0.7 });
        } else if (!protectedNow(r)) {
          r.slowTimer = 1.1;
          r.speed *= 0.55;
          r.stunTimer = Math.max(r.stunTimer, 0.5);
          emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: WEAPON_META.slime.color, count: 18, speed: 3, spread: 1.2, size: 0.2, life: 0.6 });
          if (r.isPlayer) {
            addShake(0.3);
            sfx.hit();
          }
        }
        p.active = false;
      }
    }

    // ---- mutating hazards (poles sliding across the road) ----
    if (r.hazardCd > 0) r.hazardCd -= dt;
    if (r.mode === "land" && r.hazardCd <= 0) {
      for (const h of hazardState.positions) {
        const d = Math.hypot(h.x - r.pos.x, h.z - r.pos.z);
        if (d < 1.7 && Math.abs(h.y - r.y) < 3) {
          r.hazardCd = 1.1;
          applyHit(r, false);
          emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: WEAPON_META.zap.glow, count: 16, speed: 3.6, spread: 1.1, size: 0.2, life: 0.5 });
          break;
        }
      }
    }
    // ---- moving traps ----
    const trkP2 = getActiveTrack();
    if (r.mode === "land" && r.hazardCd <= 0 && trkP2.traps) {
      const nowMs = clockRef.current;
      for (const tr of trkP2.traps) {
        // same helper the renderer uses, so the spikes you see are the spikes you hit
        const t = trapPhase(tr, nowMs);
        const hit = trapTransform(tr, nowMs);
        const lateral = Math.abs(lateralOffsetFrom(r.pos, t) - tr.side * (halfWidthAt(t) - 2.2));
        const d = Math.abs((t - r.t + 0.5) % 1 - 0.5);
        if (d < 0.014 && lateral < 4.2 && Math.abs(r.y - hit.ground) < 3) {
          r.hazardCd = 1.0;
          applyHit(r, false);
          emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: WEAPON_META.zap.glow, count: 12, speed: 3, spread: 1, size: 0.2, life: 0.45 });
          break;
        }
      }
    }


    // ---- actions: the same buttons for the player and for the opponents ----
    {
      const mine = r.isPlayer;
      if (itemPressed && r.rollTimer <= 0) fireWeapon(r, null, itemBack);
      if (turboPressed && r.turboMeter > 0.18) {
        const power = r.turboMeter;
        r.turboMeter = 0;
        r.boostTimer = Math.max(r.boostTimer, (0.7 + power * 1.6) * st.boostTime);
        r.boostMult = Math.max(r.boostMult, 1 + (0.35 + power * 0.5) * st.boostPower);
        r.boostsUsed++;
        if (mine) {
          addShake(0.28 + power * 0.25);
          sfx.boost();
        }
        emitParticles({ position: r.pos.clone().setY(r.y + 0.5), color: WEAPON_META.orb.glow, count: 26 + power * 20, speed: 5, spread: 1.1, size: 0.24, life: 0.6 });
      }
      // fusion: join up with whoever is nearest, or let go of whoever you are joined to
      if (fusePressed) {
        if (r.pair) {
          if (r.pair.age > 0.5 && mine) split(r.pair, false);
        } else if (r.turretTimer > 0) {
          // put it away early: the cooldown is the same. An upgrade stays out until it is spent.
          if (!r.turretMod) r.turretTimer = 0.001;
        } else if (r.fuseCd <= 0 && !r.launch && !r.exploding) {
          // over the network two karts stay two karts: the partner's own turret is the fusion there
          const mate = session ? null : fuseMate(r);
          if (mate) {
            r.turretTimer = 0;
            fuse(r, mate);
          } else if (r.partner && r.turretTimer <= 0) {
            // nobody near to join: the partner comes up on the kart's own turret instead
            r.turretTimer = SOLO_TIME;
            r.turretCd = 0.4;
            r.turretAim = 0;
            if (mine) sfx.swap();
            emitParticles({ position: r.pos.clone().setY(r.y + 1.4), color: (r.activeIsPartner ? r.main : r.partner).primary, count: 20, speed: 4, spread: 1, size: 0.2, life: 0.55 });
          } else if (mine) sfx.click();
        }
      }
      // while fused, the swap button changes seats instead of changing character
      if (mine && swapPressed && r.pair && r.pair.swapCd <= 0) {
        swapSeats(r.pair);
        swapPressed = false;
      }
      if (mine && swapPressed && !r.pair && r.tagCooldown <= 0 && r.partner) {
        r.activeIsPartner = !r.activeIsPartner;
        r.tagCooldown = TAG_COOLDOWN_MAX;
        r.swapInvuln = 0.9;
        r.tagSwaps++;
        r.boostTimer = Math.max(r.boostTimer, 0.6);
        r.boostMult = Math.max(r.boostMult, 1.3);
        addShake(0.28);
        sfx.swap();
        emitParticles({ position: r.pos.clone().setY(r.y + 0.9), color: activeChar(r).primary, count: 34, speed: 5, spread: 1.2, size: 0.24, life: 0.75 });
        emitParticles({ position: r.pos.clone().setY(r.y + 0.9), color: theme.glow, count: 18, speed: 3.5, spread: 1, size: 0.2, life: 0.6 });
      }
    }

    // ---- portals: gates that warp you across the map ----
    const trkP = getActiveTrack();
    if (r.portalCd <= 0 && trkP.portals) {
      for (const pr of trkP.portals) {
        const dIn = Math.abs((pr.tIn - r.t + 0.5) % 1 - 0.5);
        // you have to pass through the ring, not merely roll past its t: the
        // ring is 5.4 across, so a car wider than that keeps driving on the road
        const gateOff = Math.abs(lateralOffsetFrom(r.pos, pr.tIn) - pr.side * (halfWidthAt(pr.tIn) - 3.6));
        if (dIn < 0.012 && gateOff < 3) {
          placeBody(r, 0, mainIndexAt(pr.tOut), pr.side * (halfWidthAt(pr.tOut) - 3.6));
          r.t = r.prog;
          r.portalCd = pr.cd;
          r.boostTimer = Math.max(r.boostTimer, 0.8);
          r.boostMult = Math.max(r.boostMult, 1.4);
          emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: theme.glow, count: 32, speed: 6, spread: 1.6, size: 0.24, life: 0.8 });
          if (r.isPlayer) { addShake(0.28); sfx.swap(); }
          break;
        }
      }
    }


    // ---- trails ----
    r.particleAccum -= dt;
    if (r.particleAccum <= 0 && (r.boostTimer > 0 || r.isDrifting || r.mode === "boat" || r.mode === "plane" || r.mode === "sub")) {
      r.particleAccum = r.mode === "boat" ? 0.05 : 0.045;
      const behind = r.pos.clone().addScaledVector(fwd, -1.3).setY(r.y + (r.mode === "plane" ? 0.4 : r.mode === "boat" ? 0.15 : 0.25));
      const color =
        r.mode === "boat"
          ? "#ffffff"
          : r.isDrifting
            ? theme.glow
            : r.boostTimer > 0
              ? WEAPON_META.orb.color
              : theme.particles[1];
      emitParticles({ position: behind, color, count: r.mode === "boat" ? 3 : 2, speed: 1.1, spread: 0.3, size: 0.15, life: 0.4, upBias: r.mode === "boat" ? 0.9 : 0.4, gravity: r.mode === "boat" ? 12 : 4 });
    }

    // ---- visual sync ----
    r.visual.current.boosting = r.boostTimer > 0;
    r.visual.current.shielded = protectedNow(r);
    r.visual.current.steer = r.steerSmooth;
    r.visual.current.speedFrac = speedFrac;
    r.visual.current.stunned = r.stunTimer > 0;
    r.visual.current.mode = r.mode;
    r.visual.current.drift = r.isDrifting;
    r.visual.current.activeIsPartner = r.activeIsPartner;
    r.visual.current.fused = r.turretTimer > 0;
    r.visual.current.turretAim = r.turretAim;
    r.visual.current.gunning = false;
    r.visual.current.ghost = r.ghostTimer > 0;
    r.visual.current.magnet = r.magnetTimer > 0;
    r.visual.current.stunned = r.stunTimer > 0 && r.frozenTimer <= 0;

    if (r.group.current) {
      const hop = r.hop > 0 ? Math.sin((1 - r.hop / 0.24) * Math.PI) * 0.5 : 0;
      r.group.current.position.set(r.pos.x, r.y + hop, r.pos.z);
      r.group.current.rotation.order = "YXZ";
      r.group.current.rotation.y = r.heading + r.yaw;
      r.group.current.rotation.x = r.mode === "plane" ? 0 : -r.pitch;
      // it rolls onto its outside wheels in proportion to the slide
      r.group.current.rotation.z = -r.yaw * 0.3 - (r.mode === "land" ? wrapAngle(r.heading - r.course) * 0.2 : 0);
      // a giant is a giant
      const size = r.giantTimer > 0 ? 1 + 0.7 * Math.min(1, r.giantTimer * 2, (6 - r.giantTimer) * 4) : 1;
      r.group.current.scale.setScalar(size);
    }
  }

  /**
   * A kart run on another machine: glide to where its owner last said it was,
   * carried on by the speed it had, and dress it as its owner says it is.
   */
  function followNet(r: Racer, dt: number) {
    const f = r.fix;
    if (f) {
      f.age += dt;
      const lead = Math.min(f.age, 0.4);
      const tx = f.x + f.vx * lead;
      const tz = f.z + f.vz * lead;
      const far = (tx - r.pos.x) ** 2 + (tz - r.pos.z) ** 2 > 45 * 45;
      const k = far ? 1 : 1 - Math.exp(-12 * dt);
      r.pos.x += (tx - r.pos.x) * k;
      r.pos.z += (tz - r.pos.z) * k;
      r.y += (f.y - r.y) * k;
      r.heading += wrapAngle(f.h - r.heading) * k;
      r.course = r.heading;
    }
    const v = r.visual.current;
    v.boosting = r.boostTimer > 0;
    v.shielded = protectedNow(r);
    v.steer = 0;
    v.speedFrac = THREE.MathUtils.clamp(Math.abs(r.speed) / 26, 0, 1);
    v.mode = r.mode;
    v.drift = r.isDrifting;
    v.activeIsPartner = r.activeIsPartner;
    v.fused = r.turretTimer > 0;
    v.gunning = false;
    v.ghost = r.ghostTimer > 0;
    v.magnet = false;
    v.stunned = r.stunTimer > 0 && r.frozenTimer <= 0;
    if (r.group.current) {
      r.group.current.visible = !r.out && !!f;
      r.group.current.position.set(r.pos.x, r.y, r.pos.z);
      r.group.current.rotation.set(0, r.heading, 0);
      r.group.current.scale.setScalar(r.giantTimer > 0 ? 1.7 : 1);
    }
  }

  /** What my machine says about a kart it runs, for the others to follow. */
  function report(r: Racer) {
    const flags =
      (r.isDrifting ? 1 : 0) | (r.boostTimer > 0 ? 2 : 0) | (r.shieldActive ? 4 : 0) | (r.airborne ? 8 : 0) | (r.activeIsPartner ? 16 : 0) |
      (r.finished ? 32 : 0) | (r.out ? 64 : 0) | (r.ghostTimer > 0 ? 128 : 0) | (r.giantTimer > 0 ? 256 : 0) | (r.turretTimer > 0 ? 512 : 0) | (r.swapInvuln > 0 ? 1024 : 0);
    const q = (n: number) => Math.round(n * 100) / 100;
    return [r.id, q(r.pos.x), q(r.y), q(r.pos.z), q(r.heading), q(r.speed), r.mode, Math.round(r.total * 1e5) / 1e5, r.lap, flags, r.lives, q(r.stunTimer), q(r.frozenTimer), q(r.slowTimer), q(r.burnTimer), q(r.course)];
  }

  /** The other end of report(): take what a kart's owner says and make it so. */
  function accept(a: unknown[]) {
    const r = byId.get(a[0] as string);
    if (!r || !r.remote) return;
    const [, x, y, z, h, speed, m, total, lap, flags, lives, stun, frozen, slow, burn, course] = a as [string, number, number, number, number, number, VehicleMode, number, number, number, number, number, number, number, number, number];
    const first = !r.fix;
    r.fix = { x, y, z, h, vx: Math.sin(course) * speed, vz: Math.cos(course) * speed, age: 0 };
    if (first) {
      r.pos.set(x, 0, z);
      r.y = y;
      r.heading = h;
    }
    r.speed = speed;
    r.mode = m;
    r.total = total;
    r.bestTotal = Math.max(r.bestTotal, total);
    r.prog = ((total % 1) + 1) % 1;
    r.t = r.prog;
    r.lap = lap;
    r.path = 0;
    r.idx = Math.floor(r.prog * getPaths()[0].n) % getPaths()[0].n;
    r.isDrifting = !!(flags & 1);
    r.boostTimer = flags & 2 ? 0.3 : 0;
    r.shieldActive = !!(flags & 4);
    r.airborne = !!(flags & 8);
    r.activeIsPartner = !!(flags & 16);
    r.finished = !!(flags & 32);
    r.out = !!(flags & 64);
    r.ghostTimer = flags & 128 ? 0.3 : 0;
    r.giantTimer = flags & 256 ? 3 : 0;
    r.turretTimer = flags & 512 ? 0.3 : 0;
    r.swapInvuln = flags & 1024 ? 0.3 : 0;
    r.lives = lives;
    r.stunTimer = stun;
    r.frozenTimer = frozen;
    r.slowTimer = slow;
    r.burnTimer = burn;
    r.vy = 0;
    r.seen = { hit: r.lastHit, stun, frozen, slow, burn, vy: 0 };
  }

  /**
   * After a step of my own game: whatever it did to karts that are not mine
   * has to be told to whoever runs them. A hit goes as a hit, so it costs a
   * life there if lives are being counted; anything else as what it did.
   */
  function tellOthers() {
    for (const r of racers) {
      if (!r.remote) continue;
      const s = r.seen;
      if (r.lastHit !== s.hit) netSend({ t: "hit", k: r.id, spin: r.stunTimer > 1.1, by: r.hitBy });
      else if (r.stunTimer > s.stun + 0.15 || r.frozenTimer > s.frozen + 0.15 || r.slowTimer > s.slow + 0.15 || r.burnTimer > s.burn + 0.15 || r.vy > s.vy + 3) {
        netSend({ t: "fx", k: r.id, stun: r.stunTimer, frozen: r.frozenTimer, slow: r.slowTimer, burn: r.burnTimer, vy: r.vy, speed: r.speed });
      }
      r.seen = { hit: r.lastHit, stun: r.stunTimer, frozen: r.frozenTimer, slow: r.slowTimer, burn: r.burnTimer, vy: r.vy };
    }
    // shots and things left on the road, so the others see them coming
    for (const p of projectiles) {
      if (!p.active) {
        p.told = false;
        continue;
      }
      if (p.told || p.fake) continue;
      p.told = true;
      const owner = byId.get(p.ownerId);
      if (!owner || owner.remote) continue;
      netSend({ t: "proj", w: p.type, o: p.ownerId, x: p.pos.x, y: p.pos.y, z: p.pos.z, vx: p.vel.x, vy: p.vel.y, vz: p.vel.z, tg: p.targetId, c: p.color, life: p.life, hm: p.homing });
    }
    for (const p of puddles) {
      if (!p.active) {
        p.told = false;
        continue;
      }
      if (p.told) continue;
      p.told = true;
      const owner = byId.get(p.ownerId);
      if (!owner || owner.remote) continue;
      netSend({ t: "mine", kind: p.kind, o: p.ownerId, x: p.pos.x, y: p.pos.y, z: p.pos.z, life: p.life, fx: p.effect, pw: p.power });
    }
  }

  function simulate(dt: number, controls: ReturnType<typeof poll>, over: boolean) {
    frame.current++;
    if (!over) raceClock.current += dt * 1000;

    for (const r of racers) {
      if (r.lifeCd > 0) r.lifeCd -= dt;
      if (r.remote) followNet(r, dt);
      else if (!r.finished && !r.out) updateRacer(r, dt, r.isPlayer ? controls : null);
    }


    // traffic trundles along, and whoever runs into the back of it pays for it
    if (traffic.length) {
      const main = getPaths()[0];
      for (const tr of traffic) {
        tr.i += tr.speed * dt;
        if (tr.i > tr.to) tr.i = tr.from;
        const i = Math.floor(tr.i) % main.n;
        const lat = (main.half[i] - 3.4) * tr.side;
        tr.pos.set(main.px[i] - main.tz[i] * lat, main.py[i], main.pz[i] + main.tx[i] * lat);
        tr.heading = Math.atan2(main.tx[i], main.tz[i]);
        // it grows out of the road at the start of its beat and sinks back at the end
        const edge = Math.min(1, (tr.i - tr.from) / 8, (tr.to - tr.i) / 8);
        if (tr.group.current) {
          tr.group.current.position.copy(tr.pos);
          tr.group.current.rotation.y = tr.heading;
          tr.group.current.scale.setScalar(Math.max(0.01, edge));
        }
        if (edge < 0.6) continue;
        for (const r of racers) {
          if (gone(r) || r.launch || r.ghostTimer > 0 || r.bumpCd > 0) continue;
          const dx = r.pos.x - tr.pos.x;
          const dz = r.pos.z - tr.pos.z;
          if (dx * dx + dz * dz > 6.2 || Math.abs(r.y - tr.pos.y) > 2) continue;
          r.bumpCd = 0.7;
          r.speed *= 0.5;
          r.stunTimer = Math.max(r.stunTimer, 0.3);
          // shoved towards the middle of the road, out of its way
          r.pos.x += main.tz[i] * tr.side * 1.6;
          r.pos.z -= main.tx[i] * tr.side * 1.6;
          emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: theme.particles[0], count: 12, speed: 3.4, spread: 1, size: 0.2, life: 0.45 });
          if (r.isPlayer) {
            addShake(0.25);
            sfx.bump();
          }
        }
      }
    }

    // the ring round whoever the player's item would go for
    {
      const me = racers[0];
      const w = me.rollTimer > 0 || me.riding ? null : me.weapon;
      itemLock.current =
        w === "missile" ? findTargetAhead(me, 0.45)
        : w === "beam" ? findTargetAhead(me, 0.14)
        : w === "zap" || w === "freeze" ? findTargetAhead(me, 0.3)
        : w === "swap" && !me.pair ? findTargetAhead(me, 0.5)
        : null;
    }

    // karts shove each other: the heavier character gives way less
    for (let i = 0; i < racers.length; i++) {
      const a = racers[i];
      if (gone(a) || a.exploding || a.ghostTimer > 0) continue;
      for (let j = i + 1; j < racers.length; j++) {
        const b = racers[j];
        if (gone(b) || b.exploding || b.ghostTimer > 0) continue;
        if (a.mode !== b.mode) continue;
        // a fused kart weighs what both of them weigh
        const mass = (k: Racer) => 2 + activeChar(k).weight + (k.pair ? 2 + activeChar(k.pair.gunner).weight : 0) + (k.giantTimer > 0 ? 12 : 0);
        const hit = collideBodies(a, b, mass(a), mass(b));
        if (hit > 0 && a.giantTimer > 0 !== b.giantTimer > 0) {
          const small = a.giantTimer > 0 ? b : a;
          if (small.stunTimer <= 0) applyHit(small, true);
        }
        if (hit > 4 && (a.isPlayer || b.isPlayer) && a.bumpCd <= 0 && b.bumpCd <= 0) {
          a.bumpCd = 0.4;
          b.bumpCd = 0.4;
          addShake(Math.min(0.2, hit * 0.012));
          sfx.bump();
        }
      }
    }

    // projectiles
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      const g = projRefs[i].current;
      if (!p.active) {
        if (g) g.visible = false;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        if (g) g.visible = false;
        continue;
      }
      const quarry = p.targetId ? racers.find((r) => r.id === p.targetId) ?? null : null;
      if (p.road) {
        const all = getPaths();
        let road = all[p.path] ?? all[0];
        // close enough to see it: leave the road and go straight for it
        if (quarry && !gone(quarry) && Math.abs(quarry.y - p.pos.y) < 10 && quarry.pos.distanceToSquared(p.pos) < 24 * 24) {
          p.road = false;
          p.homing = true;
        } else {
          p.idx += (MISSILE_SPEED * dt) / road.ds;
          if (road.closed) {
            if (p.idx >= road.n) p.idx -= road.n;
            // take the route its quarry took, at the junction
            if (quarry && quarry.path > 0 && all[quarry.path]) {
              const rt = all[quarry.path];
              const rel = progDelta(rt.t0, road.prog[Math.floor(p.idx) % road.n]);
              if (rel >= 0 && rel < 0.008) {
                p.path = rt.id;
                p.idx = 0;
                road = rt;
              }
            }
          } else if (p.idx >= road.n - 1) {
            // end of a route: back onto the main road where it rejoins
            p.path = 0;
            p.idx = mainIndexAt(road.t0 + road.span);
            road = all[0];
          }
          const i = Math.min(road.n - 1, Math.floor(p.idx));
          // line up with its quarry across the road
          const want = quarry && quarry.path === p.path ? THREE.MathUtils.clamp(quarry.lat, -(road.half[i] - 1), road.half[i] - 1) : 0;
          p.lat += (want - p.lat) * Math.min(1, dt * 3);
          p.pos.set(road.px[i] - road.tz[i] * p.lat, road.py[i] + 0.9, road.pz[i] + road.tx[i] * p.lat);
          p.vel.set(road.tx[i] * MISSILE_SPEED, road.slope[i] * MISSILE_SPEED, road.tz[i] * MISSILE_SPEED);
        }
      }
      if (!p.road) {
        // homing
        if (p.homing && quarry && !gone(quarry)) {
          const to = quarry.pos.clone().setY(quarry.y + 0.7).sub(p.pos).normalize();
          p.vel.lerp(to.multiplyScalar(46), Math.min(1, dt * 4.5));
        }
        p.pos.addScaledVector(p.vel, dt);
      }
      if (frame.current % 2 === 0) {
        emitParticles({ position: p.pos.clone(), color: p.color, count: 1, speed: 0.6, spread: 0.2, size: 0.16, life: 0.3, gravity: 0 });
      }
      for (const r of racers) {
        if (p.fake || r.id === p.ownerId || r.id === p.allyId || gone(r)) continue;
        const d = Math.hypot(r.pos.x - p.pos.x, r.pos.z - p.pos.z);
        if (d < 1.7 && Math.abs(r.y + 0.6 - p.pos.y) < 2.2) {
          const owner = racers.find((o) => o.id === p.ownerId);
          if (p.effect && owner) applyShot(r, owner, p.effect, p.power, p.color);
          else applyHit(r, p.type === "missile", owner);
          p.active = false;
          emitParticles({ position: p.pos.clone(), color: p.color, count: 20, speed: 4.5, spread: 1.4, size: 0.22, life: 0.6 });
          break;
        }
      }
      if (g) {
        g.visible = p.active;
        g.position.copy(p.pos);
        // nose first, in the colour of whatever fired it
        g.rotation.order = "YXZ";
        g.rotation.set(Math.PI / 2 - Math.atan2(p.vel.y, Math.hypot(p.vel.x, p.vel.z)), Math.atan2(p.vel.x, p.vel.z), 0);
        const body = (g.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (body.userData.tint !== p.color) {
          body.userData.tint = p.color;
          body.color.set(p.color);
          body.emissive.set(p.color);
          ((g.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(p.color);
        }
      }
    }

    // puddles
    for (let i = 0; i < puddles.length; i++) {
      const p = puddles[i];
      const g = puddleRefs[i].current;
      if (!p.active) {
        if (g) g.visible = false;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) p.active = false;
      if (g) {
        g.visible = p.active;
        g.position.copy(p.pos);
        // a pool of gel lies flat; a mine is a spiked ball that turns on the spot
        g.children[0].visible = p.kind === "slime";
        g.children[1].visible = p.kind === "mine";
        g.children[1].rotation.y += dt * 2.4;
      }
    }
  }

  useFrame((_, deltaRaw) => {
    const state = useGame.getState();
    const dt = Math.min(deltaRaw, 1 / 30);
    clockRef.current = performance.now();
    const controls = poll();

    if (controls.pausePressed && state.screen === "race" && !state.telemetry.finished) state.setPaused(!state.paused);

    // pickups animate
    for (const box of itemBoxes) {
      if (!box.active) {
        box.respawn -= dt;
        if (box.respawn <= 0) box.active = mode.itemsEnabled;
      }
      if (box.group.current) {
        box.group.current.visible = box.active;
        box.group.current.rotation.y += dt * 1.8;
        box.group.current.rotation.x += dt * 0.7;
        box.group.current.position.y = box.pos.y + 1 + Math.sin(performance.now() * 0.003 + box.t * 12) * 0.18;
      }
    }
    for (const coin of coinSpots) {
      if (!coin.active) {
        coin.respawn -= dt;
        if (coin.respawn <= 0) coin.active = true;
      }
      if (coin.group.current) {
        coin.group.current.visible = coin.active;
        coin.group.current.rotation.y += dt * 2.6;
        coin.group.current.position.y = coin.pos.y + 0.7 + Math.sin(performance.now() * 0.004 + coin.pos.x) * 0.12;
      }
    }

    // something is coming for the player: a beep that quickens as it closes
    {
      let near = 0;
      for (const p of projectiles) {
        if (p.active && p.targetId === racers[0].id) near = Math.max(near, 1 - Math.min(1, p.pos.distanceTo(racers[0].pos) / 130));
      }
      warnClock.current -= dt;
      if (near > 0 && warnClock.current <= 0) {
        sfx.click();
        warnClock.current = 0.5 - near * 0.38;
      }
    }

    // the player's turret: a line along the barrel, and a ring round what it is locked on to
    {
      const me = racers[0];
      const pair = me.pair;
      const gunning = !!pair && pair.gunner === me;
      if (aimRef.current) {
        aimRef.current.visible = gunning;
        if (gunning && pair) {
          const a = pair.driver.heading + pair.aim;
          aimRef.current.position.set(me.pos.x + Math.sin(a) * 17, me.y + 2.1, me.pos.z + Math.cos(a) * 17);
          aimRef.current.rotation.set(0, a, 0);
        }
      }
      const lock = gunning && pair ? pair.lock : itemLock.current;
      if (lockRef.current) {
        lockRef.current.visible = !!lock && !gone(lock);
        if (lock) {
          lockRef.current.position.set(lock.pos.x, lock.y + 1.1, lock.pos.z);
          lockRef.current.lookAt(camera.position);
          lockRef.current.scale.setScalar(1 + Math.sin(performance.now() * 0.012) * 0.12);
        }
      }
    }

    // beam visual
    if (beamRef.current) {
      if (beamTimer.current > 0) {
        beamTimer.current -= dt;
        beamRef.current.visible = true;
        const mid = beamFrom.current.clone().lerp(beamTo.current, 0.5);
        const len = beamFrom.current.distanceTo(beamTo.current);
        beamRef.current.position.copy(mid);
        beamRef.current.lookAt(beamTo.current);
        beamRef.current.rotateX(Math.PI / 2);
        beamRef.current.scale.set(1, len, 1);
        const m = beamRef.current.material as THREE.MeshBasicMaterial;
        m.opacity = Math.min(1, beamTimer.current * 3);
      } else {
        beamRef.current.visible = false;
      }
    }

    {
      // the screech of the tyres, for as long and as loud as the slide
      const me = racers[0];
      const sliding = me && !state.paused && started.current && me.isDrifting && !me.airborne && !me.riding && !me.finished;
      setSkid(sliding ? (me.mode === "boat" ? 0.35 : 0.55 + Math.min(0.45, Math.abs(wrapAngle(me.heading - me.course)))) : 0);
    }
    if ((state.paused && !session) || !started.current) {
      // on the grid, before the lights go out, nothing has moved the karts yet: stand them on their marks
      if (!started.current) {
        for (const r of racers) {
          if (!r.group.current) continue;
          r.group.current.position.set(r.pos.x, r.y, r.pos.z);
          r.group.current.rotation.set(0, r.heading, 0);
          r.visual.current.mode = r.mode;
        }
      }
      updateCamera(Math.min(deltaRaw, 0.25), true);
      return;
    }

    // The simulation runs in steps of at most 1/60 s. A slow frame is cut into
    // several steps instead of being played in slow motion, and a fast display
    // gets one short step per frame.
    const span = Math.min(deltaRaw, 0.1);
    const steps = Math.max(1, Math.ceil(span * 60 - 0.01));
    const h = span / steps;
    // a press belongs to one step only; holding carries through all of them
    const held = steps > 1 ? { ...controls, itemPressed: false, swapPressed: false, fusePressed: false, turboPressed: false } : controls;
    for (let step = 0; step < steps; step++) simulate(h, step === 0 ? controls : held, state.telemetry.finished);

    if (session) {
      tellOthers();
      netClock.current += Math.min(deltaRaw, 0.1);
      if (netClock.current >= 1 / 15) {
        netClock.current = 0;
        netSend({ t: "s", a: racers.filter((r) => !r.remote).map(report) });
      }
    }

    const player = racers[0];
    // a race is ordered by distance; a battle by who is still in it and with how many lives
    const sorted = [...racers].sort((a, b) => (battle ? Number(a.out) - Number(b.out) || b.lives - a.lives : 0) || b.total - a.total);
    const position = sorted.indexOf(player) + 1;

    // a race ends at the line; a battle ends for you when your lives do, or when nobody else has any
    let endPos = 0;
    if (battle) {
      const alive = racers.filter((r) => !r.out);
      const over = setup.teams ? new Set(alive.map((r) => r.team)).size <= 1 : alive.length <= 1;
      if (player.out) endPos = setup.teams ? 2 : alive.length + 1;
      else if (over && racers.length > 1) endPos = 1;
    } else if (player.lap > mode.laps) endPos = position;
    if (!finishedOnce.current && endPos > 0) {
      const position = endPos;
      finishedOnce.current = true;
      if (player.pair) split(player.pair, false);
      player.finished = true;
      const timeBonus = battle ? player.lives * 400 : Math.max(0, Math.round((mode.laps * 55000 - raceClock.current) / 18));
      const positionBonus = (racers.length - position + 1) * 180;
      const running = player.coins * 12 + player.boostsUsed * 25 + player.tagSwaps * 40 + player.rings * 120;
      const finalScore = Math.round(running + timeBonus + positionBonus);
      state.setTelemetry({ finished: true, score: finalScore });
      state.setRaceResult({
        position,
        score: finalScore,
        timeMs: raceClock.current,
        coins: player.coins,
        tagSwaps: player.tagSwaps,
        rings: player.rings,
        lapsCompleted: battle ? Math.max(0, player.lap - 1) : mode.laps,
      });
      addShake(0.45);
      sfx.finish();
      for (let i = 0; i < 4; i++) {
        emitParticles({
          position: player.pos.clone().setY(player.y + 1.2 + i * 0.4),
          color: theme.particles[i % theme.particles.length],
          count: 26,
          speed: 6,
          spread: 1.8,
          size: 0.26,
          life: 1.2,
        });
      }
      victory.current = { t: 0, podium: position <= 3, heading: player.heading, y: player.y };
      window.setTimeout(() => useGame.getState().goto("results"), 3600);
    }

    // The HUD is refreshed by the clock, twenty times a second. It used to be
    // every second simulation step, and below 60 fps a frame is always two
    // steps: the count then stayed odd or even for the rest of the race, and
    // when it stayed odd the lap, the position and the timer froze.
    uiClock.current += Math.min(deltaRaw, 0.1);
    if (uiClock.current >= 0.05 && !finishedOnce.current) {
      uiClock.current = 0;
      const running = player.coins * 12 + player.boostsUsed * 25 + player.tagSwaps * 40 + player.rings * 120;
      state.setTelemetry({
        lap: Math.min(player.lap, mode.laps),
        position,
        timeMs: raceClock.current,
        score: running,
        coins: player.coins,
        weapon: player.weapon,
        weapon2: player.weapon2,
        draft: player.draft,
        speedKph: Math.round(Math.abs(player.speed) * 6.4),
        tagCooldown: 1 - Math.min(1, player.tagCooldown / TAG_COOLDOWN_MAX),
        fuseReady: player.pair || player.turretTimer > 0 ? 1 : 1 - Math.min(1, player.fuseCd / player.fuseCdMax),
        fuseWait: player.pair || player.turretTimer > 0 ? 0 : Math.max(0, Math.ceil(player.fuseCd)),
        soloTurret: player.turretTimer / (player.turretMod ? UPGRADE_TIME : SOLO_TIME),
        turretMod: player.turretMod,
        fused: !!player.pair,
        fusionHp: player.pair ? Math.max(0, player.pair.hp) : 1,
        gunning: !!player.pair && player.pair.gunner === player,
        gunKind: player.pair && player.pair.gunner === player ? fusionShot(activeChar(player).id, player.pair.driver.mode).kind : null,
        gunLock: !!(player.pair && player.pair.gunner === player && player.pair.lock),
        lives: battle ? player.lives : -1,
        maxLives: battle ? setup.lives : 0,
        turbo: player.turboMeter,
        driftLevel: player.driftLevel,
        rolling: player.rollTimer > 0,
        incoming: (() => {
          // how close the nearest thing aimed at the player is, 0 none .. 1 on top of it
          let near = 0;
          for (const p of projectiles) {
            if (!p.active || p.targetId !== player.id) continue;
            near = Math.max(near, 1 - Math.min(1, p.pos.distanceTo(player.pos) / 130));
          }
          return near;
        })(),
        shieldActive: protectedNow(player),
        boosting: player.boostTimer > 0,
        activeIsPartner: player.activeIsPartner,
        mode: player.mode,
        rings: player.rings,
        standings: sorted.map((r) => ({ id: r.id, name: r.label || activeChar(r).name, isPlayer: r.isPlayer, progress: r.total, lap: Math.min(r.lap, mode.laps), color: r.vehicle.body, lives: battle ? r.lives : undefined, team: r.team, out: r.out })),
      });
    }

    // ---- victory: hops and a spin on the spot, with confetti for a podium ----
    if (victory.current) {
      const v = victory.current;
      v.t += Math.min(deltaRaw, 0.1);
      const hop = Math.abs(Math.sin(v.t * 6.5)) * (v.podium ? 1.5 : 0.6) * Math.max(0, 1 - v.t / 3.6);
      if (player.group.current) {
        player.group.current.position.set(player.pos.x, v.y + hop, player.pos.z);
        player.group.current.rotation.y = v.heading + (v.podium ? v.t * 5.2 : Math.sin(v.t * 5) * 0.5);
        player.group.current.rotation.x = 0;
        player.group.current.rotation.z = Math.sin(v.t * 13) * 0.12;
      }
      player.visual.current.boosting = v.podium;
      if (v.podium && frame.current % 5 === 0) {
        emitParticles({ position: player.pos.clone().setY(v.y + 2.6), color: theme.particles[frame.current % theme.particles.length], count: 7, speed: 5, spread: 2.4, size: 0.24, life: 1.1, upBias: 1.2 });
      }
    }

    // minimap snapshot
    raceSnapshot.racers = racers.map((r) => ({
      x: r.pos.x,
      y: r.y,
      z: r.pos.z,
      color: r.isPlayer ? "#ffffff" : r.vehicle.body,
      isPlayer: r.isPlayer,
      mode: r.mode,
      t: r.t,
    }));
    raceSnapshot.camAngle = player.heading;

    updateCamera(Math.min(deltaRaw, 0.25), false);
  });

  function updateCamera(dt: number, idle: boolean) {
    const player = racers[0];
    if (!player) return;
    // behind where the kart is going rather than where it points: in a drift the
    // kart is seen at an angle, crossed up, instead of the world swinging round it
    const slip = player.mode === "land" ? wrapAngle(player.heading - player.course) : 0;
    camSlip.current += (slip - camSlip.current) * (1 - Math.exp(-(player.isDrifting ? 9 : 4.5) * dt));
    // on the turret the camera looks where the barrel does: turning the gun turns the view
    const gun = player.pair && player.pair.gunner === player ? player.pair : null;
    camAim.current += wrapAngle((gun ? gun.aim : 0) - camAim.current) * (1 - Math.exp(-8 * dt));
    const camDir = player.heading - camSlip.current * 0.72 + camAim.current;
    const fwd = new THREE.Vector3(Math.sin(camDir), 0, Math.cos(camDir));
    const flying = player.mode === "plane";
    const wet = player.mode === "boat" || player.mode === "sub";
    const dist = (flying ? 10.5 : wet ? 8 : 8.6) + Math.abs(camSlip.current) * 1.6;
    const height = flying ? 4.6 : player.mode === "sub" ? 4.4 : wet ? 3.1 : 3.8;
    const speedKick = THREE.MathUtils.clamp(player.speed / 30, 0, 1);
    const desired = player.pos
      .clone()
      .setY(player.y)
      .addScaledVector(fwd, -dist - speedKick * 1.4)
      .add(new THREE.Vector3(0, height + speedKick * 0.5, 0));
    if (victory.current) {
      // swing round to the front of the kart and circle it
      const a = victory.current.heading + Math.PI * 0.75 + victory.current.t * 0.9;
      desired.set(player.pos.x + Math.sin(a) * 7.5, victory.current.y + 3.2, player.pos.z + Math.cos(a) * 7.5);
    }
    // never let the chase camera sink into a hill: lift it to clear the road
    // surface behind the car, and never drop it below the car either
    // the floor is whatever road is under the camera on the player's level, so
    // it clears a hill behind the car without being dragged up to a bridge overhead
    const behindGround = groundAt(desired.x, desired.z, player.y + 3, camG, 0) ? camG.y : player.y - 2;
    const floor = Math.max(behindGround + 1.8, player.y + 1.4);
    if (desired.y < floor) desired.y = floor;
    // look at the road ahead, not at the sky above a crest or into the ground on a descent
    const aheadY = !player.airborne && groundAt(player.pos.x + fwd.x * 10, player.pos.z + fwd.z * 10, player.y + 3, camG, 0) ? camG.y : player.y;
    const look = player.pos.clone()
      .setY(THREE.MathUtils.lerp(player.y, aheadY, 0.8) + 1.2)
      .addScaledVector(fwd, 7);
    if (victory.current) look.set(player.pos.x, victory.current.y + 1.2, player.pos.z);
    // Smoothing by elapsed time, not per frame: at 20 fps the camera used to
    // trail three times as far behind as at 60.
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);
    camPos.current.lerp(desired, ease(idle ? 3 : 7));
    // the smoothed camera lags on a fast descent, so clamp again once it is
    // settled: otherwise it dips through the road surface for a few frames
    const camGround = groundAt(camPos.current.x, camPos.current.z, player.y + 3, camG, 0) ? camG.y : -Infinity;
    if (camPos.current.y < camGround + 1.6) camPos.current.y = camGround + 1.6;
    if (trackDef.floor !== undefined) {
      const hill = terrainY(camPos.current.x, camPos.current.z) + 1.5;
      if (camPos.current.y < hill) camPos.current.y = hill;
    }
    // the light is the light of the aesthetic the player is driving through
    const mix = sectorMix(player.t);
    const la = themeOnLap(mix.a, aestheticLap - 1);
    const lb = themeOnLap(mix.b, aestheticLap - 1);
    sunTint.set(la.sun).lerp(sunTint2.set(lb.sun), mix.u);
    sun.color.lerp(sunTint, ease(3.7));
    sun.intensity += (THREE.MathUtils.lerp(la.sunIntensity, lb.sunIntensity, mix.u) - sun.intensity) * ease(3.7);
    // the sun travels with the player, so shadows exist all the way round the lap
    sun.position.set(player.pos.x + 45, player.y + 65, player.pos.z - 25);
    sun.target.position.set(player.pos.x, player.y, player.pos.z);
    sun.target.updateMatrixWorld();
    camLook.current.lerp(look, ease(idle ? 3 : 8.4));

    shakeState.trauma = Math.max(0, shakeState.trauma - dt * 1.7);
    const s = shakeState.trauma * shakeState.trauma;
    camera.position.copy(camPos.current).add(
      new THREE.Vector3((Math.random() - 0.5) * s * 1.3, (Math.random() - 0.5) * s * 0.9, (Math.random() - 0.5) * s * 0.7)
    );
    camera.lookAt(camLook.current);
    const cam = camera as THREE.PerspectiveCamera;
    // the Options "speed blur" slider widens the lens as well, so the streaks
    // in the HUD and the camera pull together at high speed
    const targetFov = 64 + speedKick * (9 + settings.motionBlur * 14) + s * 10 + (player.boostTimer > 0 ? 5 : 0);
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, ease(7.7));
      cam.updateProjectionMatrix();
    }
  }

  return (
    <group>
      <primitive object={sun} />
      <primitive object={sun.target} />
      <Track theme={theme} lap={aestheticLap - 1} />
      <primitive object={skids.mesh} />
      {itemBoxes.map((box, i) => (
        <group key={`b${i}`} ref={box.group} position={box.pos.toArray()}>
          {/* gift-crystal item box */}
          <mesh castShadow>
            <octahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial
              color={theme.barrierA}
              emissive={i % 2 === 0 ? theme.glow : theme.barrierB}
              emissiveIntensity={1.4}
              roughness={0.08}
              metalness={0.5}
              transparent
              opacity={0.92}
              toneMapped={false}
            />
          </mesh>
          <mesh scale={0.5}>
            <sphereGeometry args={[0.8, 10, 10]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.65} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.05, 0.05, 6, 22]} />
            <meshBasicMaterial color={theme.glow} transparent opacity={0.5} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {coinSpots.map((coin, i) => (
        <group key={`c${i}`} ref={coin.group} position={coin.pos.toArray()}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.13, 18]} />
            <meshStandardMaterial color={WEAPON_META.orb.color} emissive={WEAPON_META.orb.glow} emissiveIntensity={1.5} metalness={0.7} roughness={0.15} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {projRefs.map((ref, i) => (
        <group key={`p${i}`} ref={ref as React.MutableRefObject<THREE.Group | null>} visible={false}>
          <mesh>
            <coneGeometry args={[0.32, 1.1, 8]} />
            <meshStandardMaterial color={WEAPON_META.missile.color} emissive={WEAPON_META.missile.glow} emissiveIntensity={3.5} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.62, 10, 10]} />
            <meshBasicMaterial color={WEAPON_META.missile.glow} transparent opacity={0.35} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {puddleRefs.map((ref, i) => (
        <group key={`s${i}`} ref={ref as React.MutableRefObject<THREE.Group | null>} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.5, 18]} />
            <meshStandardMaterial color={WEAPON_META.slime.color} emissive={WEAPON_META.slime.glow} emissiveIntensity={1.1} transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <group position={[0, 0.7, 0]}>
            <mesh>
              <icosahedronGeometry args={[0.62, 0]} />
              <meshStandardMaterial color="#2b2f3a" metalness={0.6} roughness={0.35} flatShading />
            </mesh>
            <mesh>
              <octahedronGeometry args={[0.95, 0]} />
              <meshStandardMaterial color={WEAPON_META.mine.color} emissive={WEAPON_META.mine.color} emissiveIntensity={2} toneMapped={false} wireframe />
            </mesh>
            <mesh position={[0, 0.75, 0]}>
              <sphereGeometry args={[0.16, 8, 8]} />
              <meshBasicMaterial color="#ff2d2d" toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
      {racers.map((r) => (
        <group key={r.id} ref={r.group}>
          <Vehicle
            character={r.main}
            partner={r.partner}
            vehicle={r.vehicle}
            stateRef={r.visual}
            scale={r.isPlayer ? 1 : 0.96}
            isPlayer={r.isPlayer}
            glow={r.isPlayer ? theme.glow : undefined}
          />
        </group>
      ))}
      {traffic.map((tr, i) => (
        <group key={`tr${i}`} ref={tr.group}>
          {/* a slow glass bus: a body, a dome and a beacon you can see from a long way off */}
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[2.3, 1.5, 3.6]} />
            <meshStandardMaterial color={theme.barrierB} roughness={0.25} metalness={0.3} />
          </mesh>
          <mesh position={[0, 1.95, -0.2]} scale={[1, 0.6, 1.3]}>
            <sphereGeometry args={[1.05, 14, 12]} />
            <meshPhysicalMaterial color="#ffffff" transparent opacity={0.45} roughness={0.05} clearcoat={1} />
          </mesh>
          <mesh position={[0, 2.9, -0.2]}>
            <sphereGeometry args={[0.32, 10, 10]} />
            <meshBasicMaterial color={theme.barrierA} toneMapped={false} />
          </mesh>
          {[-1, 1].map((x) =>
            [-1.1, 1.1].map((z) => (
              <mesh key={`${x}${z}`} position={[x * 1.2, 0.42, z]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.42, 0.42, 0.3, 12]} />
                <meshStandardMaterial color="#15161d" roughness={0.7} />
              </mesh>
            ))
          )}
        </group>
      ))}
      <mesh ref={aimRef} visible={false}>
        <boxGeometry args={[0.16, 0.16, 30]} />
        <meshBasicMaterial color={theme.glow} transparent opacity={0.55} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={lockRef} visible={false} renderOrder={5}>
        <torusGeometry args={[2.1, 0.16, 8, 4]} />
        <meshBasicMaterial color="#ff3b5c" toneMapped={false} depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh ref={beamRef} visible={false}>
        <cylinderGeometry args={[0.12, 0.12, 1, 8]} />
        <meshBasicMaterial color={WEAPON_META.beam.glow} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <ParticleSystem />
    </group>
  );
}
