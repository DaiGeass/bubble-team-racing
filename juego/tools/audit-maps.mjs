import {build} from "esbuild";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const dir=await mkdtemp(join(tmpdir(),"btr-map-inspection-"));
try{
  const outfile=join(dir,"map-audit.mjs");
  await build({entryPoints:["tools/map-audit.ts"],outfile,bundle:true,platform:"node",format:"esm"});
  const result=spawnSync(process.execPath,[outfile,...process.argv.slice(2)],{stdio:"inherit"});
  if(result.error)throw result.error;process.exitCode=result.status??1;
}finally{await rm(dir,{recursive:true,force:true});}
