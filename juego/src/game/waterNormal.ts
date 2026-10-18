import * as THREE from "three";
/** Periodic analytic ripples encoded once, with no downloads or vertex animation. */
export function waterNormal(size = 128): THREE.DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2; const v = y / size * Math.PI * 2;
    const dx = 0.32 * Math.cos(u * 3 + v * 2) + 0.18 * Math.cos(u * 7 - v * 3);
    const dy = 0.24 * Math.cos(u * 3 + v * 2) - 0.15 * Math.cos(u * 7 - v * 3);
    const length = Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
    pixels[i] = Math.round((0.5 - dx / length * 0.5) * 255);
    pixels[i + 1] = Math.round((0.5 - dy / length * 0.5) * 255);
    pixels[i + 2] = Math.round((0.5 + 1 / length * 0.5) * 255); pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 2; texture.needsUpdate = true;
  return texture;
}
