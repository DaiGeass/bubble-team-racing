import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Track from "./Track";
import Vehicle, { type KartVisualState, type VehicleConfig } from "./Vehicle";
import ParticleSystem from "./ParticleSystem";
import type { UseControlsReturn } from "../controls";
import { useGame } from "../store";
import {
  CHARACTERS,
  MODES,
  BODY_COLORS,
  THEMES,
  mutateTheme,
  SHAPES,
  BOATS,
  PLANES,
  SUBS,
  TRACK_WIDTH,
  SKY_ALTITUDE,
  WEAPON_META,
  raceSnapshot,
  hazardState,
  rollWeapon,
  zoneAt,
  zoneOfKind,
  craftSpeed,
  craftHandling,
  type CharacterDef,
  type WeaponId,
  type VehicleMode,
} from "../data";
import { nearestT, trackPointAt, trackTangentAt, lateralOffsetFrom, corridorBounds, branchCenterAt, getActiveTrack, getShortcuts, surfaceYAt, trackFrameAt, halfWidthAt } from "../trackCurve";
import { emitParticles, addShake, shakeState } from "../particles";
import { sfx } from "../sound";

const TAG_COOLDOWN_MAX = 3.6;
const RING_COUNT = 7;
/** Downward acceleration for crest launches and jumps, in units per second squared. */
const GRAVITY = 26;
/** Fastest vertical speed the road surface may drag a vehicle up or down with it. */
const MAX_GLUE = 34;

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

interface Racer {
  id: string;
  isPlayer: boolean;
  main: CharacterDef;
  partner: CharacterDef | null;
  activeIsPartner: boolean;
  vehicle: VehicleConfig;
  pos: THREE.Vector3;
  y: number;
  /** vertical velocity, only meaningful while airborne */
  vy: number;
  airborne: boolean;
  /** surface height under the vehicle, used to spot crests that launch it */
  groundY: number;
  /** road slope in radians, drives the visual pitch */
  pitch: number;
  /** seconds spent stuck off the road, and how long the last rescue took */
  stuckFor: number;
  respawnLock: number;
  heading: number;
  speed: number;
  steerSmooth: number;
  t: number;
  lap: number;
  finished: boolean;
  weapon: WeaponId | null;
  boostTimer: number;
  boostMult: number;
  shieldActive: boolean;
  shieldTimer: number;
  swapInvuln: number;
  stunTimer: number;
  slowTimer: number;
  tagCooldown: number;
  fuseTimer: number;
  fuseCd: number;
  fuseGun: number;
  fusionHp: number;
  turboMeter: number;
  hazardCd: number;
  warpCd: number;
  warp: null | { fromT: number; toT: number; side: number; startOffset: number; t: number; dur: number; heading: number };
  magnetTimer: number;
  ghostTimer: number;
  fuseShots: number;
  explodeTimer: number;
  exploding: boolean;
  driftCharge: number;
  isDrifting: boolean;
  mode: VehicleMode;
  aiPhase: number;
  aiLookahead: number;
  aiWeaponDelay: number;
  aiMult: number;
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

interface Projectile {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  type: WeaponId;
  ownerId: string;
  life: number;
  targetId: string | null;
}

interface Puddle {
  active: boolean;
  pos: THREE.Vector3;
  ownerId: string;
  ignoreUntil: number;
  life: number;
  kind: "slime" | "mine";
}

function activeChar(r: Racer) {
  return r.activeIsPartner && r.partner ? r.partner : r.main;
}

function shapeBonus(shape: VehicleConfig["shape"]) {
  return SHAPES.find((s) => s.id === shape)?.bonus ?? { speed: 0, handling: 0 };
}

function statsFor(char: CharacterDef, vehicle: VehicleConfig) {
  const b = shapeBonus(vehicle.shape);
  const water = vehicle.shape === "cruiser" || vehicle.shape === "hover";
  return {
    maxSpeed: 17 + char.speed * 2.7 + b.speed * 1.6,
    accel: 11 + char.accel * 3.4,
    turnRate: 1.75 + char.handling * 0.4 + b.handling * 0.28,
    boatBonus: water ? 1.12 : 1,
    planeBonus: vehicle.shape === "jet" ? 1.18 : 1,
  };
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

  const shortcuts = useMemo(() => getShortcuts(), []);

  const skyRings = useMemo(() => {
    const z = zoneOfKind("sky");
    const out: THREE.Vector3[] = [];
    if (!z) return out;
    for (let i = 0; i < RING_COUNT; i++) {
      const t = z.t0 + ((i + 0.5) / RING_COUNT) * (z.t1 - z.t0);
      const p = trackCurvePoint(t);
      const u = (t - z.t0) / (z.t1 - z.t0);
      out.push(new THREE.Vector3(p.x, p.y + Math.sin(u * Math.PI) * SKY_ALTITUDE + 1.6, p.z));
    }
    return out;
  }, []);

  const racers = useMemo<Racer[]>(() => {
    const list: Racer[] = [];
    const mainChar = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
    const partnerChar = CHARACTERS.find((c) => c.id === partnerId) ?? null;
    const total = 1 + mode.aiCount;
    const tangent0 = trackTangentAt(0);
    const center0 = trackPointAt(0);
    const normal0 = new THREE.Vector3(-tangent0.z, 0, tangent0.x).normalize();
    const heading0 = Math.atan2(tangent0.x, tangent0.z);
    for (let i = 0; i < total; i++) {
      const isPlayer = i === 0;
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      // grid starts just AHEAD of the finish line so the first crossing = lap 1 done
      const pos = center0
        .clone()
        .addScaledVector(tangent0, 4 + row * 3.4)
        .addScaledVector(normal0, col * 3.3);
      const aiChar = CHARACTERS[(i * 5 + 3) % CHARACTERS.length];
      list.push({
        id: isPlayer ? "player" : `ai-${i}`,
        isPlayer,
        main: isPlayer ? mainChar : aiChar,
        partner: isPlayer ? partnerChar : null,
        activeIsPartner: false,
        vehicle: isPlayer
          ? vehicleCfg
          : {
              body: BODY_COLORS[(i * 2 + 1) % BODY_COLORS.length],
              decal: "#ffffff",
              wheel: (["sporty", "glow", "chrome", "spike"] as const)[i % 4],
              shape: SHAPES[(i * 3) % SHAPES.length].id,
              spoiler: (["none", "wing", "fin"] as const)[i % 3],
              booster: (["single", "twin", "neon"] as const)[i % 3],
              boat: BOATS[(i + 1) % BOATS.length],
              plane: PLANES[(i + 1) % PLANES.length],
              sub: SUBS[(i + 2) % SUBS.length],
            },
        pos,
        y: surfaceYAt(nearestT(pos)),
        vy: 0,
        airborne: false,
        groundY: 0,
        pitch: 0,
        stuckFor: 0,
        respawnLock: 0,
        heading: heading0,
        speed: 0,
        steerSmooth: 0,
        t: nearestT(pos),
        lap: 1,
        finished: false,
        weapon: null,
        boostTimer: 0,
        boostMult: 1,
        shieldActive: false,
        shieldTimer: 0,
        swapInvuln: 0,
        stunTimer: 0,
        slowTimer: 0,
        tagCooldown: 0,
        fuseTimer: 0,
        fuseCd: 0,
        fuseGun: 0,
        fusionHp: 1,
        turboMeter: 0,
        hazardCd: 0,
        warpCd: 0,
        warp: null,
        magnetTimer: 0,
        ghostTimer: 0,
        fuseShots: 0,
        explodeTimer: 0,
        exploding: false,
        driftCharge: 0,
        isDrifting: false,
        mode: "land",
        aiPhase: Math.random() * Math.PI * 2,
        aiLookahead: 0.03 + Math.random() * 0.012,
        aiWeaponDelay: 0,
        aiMult: 1,
        coins: 0,
        boostsUsed: 0,
        tagSwaps: 0,
        rings: 0,
        ringCd: Array.from({ length: RING_COUNT }, () => 0),
        bumpCd: 0,
        particleAccum: 0,
        visual: { current: { boosting: false, shielded: false, steer: 0, speedFrac: 0, stunned: false, mode: "land", drift: false } },
        group: { current: null },
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemBoxes = useMemo(() => {
    const boxes: { t: number; pos: THREE.Vector3; active: boolean; respawn: number; group: React.MutableRefObject<THREE.Group | null> }[] = [];
    const count = Math.max(6, Math.round(18 * (mode.itemFrequency || 1)));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const zone = zoneAt(t);
      if (zone) continue; // no boxes inside water/sky zones
      const side = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
      const center = trackPointAt(t);
      const tangent = trackTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      boxes.push({
        t,
        pos: center.clone().addScaledVector(normal, side * TRACK_WIDTH * 0.3),
        active: mode.itemsEnabled,
        respawn: 0,
        group: { current: null },
      });
    }
    return boxes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coinSpots = useMemo(() => {
    const coins: { pos: THREE.Vector3; active: boolean; respawn: number; group: React.MutableRefObject<THREE.Group | null> }[] = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.35) / count;
      const center = trackPointAt(t);
      const tangent = trackTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const zone = zoneAt(t);
      const y = surfaceYAt(t) + (zone?.type === "sky" ? SKY_ALTITUDE + 1.2 : 1.1);
      coins.push({ pos: center.clone().addScaledVector(normal, (i % 2 === 0 ? 1 : -1) * 1.9).setY(y), active: true, respawn: 0, group: { current: null } });
    }
    // coin bait along every alternate branch route
    for (const b of getActiveTrack().branches) {
      const N = 9;
      for (let i = 0; i < N; i++) {
        const t = b.t0 + ((b.t1 - b.t0) * (i + 0.5)) / N;
        const bc = branchCenterAt(t);
        if (!bc) continue;
        coins.push({ pos: bc.point.clone(), active: true, respawn: 0, group: { current: null } });
      }
    }
    return coins;
  }, []);

  const PROJ_POOL = 18;
  const projectiles = useMemo<Projectile[]>(
    () => Array.from({ length: PROJ_POOL }, () => ({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), type: "orb" as WeaponId, ownerId: "", life: 0, targetId: null })),
    []
  );
  const projRefs = useMemo(() => Array.from({ length: PROJ_POOL }, () => ({ current: null as THREE.Group | null })), []);

  const PUDDLE_POOL = 10;
  const puddles = useMemo<Puddle[]>(
    () => Array.from({ length: PUDDLE_POOL }, () => ({ active: false, pos: new THREE.Vector3(0, -999, 0), ownerId: "", ignoreUntil: 0, life: 0, kind: "slime" as const })),
    []
  );
  const puddleRefs = useMemo(() => Array.from({ length: PUDDLE_POOL }, () => ({ current: null as THREE.Group | null })), []);

  const started = useRef(false);
  const raceClock = useRef(0);
  const finishedOnce = useRef(false);
  const frame = useRef(0);
  const camPos = useRef(new THREE.Vector3(0, 6, -14));
  const camLook = useRef(new THREE.Vector3());
  const beamRef = useRef<THREE.Mesh>(null);
  const beamTimer = useRef(0);
  const beamFrom = useRef(new THREE.Vector3());
  const beamTo = useRef(new THREE.Vector3());

  useEffect(() => {
    raceSnapshot.theme = theme;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
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

  function spawnProjectile(type: WeaponId, owner: Racer, targetId: string | null) {
    const p = projectiles.find((x) => !x.active);
    if (!p) return;
    const fwd = new THREE.Vector3(Math.sin(owner.heading), 0, Math.cos(owner.heading));
    p.active = true;
    p.type = type;
    p.ownerId = owner.id;
    p.targetId = targetId;
    p.life = 3.2;
    p.pos.copy(owner.pos).addScaledVector(fwd, 1.6).setY(owner.y + 0.7);
    p.vel.copy(fwd).multiplyScalar(type === "missile" ? 40 : 30);
  }

  function findTargetAhead(r: Racer, maxGap: number) {
    let best: Racer | null = null;
    let bestDiff = Infinity;
    const my = r.lap + r.t;
    for (const o of racers) {
      if (o === r || o.finished) continue;
      const gap = o.lap + o.t - my;
      if (gap > 0.004 && gap < maxGap && gap < bestDiff) {
        bestDiff = gap;
        best = o;
      }
    }
    return best;
  }

  function protectedNow(r: Racer) {
    return r.shieldActive || r.swapInvuln > 0 || r.ghostTimer > 0;
  }

  function applyHit(r: Racer, spinner: boolean) {
    if (protectedNow(r)) {
      r.shieldActive = false;
      r.shieldTimer = 0;
      emitParticles({ position: r.pos.clone().setY(r.y + 0.9), color: theme.glow, count: 18, speed: 3.4, spread: 1.3, size: 0.2, life: 0.55 });
      if (r.isPlayer) sfx.item();
      return;
    }
    // While fused, the partner's turret absorbs damage as HP: draining it only
    // causes a LONG paralysis (no brutal speed loss).
    if (r.fuseTimer > 0) {
      r.fusionHp -= 0.55;
      emitParticles({ position: r.pos.clone().setY(r.y + 1.2), color: WEAPON_META.zap.glow, count: 16, speed: 3.6, spread: 1.3, size: 0.2, life: 0.55 });
      if (r.isPlayer) {
        addShake(0.3);
        sfx.hit();
      }
      if (r.fusionHp <= 0) {
        r.fuseTimer = 0;
        r.fuseCd = 11;
        r.fusionHp = 1;
        r.stunTimer = 2.6; // longer paralysis only
        r.speed *= 0.82;
        emitParticles({ position: r.pos.clone().setY(r.y + 1), color: WEAPON_META.mine.glow, count: 30, speed: 5, spread: 1.6, size: 0.24, life: 0.8 });
        if (r.isPlayer) {
          addShake(0.5);
          sfx.bump();
        }
      }
      return;
    }
    // heavy hit -> chance to explode for big destruction
    if (!protectedNow(r) && !r.exploding && Math.random() < 0.15) {
      r.exploding = true;
      r.explodeTimer = 0.8;
      emitParticles({ position: r.pos.clone().setY(r.y + 1.2), color: theme.glow, count: 60, speed: 8, spread: 2, size: 0.3, life: 0.9 });
      emitParticles({ position: r.pos.clone().setY(r.y + 1.2), color: WEAPON_META.quake.glow, count: 40, speed: 10, spread: 2.2, size: 0.26, life: 0.7 });
      if (r.isPlayer) { addShake(0.8); sfx.bump(); }
    }
    r.stunTimer = spinner ? 1.25 : 0.95;
    r.speed *= spinner ? 0.35 : 0.55;
    r.boostTimer = 0;
    r.boostMult = 1;
    emitParticles({ position: r.pos.clone().setY(r.y + 0.7), color: "#ffffff", count: 22, speed: 4.5, spread: 1.6, size: 0.22, life: 0.65 });
    emitParticles({ position: r.pos.clone().setY(r.y + 0.5), color: WEAPON_META.missile.color, count: 12, speed: 3, spread: 1.2, size: 0.2, life: 0.5 });
    if (r.isPlayer) {
      addShake(0.4);
      sfx.hit();
    }
  }

  function fireWeapon(r: Racer) {
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
    } else if (w === "missile") {
      const target = findTargetAhead(r, 0.3);
      spawnProjectile("missile", r, target ? target.id : null);
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
        puddle.kind = "slime";
        puddle.ownerId = r.id;
        puddle.ignoreUntil = performance.now() + 1000;
        puddle.life = 14;
        puddle.pos.copy(r.pos).addScaledVector(fwd, -2.6).setY(surfaceYAt(r.t) + 0.08);
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
      const my = r.lap + r.t;
      for (const o of racers) {
        if (o === r || o.finished || hits >= 3) continue;
        const gap = o.lap + o.t - my;
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
        mine.kind = "mine";
        mine.ownerId = r.id;
        mine.ignoreUntil = performance.now() + 1100;
        mine.life = 16;
        mine.pos.copy(r.pos).addScaledVector(fwd, -3.2).setY(surfaceYAt(r.t) + 0.12);
      }
      if (r.isPlayer) sfx.item();
    } else if (w === "swap") {
      // position swap: trade places with the racer right in front
      const target = findTargetAhead(r, 0.5);
      if (target) {
        const myPos = r.pos.clone();
        const myT = r.t;
        const myLap = r.lap;
        const myHeading = r.heading;
        r.pos.copy(target.pos);
        r.t = target.t;
        r.lap = target.lap;
        r.heading = target.heading;
        target.pos.copy(myPos);
        target.t = myT;
        target.lap = myLap;
        target.heading = myHeading;
        [r.mode, target.mode] = [target.mode, r.mode];
        [r.y, target.y] = [target.y, r.y];
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
        if (o === r || o.finished) continue;
        if (Math.abs(o.lap + o.t - (r.lap + r.t)) > 0.2) continue;
        if (protectedNow(o)) continue;
        o.stunTimer = Math.max(o.stunTimer, 0.9);
        o.speed *= 0.6;
        o.y += 1.4;
        emitParticles({ position: o.pos.clone().setY(o.y + 0.5), color: col, count: 16, speed: 4, spread: 1.4, size: 0.22, life: 0.6 });
        if (o.isPlayer) addShake(0.4);
      }
      for (let i = 0; i < 4; i++) {
        emitParticles({ position: r.pos.clone().setY(surfaceYAt(r.t) + 0.2), color: WEAPON_META.quake.glow, count: 14, speed: 6 + i, spread: 2.2, size: 0.24, life: 0.7, upBias: 0.2 });
      }
      if (r.isPlayer) {
        addShake(0.55);
        sfx.hit();
      }
    } else if (w === "wave") {
      // shockwave: shove and slow everyone close by
      emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: WEAPON_META.wave.color, count: 34, speed: 6, spread: 2, size: 0.24, life: 0.6 });
      for (const o of racers) {
        if (o === r || o.finished) continue;
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
    const char = activeChar(r);
    const st = statsFor(char, r.vehicle);

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
    if (r.bumpCd > 0) r.bumpCd -= dt;
    for (let i = 0; i < r.ringCd.length; i++) if (r.ringCd[i] > 0) r.ringCd[i] -= dt;
    if (r.warpCd > 0) r.warpCd -= dt;
    if (r.magnetTimer > 0) r.magnetTimer -= dt;
    if (r.ghostTimer > 0) r.ghostTimer -= dt;

    // ---- ALTERNATIVE PATH: flying along a shortcut arc ----
    if (r.warp) {
      const w = r.warp;
      w.t += dt / w.dur;
      const e = Math.min(1, w.t);
      const ease = e * e * (3 - 2 * e);
      r.t = (w.fromT + ((w.toT - w.fromT + 1) % 1) * ease) % 1;
      const wTan = trackTangentAt(r.t);
      const wNrm = new THREE.Vector3(-wTan.z, 0, wTan.x).normalize();
      const wOff = THREE.MathUtils.lerp(w.startOffset, w.side * (halfWidthAt(r.t) - 3.6), ease);
      r.pos.copy(trackPointAt(r.t)).addScaledVector(wNrm, wOff);
      r.y = surfaceYAt(r.t) + Math.sin(e * Math.PI) * 9;
      r.vy = 0;
      r.airborne = false;
      r.heading += wrapAngle(w.heading - r.heading) * Math.min(1, dt * 6);
      if (frame.current % 2 === 0) {
        emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: theme.glow, count: 2, speed: 0.8, spread: 0.3, size: 0.22, life: 0.5, gravity: 0 });
      }
      if (e >= 1) {
        r.warp = null;
        r.y = surfaceYAt(r.t);
        r.mode = "land";
        r.boostTimer = Math.max(r.boostTimer, 1.2);
        r.boostMult = Math.max(r.boostMult, 1.5);
        r.warpCd = 2.5;
        emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: theme.glow, count: 30, speed: 5, spread: 1.4, size: 0.24, life: 0.7 });
        if (r.isPlayer) {
          addShake(0.3);
          sfx.boost();
        }
      }
      r.visual.current.mode = "plane";
      r.visual.current.boosting = true;
      r.visual.current.speedFrac = 1;
      r.visual.current.steer = 0;
      if (r.group.current) {
        r.group.current.position.set(r.pos.x, r.y, r.pos.z);
        r.group.current.rotation.y = r.heading;
      }
      return;
    }

    // ---- zone / mode ----
    const zone = zoneAt(r.t);
    const newMode: VehicleMode = !zone ? "land" : zone.type === "water" ? "boat" : zone.type === "sub" ? "sub" : "plane";
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
    const inSky = r.mode === "plane" && zone ? (r.t - zone.t0) / (zone.t1 - zone.t0) : 0;

    // ---- input ----
    let steerIn = 0;
    let throttleIn = 0;
    let driftHeld = false;
    let itemPressed = false;
    let swapPressed = false;
    let fusePressed = false;
    let turboPressed = false;

    if (r.isPlayer && controls) {
      // camera faces +z, so screen-right = -x: negate input so D/→ turns right
      steerIn = -controls.steer;
      throttleIn = controls.throttle;
      driftHeld = controls.drift;
      itemPressed = controls.itemPressed;
      swapPressed = controls.swapPressed;
      fusePressed = controls.fusePressed;
      turboPressed = controls.turboPressed;
      if (settings.autoGas && throttleIn === 0 && r.stunTimer <= 0) throttleIn = 1;
    } else if (!r.isPlayer) {
      const look = r.t + r.aiLookahead;
      const weave = Math.sin(performance.now() * 0.0006 + r.aiPhase) * 0.22;
      const cp = trackPointAt(look);
      const tan = trackTangentAt(look);
      const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const aim = cp.clone().addScaledVector(nrm, weave * TRACK_WIDTH * 0.45);
      aim.y = r.mode === "plane" ? Math.sin(Math.min(1, Math.max(0, inSky)) * Math.PI) * SKY_ALTITUDE + 1.6 : 0;
      const toAim = new THREE.Vector3().subVectors(aim, r.pos.clone().setY(aim.y));
      const desired = Math.atan2(toAim.x, toAim.z);
      steerIn = THREE.MathUtils.clamp(wrapAngle(desired - r.heading) * 2.4, -1, 1);
      throttleIn = r.stunTimer > 0 ? 0 : 1;

      const player = racers[0];
      const gap = player.lap + player.t - (r.lap + r.t);
      r.aiMult = gap > 0.05 ? 1 + 0.2 * mode.rubberband : gap < -0.1 ? 1 - 0.13 * mode.rubberband : 1;

      if (r.weapon) {
        if (r.aiWeaponDelay <= 0) fireWeapon(r);
        else r.aiWeaponDelay -= dt;
      } else if (Math.random() < 0.004 * mode.itemFrequency) {
        r.aiWeaponDelay = 0.4 + Math.random();
      }
    }

    if (r.stunTimer > 0) {
      throttleIn = 0;
      steerIn *= 0.25;
    }

    // ---- smoothed steering (comfortable, analog-like) ----
    const response = settings.steerAssist ? 9.5 : 7;
    r.steerSmooth += (steerIn - r.steerSmooth) * Math.min(1, dt * response);

    // ---- drift ----
    if (r.isPlayer) {
      const wantsDrift = driftHeld && Math.abs(r.steerSmooth) > 0.3 && r.speed > st.maxSpeed * 0.3 && r.mode !== "plane";
      if (wantsDrift) {
        r.isDrifting = true;
        r.driftCharge = Math.min(1.5, r.driftCharge + dt);
        r.turboMeter = Math.min(1, r.turboMeter + dt * 0.36); // drift recharges the turbo bar
      } else if (r.isDrifting) {
        r.isDrifting = false;
        if (r.driftCharge > 0.3) {
          const big = r.driftCharge > 0.85;
          r.boostTimer = big ? 1.05 : 0.6;
          r.boostMult = big ? 1.65 : 1.3;
          r.boostsUsed++;
          addShake(big ? 0.32 : 0.16);
          sfx.boost();
          emitParticles({
            position: r.pos.clone().setY(r.y + 0.4),
            color: big ? WEAPON_META.orb.color : theme.glow,
            count: big ? 30 : 16,
            speed: 4.5,
            spread: 0.8,
            size: 0.22,
            life: 0.6,
          });
        }
        r.driftCharge = 0;
      }
    }

    // ---- speed ----
    let effMax = st.maxSpeed * r.boostMult * (r.isPlayer ? 1 : r.aiMult);
    if (r.mode === "boat") effMax *= st.boatBonus * 0.94 * craftSpeed(r.vehicle.boat, 1);
    if (r.mode === "sub") effMax *= st.boatBonus * 0.9 * craftSpeed(r.vehicle.sub, 1);
    if (r.mode === "plane") effMax *= st.planeBonus * 1.12 * craftSpeed(r.vehicle.plane, 1);
    if (r.slowTimer > 0) effMax *= 0.55;

    const accelNow = st.accel * (r.mode === "plane" ? 1.25 : 1);
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
    const driftMul = r.isDrifting ? 1.55 : 1;
    const modeMul =
      r.mode === "boat"
        ? 1.25 * craftHandling(r.vehicle.boat, 1)
        : r.mode === "sub"
          ? 1.15 * craftHandling(r.vehicle.sub, 1)
          : r.mode === "plane"
            ? 0.8 * craftHandling(r.vehicle.plane, 1)
            : 1;
    const dir = r.speed >= 0 ? 1 : -1;
    r.heading += r.steerSmooth * st.turnRate * authority * driftMul * modeMul * dir * dt;

    // ---- movement ----
    const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
    r.pos.addScaledVector(fwd, r.speed * dt);
    if (r.isDrifting) {
      const nrm = new THREE.Vector3(-fwd.z, 0, fwd.x);
      r.pos.addScaledVector(nrm, -r.steerSmooth * 0.32 * Math.abs(r.speed) * dt);
    }

    // ---- vertical: every mode rides the road surface, and crests launch the vehicle ----
    const groundY = surfaceYAt(r.t);
    let rideY = groundY;
    if (r.mode === "plane") {
      rideY = groundY + Math.sin(Math.min(1, Math.max(0, inSky)) * Math.PI) * SKY_ALTITUDE;
    } else if (r.mode === "boat") {
      rideY = groundY - 0.12 + Math.sin(performance.now() * 0.004 + r.aiPhase) * 0.09;
    } else if (r.mode === "sub") {
      rideY = groundY + 0.35 + Math.sin(performance.now() * 0.003 + r.aiPhase) * 0.1;
    }

    if (r.mode === "plane") {
      // planes fly: hold the altitude profile whatever the ground does
      r.airborne = false;
      r.vy = 0;
      r.y = THREE.MathUtils.lerp(r.y, rideY, 0.12);
    } else {
      // vertical speed needed to stay glued to the surface over this frame, capped so a
      // discontinuity (respawn, warp exit, zone change) can never fling the car upward
      const need = THREE.MathUtils.clamp(dt > 1e-4 ? (rideY - r.y) / dt : 0, -MAX_GLUE, MAX_GLUE);
      const fall = r.vy - GRAVITY * dt;
      // the ground fell away faster than gravity can follow: we leave it.
      // Hulls bob a few centimetres above their target height, which would otherwise
      // flicker the flag every frame, so the launch test needs real separation there.
      const bobbing = r.mode === "boat" || r.mode === "sub";
      if (!r.airborne && need < fall - 0.5 && (!bobbing || rideY - r.y > 0.3)) r.airborne = true;
      if (r.airborne) {
        r.vy = fall;
        r.y += r.vy * dt;
        if (r.y <= rideY && r.vy <= 0) {
          r.y = rideY;
          r.vy = 0;
          r.airborne = false;
        }
      } else {
        r.y = rideY;
        r.vy = THREE.MathUtils.lerp(r.vy, need, 0.4);
      }
    }
    r.groundY = groundY;

    // the road slope becomes visual pitch, so hills are felt and not only seen
    const surface = trackFrameAt(r.t);
    const slope = Math.asin(THREE.MathUtils.clamp(surface.tangent.y, -1, 1));
    r.pitch = THREE.MathUtils.lerp(r.pitch, slope, r.mode === "plane" ? 0.05 : 0.25);

    // ---- track containment (relaxed while flying) ----
    const newT = nearestT(r.pos, r.t);
    const offset = lateralOffsetFrom(r.pos, newT);
    // asymmetric corridor: branches open the road to one side only
    const cb = corridorBounds(newT);
    const pad = r.ghostTimer > 0 ? 9 : r.mode === "plane" ? 3 : -0.9;
    const lo = cb.min + pad;
    const hi = cb.max + pad;
    if (offset < lo || offset > hi) {
      // Smooth wall slide: clamp position, nudge heading parallel to the wall.
      // Feedback (shake/sound/speed loss) only on FIRST contact — no vibration loop.
      const tangent = trackTangentAt(newT);
      const nrm = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      // Only cancel the lateral overshoot. Rewriting the whole position here would
      // wipe the forward motion of the frame and freeze the kart against the barrier.
      const clamped = offset > hi ? hi : lo;
      r.pos.addScaledVector(nrm, clamped - offset);
      const wallHeading = Math.atan2(tangent.x, tangent.z);
      const diff = wrapAngle(wallHeading - r.heading);
      r.heading += diff * Math.min(1, dt * 5);
      const firstHit = r.bumpCd <= 0;
      if (firstHit && Math.abs(r.speed) > 4) {
        r.bumpCd = 0.5;
        r.speed *= r.mode === "plane" ? 0.9 : 0.72;
        if (r.isPlayer) {
          addShake(0.18);
          sfx.bump();
          emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: theme.particles[0], count: 8, speed: 2.4, spread: 0.7, size: 0.16, life: 0.35 });
        }
      } else {
        r.speed *= 1 - (r.mode === "plane" ? 0.25 : 0.8) * dt;
      }
    }

    // ---- rescue: nobody stays stranded off the road ----
    if (r.respawnLock > 0) r.respawnLock -= dt;
    const cb2 = corridorBounds(newT);
    const outsideBy = offset < cb2.min ? cb2.min - offset : offset > cb2.max ? offset - cb2.max : 0;
    if (r.mode !== "plane" && (outsideBy > 4 || r.y < groundY - 8)) {
      r.stuckFor += dt;
      // three seconds of drifting off the road puts you back on the tarmac
      if (r.stuckFor > 3 && r.respawnLock <= 0) {
        r.stuckFor = 0;
        r.respawnLock = 1.2;
        r.t = newT;
        const tangent = trackTangentAt(newT);
        const nrm = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const back = offset > cb2.max ? cb2.max - 3 : cb2.min + 3;
        r.pos.addScaledVector(nrm, back - offset);
        r.y = surfaceYAt(newT);
        r.vy = 0;
        r.airborne = false;
        r.speed = Math.min(r.speed, 6);
        r.heading = Math.atan2(tangent.x, tangent.z);
        emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: theme.glow, count: 26, speed: 5, spread: 1.4, size: 0.22, life: 0.6 });
        if (r.isPlayer) {
          addShake(0.25);
          sfx.bump();
        }
      }
    } else if (r.speed > 1) {
      r.stuckFor = 0;
    }

    // ---- lap ----
    if (r.t > 0.8 && newT < 0.2) {
      r.lap += 1;
      hazardState.lap = r.lap; // the map mutates: hazard patterns shift each lap
      if (r.isPlayer) {
        addShake(0.14);
        sfx.coin();
        emitParticles({ position: r.pos.clone().setY(r.y + 1.4), color: theme.glow, count: 20, speed: 4, spread: 1.4, size: 0.22, life: 0.7 });
      }
    }
    r.t = newT;

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

    // ---- shortcut gates ----
    if (r.mode === "land" && r.warpCd <= 0 && !r.warp) {
      for (const sc of shortcuts) {
        const dx = sc.entry.x - r.pos.x;
        const dz = sc.entry.z - r.pos.z;
        if (dx * dx + dz * dz < 15) {
          // fly along the road between the gates, lifted over the tarmac: a straight
          // chord would dive through the hill on any circuit with real elevation
          const span = ((sc.t1 - sc.t0) % 1 + 1) % 1;
          r.warp = {
            fromT: sc.t0,
            toT: (sc.t0 + span) % 1,
            side: sc.side,
            startOffset: offset,
            t: 0,
            dur: Math.max(0.85, span * 22),
            heading: sc.heading,
          };
          r.warpCd = 3;
          emitParticles({ position: r.pos.clone().setY(1.2), color: theme.glow, count: 28, speed: 5, spread: 1.4, size: 0.24, life: 0.7 });
          if (r.isPlayer) {
            addShake(0.28);
            sfx.swap();
            useGame.getState().setTelemetry({ shortcutFlash: Date.now() });
          }
          break;
        }
      }
    }

    // ---- pickups ----
    for (const box of itemBoxes) {
      if (!box.active) continue;
      if (r.mode !== "land" && r.mode !== "boat") continue;
      if (box.pos.distanceTo(r.pos) < 2.3) {
        if (!r.weapon) {
          const rolled: WeaponId = rollWeapon();
          r.weapon = rolled;
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
      const magnetOn = r.fuseTimer > 0 || r.magnetTimer > 0;
      if (coin.pos.distanceTo(r.pos) < (magnetOn ? 11 : 2)) {
        if (magnetOn && r.pos.distanceTo(coin.pos) > 2) {
          coin.pos.lerp(r.pos, r.magnetTimer > 0 ? 0.18 : 0.12); // coin magnet
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
    if (r.mode === "plane") {
      for (let i = 0; i < skyRings.length; i++) {
        if (r.ringCd[i] > 0) continue;
        const ring = skyRings[i];
        const d = Math.hypot(ring.x - r.pos.x, ring.z - r.pos.z);
        if (d < 3.6 && Math.abs(ring.y - (r.y + 0.8)) < 3.4) {
          r.ringCd[i] = 3;
          r.rings++;
          r.boostTimer = Math.max(r.boostTimer, 0.55);
          r.boostMult = Math.max(r.boostMult, 1.35);
          emitParticles({ position: ring.clone(), color: theme.glow, count: 20, speed: 4, spread: 1.4, size: 0.22, life: 0.6 });
          if (r.isPlayer) {
            addShake(0.2);
            sfx.coin();
          }
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
        if (p.kind === "mine") {
          applyHit(r, true);
          emitParticles({ position: p.pos.clone().setY(0.5), color: WEAPON_META.mine.glow, count: 28, speed: 5, spread: 1.6, size: 0.24, life: 0.7 });
        } else if (!protectedNow(r)) {
          r.slowTimer = 1.1;
          r.speed *= 0.55;
          r.stunTimer = Math.max(r.stunTimer, 0.5);
          emitParticles({ position: r.pos.clone().setY(0.4), color: WEAPON_META.slime.color, count: 18, speed: 3, spread: 1.2, size: 0.2, life: 0.6 });
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
        if (d < 1.7) {
          r.hazardCd = 1.1;
          applyHit(r, false);
          emitParticles({ position: r.pos.clone().setY(r.y + 0.8), color: WEAPON_META.zap.glow, count: 16, speed: 3.6, spread: 1.1, size: 0.2, life: 0.5 });
          break;
        }
      }
    }

    // ---- FUSION (Crash Tag Team style): partner mans the turret, auto-fires ----
    if (r.isPlayer && r.fuseTimer > 0) {
      r.fuseTimer -= dt;
      r.fuseGun -= dt;
      if (r.fuseGun <= 0) {
        r.fuseGun = 0.85;
        const target = findTargetAhead(r, 0.35);
        // the gunner alternates: plain missiles and missile + lightning volleys
        r.fuseShots = (r.fuseShots ?? 0) + 1;
        if (target && r.fuseShots % 2 === 0) {
          spawnProjectile("missile", r, target.id);
          if (!protectedNow(target)) {
            target.stunTimer = Math.max(target.stunTimer, 0.75);
            target.speed *= 0.72;
            const p0 = r.pos.clone().setY(r.y + 1.1);
            const p1 = target.pos.clone().setY(target.y + 1);
            for (let i = 0; i < 6; i++) {
              emitParticles({ position: p0.clone().lerp(p1, i / 6), color: WEAPON_META.zap.color, count: 3, speed: 2, spread: 0.5, size: 0.17, life: 0.4, gravity: 0 });
            }
            if (target.isPlayer) addShake(0.3);
          }
        } else {
          spawnProjectile("missile", r, target ? target.id : null);
        }
        sfx.boost();
        const fwd2 = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
        emitParticles({ position: r.pos.clone().addScaledVector(fwd2, 1.4).setY(r.y + 1.1), color: WEAPON_META.missile.glow, count: 8, speed: 2.5, spread: 0.5, size: 0.18, life: 0.4 });
      }
      if (r.fuseTimer <= 0) {
        r.fuseCd = 11;
        if (r.isPlayer) sfx.swap();
      }
    }

    // ---- player actions ----
    if (r.isPlayer) {
      if (itemPressed) fireWeapon(r);
      if (turboPressed && r.turboMeter > 0.18) {
        const power = r.turboMeter;
        r.turboMeter = 0;
        r.boostTimer = Math.max(r.boostTimer, 0.7 + power * 1.6);
        r.boostMult = Math.max(r.boostMult, 1.35 + power * 0.5);
        r.boostsUsed++;
        addShake(0.28 + power * 0.25);
        sfx.boost();
        emitParticles({ position: r.pos.clone().setY(r.y + 0.5), color: WEAPON_META.orb.glow, count: 26 + power * 20, speed: 5, spread: 1.1, size: 0.24, life: 0.6 });
      }
      if (fusePressed && r.partner && r.fuseTimer <= 0 && r.fuseCd <= 0) {
        r.fusionHp = 1;
        r.fuseTimer = 9;
        r.fuseGun = 0.35;
        r.shieldActive = true;
        r.shieldTimer = 9;
        r.turboMeter = Math.min(1, r.turboMeter + 0.5);
        r.boostTimer = Math.max(r.boostTimer, 0.7);
        r.boostMult = Math.max(r.boostMult, 1.3);
        addShake(0.35);
        sfx.swap();
        emitParticles({ position: r.pos.clone().setY(r.y + 1), color: theme.glow, count: 40, speed: 5.5, spread: 1.4, size: 0.26, life: 0.85 });
        emitParticles({ position: r.pos.clone().setY(r.y + 1), color: (r.partner ? r.partner : r.main).primary, count: 22, speed: 4, spread: 1.1, size: 0.2, life: 0.7 });
      }
      if (swapPressed && r.tagCooldown <= 0 && r.partner) {
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

    // ---- trails ----
    r.particleAccum -= dt;
    if (r.particleAccum <= 0 && (r.boostTimer > 0 || r.isDrifting || r.mode === "boat" || r.mode === "plane" || r.mode === "sub")) {
      r.particleAccum = r.mode === "boat" ? 0.05 : 0.045;
      const behind = r.pos.clone().addScaledVector(fwd, -1.3).setY(r.mode === "plane" ? r.y + 0.4 : r.mode === "boat" ? 0.15 : 0.25);
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
    r.visual.current.fused = r.fuseTimer > 0;
    r.visual.current.ghost = r.ghostTimer > 0;
    r.visual.current.magnet = r.magnetTimer > 0;

    if (r.group.current) {
      r.group.current.position.set(r.pos.x, r.y, r.pos.z);
      r.group.current.rotation.order = "YXZ";
      r.group.current.rotation.y = r.heading;
      r.group.current.rotation.x = r.mode === "plane" ? 0 : -r.pitch;
    }
  }

  useFrame((_, deltaRaw) => {
    const state = useGame.getState();
    const dt = Math.min(deltaRaw, 1 / 30);
    frame.current++;
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

    if (state.paused || !started.current) {
      updateCamera(dt, true);
      return;
    }

    if (!state.telemetry.finished) raceClock.current += dt * 1000;

    for (const r of racers) {
      if (!r.finished) updateRacer(r, dt, r.isPlayer ? controls : null);
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
      // homing
      if (p.type === "missile" && p.targetId) {
        const target = racers.find((r) => r.id === p.targetId);
        if (target && !target.finished) {
          const to = target.pos.clone().setY(target.y + 0.7).sub(p.pos).normalize();
          p.vel.lerp(to.multiplyScalar(42), Math.min(1, dt * 3.2));
        }
      }
      p.pos.addScaledVector(p.vel, dt);
      if (frame.current % 2 === 0) {
        emitParticles({ position: p.pos.clone(), color: WEAPON_META[p.type].glow, count: 1, speed: 0.6, spread: 0.2, size: 0.14, life: 0.3, gravity: 0 });
      }
      for (const r of racers) {
        if (r.id === p.ownerId || r.finished) continue;
        const d = Math.hypot(r.pos.x - p.pos.x, r.pos.z - p.pos.z);
        if (d < 1.7 && Math.abs(r.y + 0.6 - p.pos.y) < 2.2) {
          applyHit(r, p.type === "missile");
          p.active = false;
          emitParticles({ position: p.pos.clone(), color: WEAPON_META[p.type].color, count: 20, speed: 4.5, spread: 1.4, size: 0.22, life: 0.6 });
          break;
        }
      }
      if (g) {
        g.visible = p.active;
        g.position.copy(p.pos);
        g.rotation.y = Math.atan2(p.vel.x, p.vel.z);
        g.rotation.x += dt * 6;
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
        g.rotation.z += dt * 0.8;
      }
    }

    const player = racers[0];
    const sorted = [...racers].sort((a, b) => b.lap + b.t - (a.lap + a.t));
    const position = sorted.indexOf(player) + 1;

    if (!finishedOnce.current && player.lap > mode.laps) {
      finishedOnce.current = true;
      player.finished = true;
      const timeBonus = Math.max(0, Math.round((mode.laps * 55000 - raceClock.current) / 18));
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
        lapsCompleted: mode.laps,
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
      window.setTimeout(() => useGame.getState().goto("results"), 2400);
    }

    if (frame.current % 2 === 0 && !finishedOnce.current) {
      const running = player.coins * 12 + player.boostsUsed * 25 + player.tagSwaps * 40 + player.rings * 120;
      state.setTelemetry({
        lap: Math.min(player.lap, mode.laps),
        position,
        timeMs: raceClock.current,
        score: running,
        coins: player.coins,
        weapon: player.weapon,
        speedKph: Math.round(Math.abs(player.speed) * 6.4),
        tagCooldown: 1 - Math.min(1, player.tagCooldown / TAG_COOLDOWN_MAX),
        fuseReady: player.fuseTimer > 0 ? 1 : 1 - Math.min(1, player.fuseCd / 11),
        fused: player.fuseTimer > 0,
        fusionHp: player.fuseTimer > 0 ? Math.max(0, player.fusionHp) : 1,
        turbo: player.turboMeter,
        shieldActive: protectedNow(player),
        boosting: player.boostTimer > 0,
        activeIsPartner: player.activeIsPartner,
        mode: player.mode,
        rings: player.rings,
        standings: sorted.map((r) => ({ id: r.id, name: activeChar(r).name, isPlayer: r.isPlayer, progress: r.lap + r.t, lap: Math.min(r.lap, mode.laps), color: r.vehicle.body })),
      });
    }

    // minimap snapshot
    raceSnapshot.racers = racers.map((r) => ({
      x: r.pos.x,
      y: r.y,
      z: r.pos.z,
      color: r.isPlayer ? "#ffffff" : r.vehicle.body,
      isPlayer: r.isPlayer,
      mode: r.mode,
    }));
    raceSnapshot.camAngle = player.heading;

    updateCamera(dt, false);
  });

  function updateCamera(dt: number, idle: boolean) {
    const player = racers[0];
    if (!player) return;
    const fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    const flying = player.mode === "plane";
    const wet = player.mode === "boat" || player.mode === "sub";
    const dist = flying ? 10.5 : wet ? 8 : 8.6;
    const height = flying ? 4.6 : player.mode === "sub" ? 4.4 : wet ? 3.1 : 3.8;
    const speedKick = THREE.MathUtils.clamp(player.speed / 30, 0, 1);
    const desired = player.pos
      .clone()
      .setY(player.y)
      .addScaledVector(fwd, -dist - speedKick * 1.4)
      .add(new THREE.Vector3(0, height + speedKick * 0.5, 0));
    // never let the chase camera sink into a hill: lift it to clear the road
    // surface behind the car, and never drop it below the car either
    const behindGround = surfaceYAt(nearestT(desired, player.t));
    const floor = Math.max(behindGround + 1.8, player.y + 1.4);
    if (desired.y < floor) desired.y = floor;
    // look at the road ahead, not at the sky above a crest or into the ground on a descent
    const aheadY = surfaceYAt(player.t + 0.022);
    const look = player.pos.clone()
      .setY(THREE.MathUtils.lerp(player.y, aheadY, 0.8) + 1.2)
      .addScaledVector(fwd, 7);
    camPos.current.lerp(desired, idle ? 0.05 : 0.11);
    camLook.current.lerp(look, idle ? 0.05 : 0.13);

    shakeState.trauma = Math.max(0, shakeState.trauma - dt * 1.7);
    const s = shakeState.trauma * shakeState.trauma;
    camera.position.copy(camPos.current).add(
      new THREE.Vector3((Math.random() - 0.5) * s * 1.3, (Math.random() - 0.5) * s * 0.9, (Math.random() - 0.5) * s * 0.7)
    );
    camera.lookAt(camLook.current);
    const cam = camera as THREE.PerspectiveCamera;
    const targetFov = 64 + speedKick * 9 + s * 10 + (player.boostTimer > 0 ? 5 : 0);
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 0.12);
      cam.updateProjectionMatrix();
    }
  }

  return (
    <group>
      <Track theme={theme} />
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
            <circleGeometry args={[1.3, 18]} />
            <meshStandardMaterial color={WEAPON_META.slime.color} emissive={WEAPON_META.slime.glow} emissiveIntensity={1.1} transparent opacity={0.85} toneMapped={false} />
          </mesh>
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
      <mesh ref={beamRef} visible={false}>
        <cylinderGeometry args={[0.12, 0.12, 1, 8]} />
        <meshBasicMaterial color={WEAPON_META.beam.glow} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <ParticleSystem />
    </group>
  );
}

function trackCurvePoint(t: number) {
  return trackPointAt(t);
}
