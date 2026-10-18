// Bundle to a unique temporary directory: no extra test runner or platform shell.
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "btr-graphics-"));
try {
  const outfile = join(dir, "graphics.test.mjs");
  await build({ entryPoints: ["tools/tests.ts"], outfile, bundle: true, platform: "node", format: "esm" });
  const result = spawnSync(process.execPath, [outfile], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
