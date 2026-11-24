import * as THREE from "three";

/**
 * The road of a song's circuit is not there until you get near it: it is
 * built in a circle round the driver that swells on every beat, with a line of
 * light where it is being made. One pair of uniforms, shared by every material
 * that takes part.
 */
export const reveal = {
  center: { value: new THREE.Vector3() },
  radius: { value: 1e7 },
};

export function revealShader(shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string }) {
  shader.uniforms.uRevealCenter = reveal.center;
  shader.uniforms.uRevealRadius = reveal.radius;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vRevealPos;")
    .replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nvec4 revealP = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nrevealP = instanceMatrix * revealP;\n#endif\nvRevealPos = (modelMatrix * revealP).xyz;",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform vec3 uRevealCenter;\nuniform float uRevealRadius;\nvarying vec3 vRevealPos;")
    .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nfloat revealD = distance(vRevealPos.xz, uRevealCenter.xz);\nif (revealD > uRevealRadius) discard;")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.45, 0.95, 1.0) * smoothstep(uRevealRadius - 8.0, uRevealRadius, revealD) * 2.5;");
}
