import * as THREE from "three";

type EmissiveMaterial = THREE.Material & { emissive: THREE.Color };
interface SavedMaterial {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  emissive: THREE.Color | null;
}

/** Collect unique materials once; transitions restore the actual original finish. */
export class VehicleEffects {
  private readonly materials: SavedMaterial[] = [];
  private ghost = false;
  private exploding = false;
  private flash = -1;

  constructor(root: THREE.Object3D) {
    const seen = new Set<THREE.Material>();
    root.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        if (seen.has(m)) continue;
        seen.add(m);
        this.materials.push({
          material: m, opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite,
          emissive: "emissive" in m ? (m as EmissiveMaterial).emissive.clone() : null,
        });
      }
    });
  }

  update(ghost: boolean, exploding: boolean, time: number) {
    if (ghost !== this.ghost) {
      this.ghost = ghost;
      for (const saved of this.materials) {
        const m = saved.material;
        m.opacity = ghost ? Math.min(saved.opacity, 0.34) : saved.opacity;
        const transparent = ghost || saved.transparent;
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.needsUpdate = true;
        }
        m.depthWrite = ghost ? false : saved.depthWrite;
      }
    }
    if (exploding) {
      const flash = Math.abs(Math.sin(time * 40)) > 0.5 ? 0xff4d6d : 0xffffff;
      if (flash !== this.flash) {
        for (const saved of this.materials) {
          if (saved.emissive) (saved.material as EmissiveMaterial).emissive.setHex(flash);
        }
        this.flash = flash;
      }
    } else if (this.exploding) {
      for (const saved of this.materials) {
        if (saved.emissive) (saved.material as EmissiveMaterial).emissive.copy(saved.emissive);
      }
      this.flash = -1;
    }
    this.exploding = exploding;
  }

  restore() {
    this.update(false, false, 0);
  }
}
