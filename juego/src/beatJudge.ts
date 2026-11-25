// ---------------------------------------------------------------------------
// On a song's circuit, everything you do is also judged against the beat: a
// drift let go, a landing, a note taken, a pass. Close to a beat is perfect,
// a little off is good, and far off breaks the run. A run of perfects builds
// a combo that multiplies what each one is worth; the total is the rhythm
// score, and at the end it becomes a grade.
// ---------------------------------------------------------------------------

export type BeatGrade = "perfect" | "good" | "off";

/** Seconds either side of a beat that still count. */
export const PERFECT_WINDOW = 0.075;
export const GOOD_WINDOW = 0.16;

/** How far a moment is from the nearest beat, in seconds, from where it is in the beat (0..1). */
export function beatDistance(phase: number, beatLen: number): number {
  const p = ((phase % 1) + 1) % 1;
  return Math.min(p, 1 - p) * beatLen;
}

export function gradeFor(phase: number, beatLen: number): BeatGrade {
  const d = beatDistance(phase, beatLen);
  return d <= PERFECT_WINDOW ? "perfect" : d <= GOOD_WINDOW ? "good" : "off";
}

export class BeatJudge {
  combo = 0;
  best = 0;
  score = 0;
  perfect = 0;
  good = 0;
  off = 0;

  reset() {
    this.combo = this.best = this.score = this.perfect = this.good = this.off = 0;
  }

  /** Judge one action. Returns the grade and the points it was worth. */
  judge(phase: number, beatLen: number): { grade: BeatGrade; points: number } {
    if (!Number.isFinite(phase) || !Number.isFinite(beatLen) || beatLen <= 0) return { grade: "off", points: 0 };
    const grade = gradeFor(phase, beatLen);
    let points = 0;
    if (grade === "perfect") {
      this.perfect++;
      this.combo++;
      points = Math.round(100 * (1 + Math.min(10, this.combo) * 0.2));
    } else if (grade === "good") {
      this.good++;
      this.combo++;
      points = Math.round(50 * (1 + Math.min(10, this.combo) * 0.1));
    } else {
      this.off++;
      this.combo = 0;
    }
    this.best = Math.max(this.best, this.combo);
    this.score += points;
    return { grade, points };
  }

  /** S, A, B, C or D from how much of what was done was on the beat. */
  rank(): "S" | "A" | "B" | "C" | "D" {
    const n = this.perfect + this.good + this.off;
    if (n === 0) return "D";
    const acc = (this.perfect + this.good * 0.5) / n;
    return acc >= 0.85 && this.best >= 8 ? "S" : acc >= 0.7 ? "A" : acc >= 0.5 ? "B" : acc >= 0.3 ? "C" : "D";
  }
}
