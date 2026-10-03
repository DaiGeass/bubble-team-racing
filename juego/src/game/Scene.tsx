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
  WEAPON_META,
  raceSnapshot,
  hazardState,
  rollWeapon,
  AI_PROFILES,
  zoneAt,
  craftSpeed,
  craftHandling,
  fusionSpec,
  type CharacterDef,
  type WeaponId,
  type VehicleMode,
} from "../data";
import { trackPointAt, trackTangentAt, lateralOffsetFrom, getActiveTrack, surfaceYAt, halfWidthAt, trapPhase, trapTransform, getPaths, getPads, getSkyRings, FLY_BASE, FLY_UP, FLY_DOWN, groundAt, makeGround, mainIndexAt, pathPoint } from "../trackCurve";
import { moveBody, makeResult, placeBody, respawnBody, aimAhead, collideBodies, progDelta, GRAVITY, type Body, type StepOpts } from "../physics";
import { emitParticles, emitDebris, addShake, shakeState } from "../particles";
import { sfx } from "../sound";

const TAG_COOLDOWN_MAX = 3.6;
// scratch objects for the per-frame physics calls, so the loop allocates nothing
const stepOpts: StepOpts = { rideOffset: 0, bobbing: false, fly: false, flyAlt: 0, ghost: false };
const stepRes = makeResult();
const aimV = new THREE.Vector3();
const camG = makeGround();

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
  /** cooldown so one pad fires once */
  padCd: number;
  /** ribbon the AI has decided to take, 0 for the main loop, and the junction it last decided at */
  aiRoute: number;
  aiSeen: number;
  /** how far above the cruising line the pilot is holding the plane */
  flyOff: number;
  /** being fired by a cannon: a scripted arc from where it was to where it lands */
  launch: null | { from: THREE.Vector3; to: THREE.Vector3; idx: number; e: number; dur: number; lift: number };
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
  magnetTimer: number;
  ghostTimer: number;
  fuseShots: number;
  explodeTimer: number;
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


  const skyRings = useMemo(() => getSkyRings(), []);

  const racers = useMemo<Racer[]>(() => {
    const list: Racer[] = [];
    const mainChar = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
    const partnerChar = CHARACTERS.find((c) => c.id === partnerId) ?? null;
    const total = 1 + mode.aiCount;
    const mainPath = getPaths()[0];
    for (let i = 0; i < total; i++) {
      const isPlayer = i === 0;
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      // grid starts just AHEAD of the finish line so the first crossing = lap 1 done
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
        pos: new THREE.Vector3(),
        y: 0,
        vy: 0,
        airborne: false,
        groundY: 0,
        slopeAlong: 0,
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
        padCd: 0,
        aiRoute: 0,
        aiSeen: -1,
        flyOff: 0,
        launch: null,
        heading: 0,
        speed: 0,
        steerSmooth: 0,
        t: 0,
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
        magnetTimer: 0,
        ghostTimer: 0,
        fuseShots: 0,
        explodeTimer: 0,
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
      me.bestTotal = me.total;
      me.t = me.prog;
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
      if (zone && zone.t1 - zone.t0 < 0.99) continue; // no boxes inside water/sky zones, unless the whole lap is one
      // the box has to sit inside the pickup radius, so a car driving the middle
      // of the road still collects it; sides just nudge it off the racing line
      const side = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
      const center = trackPointAt(t);
      const tangent = trackTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      boxes.push({
        t,
        pos: center.clone().addScaledVector(normal, side * TRACK_WIDTH * 0.09),
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

  /** Back on the road after a fall or when wedged, with enough speed to take the next jump. */
  function recover(r: Racer, pace: number) {
    respawnBody(r);
    r.speed = pace;
    r.respawnLock = 1;
    r.pinnedFor = 0;
    r.noProgressFor = 0;
    r.stunTimer = 0;
    r.isDrifting = false;
    r.driftCharge = 0;
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
  const frame = useRef(0);
  const clockRef = useRef(0);
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

  function spawnProjectile(type: WeaponId, owner: Racer, targetId: string | null, angle = 0) {
    const p = projectiles.find((x) => !x.active);
    if (!p) return;
    const heading = owner.heading + angle;
    const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
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
    const my = r.total;
    for (const o of racers) {
      if (o === r || o.finished) continue;
      const gap = o.total - my;
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

  /**
   * Fusion turrets are not one gun recoloured: each character fires their own
   * weapon with their own signature. Heavier guns trade rate for a bigger payoff.
   */
  function fireFusionGun(r: Racer, gun: WeaponId, target: Racer | null) {
    const meta = WEAPON_META[gun];
    const muzzle = r.pos.clone().setY(r.y + 1.1);
    const aim = target && !protectedNow(target) ? target : null;
    // the signature on top of the weapon family: extra shots, a wider fan and a
    // heavier direct hit, all tuned per character
    const spec = fusionSpec(activeChar(r).id);
    const burst = spec.burst;
    const spread = spec.spread;
    switch (gun) {
      case "beam": {
        // hitscan lance: damage now, no projectile to dodge
        spawnProjectile("beam", r, target ? target.id : null);
        if (aim) {
          const p1 = aim.pos.clone().setY(aim.y + 1);
          for (let i = 0; i < 8; i++) {
            emitParticles({ position: muzzle.clone().lerp(p1, i / 8), color: meta.color, count: 4, speed: 1.6, spread: 0.35, size: 0.2, life: 0.35, gravity: 0 });
          }
          aim.speed *= 0.8;
          aim.stunTimer = Math.max(aim.stunTimer, 0.5);
        }
        break;
      }
      case "zap": {
        spawnProjectile("zap", r, target ? target.id : null);
        if (aim) {
          const p1 = aim.pos.clone().setY(aim.y + 1);
          for (let i = 0; i < 6; i++) {
            emitParticles({ position: muzzle.clone().lerp(p1, i / 6), color: meta.color, count: 3, speed: 2, spread: 0.5, size: 0.17, life: 0.4, gravity: 0 });
          }
          aim.stunTimer = Math.max(aim.stunTimer, 0.75);
          aim.speed *= 0.72;
          if (aim.isPlayer) addShake(0.3);
        }
        break;
      }
      case "wave": {
        // rear-guard shockwave: punishes whoever is drafting behind you
        for (let i = -1; i <= 1; i += 2) spawnProjectile("wave", r, null);
        emitParticles({ position: r.pos.clone().setY(r.y + 0.6), color: meta.glow, count: 26, speed: 7, spread: 0.5, size: 0.26, life: 0.6, gravity: 0 });
        if (r.isPlayer) addShake(0.22);
        break;
      }
      case "orb": {
        spawnProjectile("orb", r, target ? target.id : null);
        spawnProjectile("orb", r, null);
        break;
      }
      case "bubble": {
        spawnProjectile("bubble", r, target ? target.id : null);
        if (target) spawnProjectile("bubble", r, target.id);
        break;
      }
      case "mine": {
        spawnProjectile("mine", r, target ? target.id : null);
        break;
      }
      case "quake": {
        // ground slam right under the turret
        spawnProjectile("quake", r, target ? target.id : null);
        emitParticles({ position: r.pos.clone().setY(r.y + 0.2), color: meta.color, count: 30, speed: 6, spread: 1.2, size: 0.24, life: 0.7 });
        break;
      }
      case "slime": {
        spawnProjectile("slime", r, target ? target.id : null);
        spawnProjectile("slime", r, target ? target.id : null);
        spawnProjectile("slime", r, null);
        break;
      }
      case "magnet": {
        spawnProjectile("magnet", r, target ? target.id : null);
        break;
      }
      case "ghost": {
        spawnProjectile("ghost", r, target ? target.id : null);
        if (r.isPlayer) {
          r.ghostTimer = Math.max(r.ghostTimer, 1.4);
        }
        break;
      }
      case "swap": {
        spawnProjectile("swap", r, target ? target.id : null);
        break;
      }
      default: {
        // every second volley is missile + lightning for the classic fusion feel
        spawnProjectile("missile", r, target ? target.id : null);
        if (target && r.fuseShots % 2 === 0) spawnProjectile("zap", r, target.id);
        break;
      }
    }
    // the character signature: extra rounds fanned around the aim, then the
    // heavier direct hit that goes with them
    if (burst > 0) {
      for (let b = 0; b < burst; b++) {
        const off = (b - (burst - 1) / 2) * (0.16 + spread);
        spawnProjectile(gun, r, aim ? aim.id : null, off);
      }
    }
    if (aim && spec.kick > 0) {
      aim.speed *= 1 - Math.min(0.45, spec.kick * 0.28);
      if (aim.isPlayer) addShake(0.12 + spec.kick * 0.18);
    }
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
      // the chassis comes apart: panels in the body's own colours fall to the road
      const body = activeChar(r);
      emitDebris({ position: r.pos.clone().setY(r.y + 0.9), color: body.primary, count: 9, speed: 7, spread: 1.5, size: 0.42, life: 4.5 });
      emitDebris({ position: r.pos.clone().setY(r.y + 0.8), color: body.secondary, count: 6, speed: 5.5, spread: 1.3, size: 0.34, life: 4 });
      emitDebris({ position: r.pos.clone().setY(r.y + 0.7), color: body.accent, count: 5, speed: 9, spread: 1.1, size: 0.26, life: 3.5 });
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

  function fireWeapon(r: Racer, preferredTarget?: string | null) {
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
      const auto = findTargetAhead(r, 0.3);
      const target = preferredTarget && racers.some((x) => x.id === preferredTarget) ? { id: preferredTarget } : auto;
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
        if (o === r || o.finished || hits >= 3) continue;
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
        mine.kind = "mine";
        mine.ownerId = r.id;
        mine.ignoreUntil = performance.now() + 1100;
        mine.life = 16;
        mine.pos.copy(r.pos).addScaledVector(fwd, -3.2).setY(r.groundY + 0.12);
      }
      if (r.isPlayer) sfx.item();
    } else if (w === "swap") {
      // position swap: trade places with the racer right in front
      const target = findTargetAhead(r, 0.5);
      if (target) {
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
        if (o === r || o.finished) continue;
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
    if (r.padCd > 0) r.padCd -= dt;
    if (r.aiMistake > 0) r.aiMistake -= dt;
    else if (!r.isPlayer && Math.random() < AI_PROFILES[useGame.getState().settings.aiSkill].mistake * dt) r.aiMistake = 0.5 + Math.random();
    if (r.portalCd > 0) r.portalCd -= dt;
    if (r.magnetTimer > 0) r.magnetTimer -= dt;
    if (r.ghostTimer > 0) r.ghostTimer -= dt;

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
      // in the air the pedals fly the plane: up climbs, down dives, the engine runs by itself
      if (r.mode === "plane") {
        r.flyOff = THREE.MathUtils.clamp(r.flyOff + controls.throttle * 12 * dt, FLY_DOWN, FLY_UP);
        throttleIn = r.stunTimer > 0 ? 0 : 1;
      }
    } else if (!r.isPlayer) {
      // every opponent runs the skill profile the player picked, with a small
      // per-racer personality offset so a field of pros is not a mirror clone
      const ai = AI_PROFILES[useGame.getState().settings.aiSkill];
      const wobble = Math.sin(clockRef.current * 0.0006 + r.aiPhase);
      const weave = wobble * ai.weave * (1 + r.aiQuirk);
      // lower skill runs a wider line and drifts wider on corners
      const sloppy = r.aiMistake > 0 ? Math.min(0.5, r.aiMistake * 0.4) : 0;
      // route choice: decided once per junction, a little before reaching it
      const all = getPaths();
      if (r.aiSeen > 0 && (!all[r.aiSeen] || progDelta(all[r.aiSeen].t0, r.prog) > 0.05)) r.aiSeen = -1;
      if (r.aiRoute === 0) {
        for (let k = 1; k < all.length; k++) {
          const rel = progDelta(all[k].t0, r.prog);
          if (rel > -0.03 && rel < 0 && r.aiSeen !== k) {
            r.aiSeen = k;
            if (Math.random() < Math.min(0.9, ai.gateUse * 1.5)) r.aiRoute = k;
          }
        }
      }
      // aim along the road it is taking, in 3D: the bridge and the road under it are different roads
      const lookDist = 12 + Math.abs(r.speed) * (0.3 + ai.lookahead * 7) * (r.aiLookahead / 0.036);
      r.aiRoute = aimAhead(r, r.aiRoute, lookDist, THREE.MathUtils.clamp(weave * 1.6 + sloppy, -0.85, 0.85), aimV);
      const desired = Math.atan2(aimV.x - r.pos.x, aimV.z - r.pos.z);
      steerIn = THREE.MathUtils.clamp(wrapAngle(desired - r.heading) * ai.steerGain, -1, 1);
      // flying: line up with the next ring, as well as the profile allows
      if (r.mode === "plane") {
        let want = 0;
        let near = 0.2;
        for (const ring of skyRings) {
          const d = progDelta(r.prog, ring.prog);
          if (d > 0 && d < near) {
            near = d;
            want = ring.offset - FLY_BASE;
          }
        }
        const reach = 5 + ai.steerGain * 2.5;
        r.flyOff += THREE.MathUtils.clamp(want * (0.6 + ai.drift * 0.4) - r.flyOff, -reach * dt, reach * dt);
      }
      // pros lift when they have the room, beginners floor it into the barrier
      throttleIn = r.stunTimer > 0 ? 0 : Math.abs(wrapAngle(desired - r.heading)) > 0.55 && ai.steerGain < 3 ? 0.55 : 1;

      const player = racers[0];
      const gap = player.total - (r.total);
      const rb = mode.rubberband * ai.rubberband;
      r.aiMult = gap > 0.05 ? 1 + 0.2 * rb : gap < -0.1 ? 1 - 0.13 * rb : 1;

      if (r.weapon) {
        r.aiWeaponDelay -= dt;
        if (r.aiWeaponDelay <= 0) {
          // aim for someone in front when the profile is sharp enough to bother
          const victim = ai.itemDelay < 1 ? findTargetAhead(r, 0.4) : null;
          fireWeapon(r, victim ? victim.id : null);
          r.aiWeaponDelay = ai.itemDelay * (0.7 + Math.random() * 0.6);
        }
      } else if (Math.random() < 0.02 * mode.itemFrequency) {
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

    // hills cost speed going up and give it back coming down
    const hill = r.airborne || r.mode === "plane" ? 0 : THREE.MathUtils.clamp(r.slopeAlong, -0.35, 0.35);
    effMax *= 1 - hill * (r.speed >= 0 ? 0.55 : -0.55);
    if (hill !== 0) r.speed -= GRAVITY * 0.4 * hill * dt;

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

    // ---- movement: ground, barriers, gravity and lap progress live in physics.ts ----
    const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
    let mx = fwd.x * r.speed * dt;
    let mz = fwd.z * r.speed * dt;
    if (r.isDrifting) {
      const slip = -r.steerSmooth * 0.32 * Math.abs(r.speed) * dt;
      mx += -fwd.z * slip;
      mz += fwd.x * slip;
    }
    const bob = performance.now();
    stepOpts.fly = r.mode === "plane";
    // the plane lifts off as the flying stretch begins and comes back down onto the road at its end
    const lift = THREE.MathUtils.smoothstep(inSky, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(inSky, 0.9, 1));
    if (r.mode !== "plane") r.flyOff = 0;
    stepOpts.flyAlt = lift * (FLY_BASE + r.flyOff);
    stepOpts.bobbing = r.mode === "boat" || r.mode === "sub";
    stepOpts.rideOffset =
      r.mode === "boat" ? -0.12 + Math.sin(bob * 0.004 + r.aiPhase) * 0.09 : r.mode === "sub" ? 0.35 + Math.sin(bob * 0.003 + r.aiPhase) * 0.1 : 0;
    moveBody(r, mx, mz, dt, stepOpts, stepRes);

    // a barrier is felt once, in proportion to how hard it was hit; sliding along it is silent
    if (stepRes.wallFirst && stepRes.wallImpact > 0.12 && r.bumpCd <= 0) {
      r.bumpCd = 0.45;
      if (r.isPlayer) {
        addShake(0.05 + 0.22 * stepRes.wallImpact);
        sfx.bump();
        emitParticles({ position: r.pos.clone().setY(r.y + 0.4), color: theme.particles[0], count: 8, speed: 2.4, spread: 0.7, size: 0.16, life: 0.35 });
      }
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
    if (r.padCd <= 0 && !r.airborne) {
      for (const pad of pads) {
        const px = pad.pos.x - r.pos.x;
        const pz = pad.pos.z - r.pos.z;
        if (Math.abs(pad.pos.y - r.y) > 2) continue;
        if (pad.kind === "cannon") {
          // a cannon spans the whole road: nobody drives round it
          const ahead = px * Math.sin(pad.heading) + pz * Math.cos(pad.heading);
          if (Math.abs(ahead) > 3.5 || px * px + pz * pz > 200) continue;
        } else if (px * px + pz * pz > 10) continue;
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
    if (stepRes.fell || r.pinnedFor > 2.5 || r.noProgressFor > 7) {
      recover(r, st.maxSpeed * 0.6);
      if (r.isPlayer) useGame.getState().setTelemetry({ shortcutFlash: Date.now() });
    }

    // ---- lap: counted from distance really driven, so reversing over the line gains nothing ----
    r.t = r.prog;
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
      if (Math.hypot(box.pos.x - r.pos.x, box.pos.z - r.pos.z) < 2.9 && Math.abs(box.pos.y - r.y) < (r.mode === "plane" ? 12 : 3)) {
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
        const d = Math.hypot(ring.pos.x - r.pos.x, ring.pos.z - r.pos.z);
        if (d < 3.8 && Math.abs(ring.pos.y - (r.y + 0.8)) < 3) {
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

    // ---- puddles ----
    for (const p of puddles) {
      if (!p.active) continue;
      if (p.ownerId === r.id && performance.now() < p.ignoreUntil) continue;
      if (r.mode === "plane") continue;
      const hitR = p.kind === "mine" ? 1.9 : 1.5;
      if (p.pos.distanceTo(r.pos) < hitR) {
        if (p.kind === "mine") {
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


    // ---- FUSION (Crash Tag Team style): the partner mans their own turret ----
    if (r.isPlayer && r.fuseTimer > 0) {
      r.fuseTimer -= dt;
      r.fuseGun -= dt;
      const gunner = r.partner ?? r.main;
      const gun = gunner.fusion;
      const rate = gunner.fusionRate || 0.85;
      if (r.fuseGun <= 0) {
        r.fuseGun = rate;
        const target = findTargetAhead(r, 0.35);
        r.fuseShots = (r.fuseShots ?? 0) + 1;
        fireFusionGun(r, gun, target);
        sfx.boost();
        const fwd2 = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
        emitParticles({
          position: r.pos.clone().addScaledVector(fwd2, 1.4).setY(r.y + 1.1),
          color: WEAPON_META[gun].glow,
          count: 8,
          speed: 2.5,
          spread: 0.5,
          size: 0.18,
          life: 0.4,
        });
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

  function simulate(dt: number, controls: ReturnType<typeof poll>, over: boolean) {
    frame.current++;
    if (!over) raceClock.current += dt * 1000;

    for (const r of racers) {
      if (!r.finished) updateRacer(r, dt, r.isPlayer ? controls : null);
    }


    // karts shove each other: the heavier character gives way less
    for (let i = 0; i < racers.length; i++) {
      const a = racers[i];
      if (a.finished || a.exploding || a.ghostTimer > 0) continue;
      for (let j = i + 1; j < racers.length; j++) {
        const b = racers[j];
        if (b.finished || b.exploding || b.ghostTimer > 0) continue;
        if (a.mode !== b.mode) continue;
        const hit = collideBodies(a, b, 2 + activeChar(a).weight, 2 + activeChar(b).weight);
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

    // The simulation runs in steps of at most 1/60 s. A slow frame is cut into
    // several steps instead of being played in slow motion, and a fast display
    // gets one short step per frame.
    const span = Math.min(deltaRaw, 0.1);
    const steps = Math.max(1, Math.ceil(span * 60 - 0.01));
    const h = span / steps;
    // a press belongs to one step only; holding carries through all of them
    const held = steps > 1 ? { ...controls, itemPressed: false, swapPressed: false, fusePressed: false, turboPressed: false } : controls;
    for (let step = 0; step < steps; step++) simulate(h, step === 0 ? controls : held, state.telemetry.finished);

    const player = racers[0];
    const sorted = [...racers].sort((a, b) => b.total - (a.total));
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
        standings: sorted.map((r) => ({ id: r.id, name: activeChar(r).name, isPlayer: r.isPlayer, progress: r.total, lap: Math.min(r.lap, mode.laps), color: r.vehicle.body })),
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
      t: r.t,
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
    camPos.current.lerp(desired, idle ? 0.05 : 0.11);
    // the smoothed camera lags on a fast descent, so clamp again once it is
    // settled: otherwise it dips through the road surface for a few frames
    const camGround = groundAt(camPos.current.x, camPos.current.z, player.y + 3, camG, 0) ? camG.y : -Infinity;
    if (camPos.current.y < camGround + 1.6) camPos.current.y = camGround + 1.6;
    // the sun travels with the player, so shadows exist all the way round the lap
    sun.position.set(player.pos.x + 45, player.y + 65, player.pos.z - 25);
    sun.target.position.set(player.pos.x, player.y, player.pos.z);
    sun.target.updateMatrixWorld();
    camLook.current.lerp(look, idle ? 0.05 : 0.13);

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
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 0.12);
      cam.updateProjectionMatrix();
    }
  }

  return (
    <group>
      <primitive object={sun} />
      <primitive object={sun.target} />
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
