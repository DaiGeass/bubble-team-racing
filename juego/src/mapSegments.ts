/** Never bridge a hole, overshoot the closing sample, or close an open route. */
export function mapSegments(flags: Uint8Array, closed: boolean, stride: number): [number, number][] {
  const segments: [number, number][] = [];
  const end = closed ? flags.length : flags.length - 1;
  const step = Math.max(1, Math.floor(stride));
  for (let i = 0; i < end; i += step) {
    const next = Math.min(end, i + step);
    // Split a coarse segment into its solid runs so even short gaps remain visible.
    let start = i;
    for (let k = i; k < next; k++) {
      if ((flags[k] & 1) && (flags[(k + 1) % flags.length] & 1)) continue;
      if (k > start) segments.push([start, k]);
      start = k + 1;
    }
    if (start < next) segments.push([start, next % flags.length]);
  }
  return segments;
}
