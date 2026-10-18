export const NEW_CRAFT = {
  land: ["rally", "roadster"], boat: ["hydrofoil", "outrigger"], plane: ["canard", "vtol"],
  sub: ["nautilus", "raypod"], hover: ["triad", "flux"],
} as const;
export type NewCraftId = typeof NEW_CRAFT[keyof typeof NEW_CRAFT][number];
export type PartShape = "box" | "orb" | "tube" | "ring" | "cone";
export type PartFinish = "body" | "trim" | "dark" | "glass" | "glow";
type V3 = [number, number, number];
export interface CraftPart { shape: PartShape; finish: PartFinish; at: V3; size: V3; rotation: V3; motion?: "prop" | "field" | "fin" }
const P = Math.PI;
/** Unit meshes shared inside the selected craft. All dimensions are in game units. */
export function craftParts(id: NewCraftId): CraftPart[] {
  const parts: CraftPart[] = [];
  const add = (shape: PartShape, finish: PartFinish, at: V3, size: V3, rotation: V3 = [0,0,0], motion?: CraftPart["motion"]) => parts.push({shape,finish,at,size,rotation,motion});
  const box = (finish: PartFinish, at: V3, size: V3, rotation?: V3, motion?: CraftPart["motion"]) => add("box",finish,at,size,rotation,motion);
  const hull = (at: V3, size: V3, finish: PartFinish="body") => add("orb",finish,at,size);
  const ring = (at: V3, size: V3, rotation: V3=[P/2,0,0], motion?: CraftPart["motion"]) => add("ring","glow",at,size,rotation,motion);
  const prop = (x: number, y: number, z: number, radius=0.7) => {
    add("ring","dark",[x,y,z],[radius,radius,0.9]);
    box("trim",[x,y,z],[radius*1.7,0.09,0.08],[0,0,0],"prop");
    box("trim",[x,y,z],[0.09,radius*1.7,0.08],[0,0,0],"prop");
    hull([x,y,z+0.05],[0.16,0.16,0.15],"dark");
  };
  if (id === "rally") {
    box("body",[0,0.55,0],[1.65,0.5,2.7]);
    box("trim",[0,0.86,-0.1],[1.35,0.13,1.2]);
    box("glass",[0,0.98,0.45],[1.2,0.32,0.07],[-0.35,0,0]);
    box("dark",[0,0.48,1.42],[1.65,0.18,0.16]);
    box("dark",[0,0.48,-1.42],[1.65,0.18,0.16]);
    for (const x of [-0.58,0.58]) { hull([x,0.68,1.38],[0.2,0.14,0.08],"glow"); box("trim",[x,1.08,-0.65],[0.08,0.38,0.08]); }
    box("trim",[0,1.27,-0.65],[1.4,0.08,0.12]);
    box("dark",[0,0.72,0.83],[0.5,0.06,0.35]);
  } else if (id === "roadster") {
    hull([0,0.48,0.1],[0.88,0.3,1.55]);
    box("trim",[0,0.62,0.75],[0.23,0.07,1.4]);
    hull([0,0.75,0.4],[0.65,0.3,0.45],"glass");
    for(const x of [-0.7,0.7]) { box("body",[x,0.58,0],[0.22,0.3,2]); box("glow",[x,0.6,-1.25],[0.22,0.07,0.12]); }
    box("dark",[0,0.7,-0.7],[0.75,0.35,0.16]);
    box("trim",[0,0.6,1.53],[1.2,0.08,0.12]);
  } else if (id === "hydrofoil") {
    hull([0,0.25,0.1],[0.8,0.35,1.8]);
    box("trim",[0,0.48,0.5],[0.7,0.08,1.5]);
    for(const z of [-0.9,0.9]) { box("dark",[0,-0.35,z],[0.12,0.85,0.13]); box("trim",[0,-0.75,z],[2.3,0.07,0.4],[0,0,0],"fin"); }
    hull([0,0.72,0.45],[0.6,0.3,0.5],"glass"); prop(0,0.25,-1.67,0.42);
    box("glow",[0,0.48,1.7],[0.2,0.08,0.2]);
  } else if (id === "outrigger") {
    hull([0,0.18,0],[0.65,0.35,1.7]);
    for(const x of [-1.15,1.15]) { hull([x,0.05,0],[0.23,0.22,1.8],"trim"); for(const z of [-0.8,0.8]) box("dark",[x/2,0.16,z],[1.15,0.1,0.1]); }
    box("trim",[0,1.6,-0.8],[0.07,2.5,0.07]);
    add("cone","body",[0.3,1.8,-0.8],[1.4,1.8,0.08],[0,0,0.18]);
    prop(0,0.27,-1.5,0.35);
  } else if (id === "canard") {
    hull([0,0.45,0],[0.44,0.34,1.8]);
    for(const side of [-1,1]) {
      box("body",[side*1.15,0.48,-0.3],[1.9,0.09,0.7],[0,side*0.3,0]);
      box("trim",[side*0.6,0.52,1.0],[0.9,0.06,0.3],[0,-side*0.2,0],"fin");
      box("trim",[side*0.6,0.85,-1.3],[0.08,0.7,0.5],[0,0,-side*0.3]);
      add("tube","dark",[side*0.35,0.4,-1.42],[0.21,0.5,0.21],[P/2,0,0]); ring([side*0.35,0.4,-1.7],[0.18,0.18,0.5],[0,0,0]);
    }
    hull([0,0.72,0.5],[0.34,0.25,0.65],"glass");
  } else if (id === "vtol") {
    hull([0,0.48,0],[0.6,0.4,1.45]);
    box("trim",[0,0.65,0],[2.8,0.1,0.65]);
    for(const x of [-1.45,1.45]) {
      add("tube","body",[x,0.65,-0.05],[0.55,0.3,0.55]);
      ring([x,0.82,-0.05],[0.48,0.48,0.7]);
      for(const angle of [0,P/2]) box("dark",[x,0.84,-0.05],[0.9,0.055,0.1],[0,angle,0],"field");
      box("dark",[x*0.5,-0.06,0],[0.1,0.4,1.5]);
    }
    box("body",[0,0.85,-1.15],[1.45,0.08,0.4]); hull([0,0.8,0.6],[0.5,0.35,0.55],"glass");
  } else if (id === "nautilus") {
    hull([0,0.5,0],[0.9,0.7,1.4]);
    for(const z of [-0.75,0,0.75]) add("ring","trim",[0,0.5,z],[0.82,0.64,0.7]);
    hull([0,0.57,1.15],[0.55,0.48,0.4],"glass");
    box("trim",[0,1.2,-0.3],[0.12,0.75,0.12]); box("trim",[0,1.55,-0.15],[0.14,0.12,0.4]);
    for(const x of [-0.9,0.9]) { box("body",[x,0.4,-0.35],[0.7,0.08,0.55],[0,0,0],"fin"); hull([x,0.42,0.5],[0.17,0.17,0.24],"glow"); }
    prop(0,0.5,-1.42,0.45);
  } else if (id === "raypod") {
    hull([0,0.5,0],[0.7,0.42,1.5]);
    hull([0,0.72,0.35],[0.62,0.4,0.8],"glass");
    for(const side of [-1,1]) { hull([side*0.95,0.4,-0.05],[0.95,0.09,0.9],"trim"); box("glow",[side*1.7,0.4,-0.2],[0.08,0.06,0.8]); prop(side*0.6,0.4,-1.2,0.28); }
    box("body",[0,0.8,-1.1],[0.1,0.6,0.55],[0,0,0],"fin");
  } else if (id === "triad") {
    hull([0,0.36,0],[0.65,0.23,1.2]);
    for(const [x,z] of [[0,1.25],[-1.1,-0.8],[1.1,-0.8]]) {
      box("trim",[x/2,0.28,z/2],[0.13,0.12,Math.hypot(x,z)],[0,Math.atan2(x,z),0]);
      add("tube","body",[x,0.2,z],[0.48,0.18,0.48]); ring([x,0.08,z],[0.48,0.48,1]);
      add("tube","glow",[x,0.04,z],[0.3,0.03,0.3]);
    }
    ring([0,0.5,0],[0.6,0.6,0.7],[P/2,0,0],"field");
  } else if (id === "flux") {
    box("body",[0,0.35,0],[1.25,0.25,2.3]);
    for(const x of [-0.95,0.95]) {
      add("ring","trim",[x,0.5,0],[0.85,1.3,1],[0,P/2,0]);
      add("ring","glow",[x,0.5,0],[0.7,1.1,0.65],[0,P/2,0],"field");
      box("dark",[x*0.5,0.45,0],[0.9,0.12,0.16]);
    }
    hull([0,0.65,0.6],[0.55,0.3,0.55],"glass");
    box("glow",[0,0.15,0],[0.7,0.04,1.9]);
  }
  return parts;
}
