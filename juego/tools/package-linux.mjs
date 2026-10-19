import {spawnSync} from "node:child_process";
import {access,mkdtemp,readFile,readdir,realpath,symlink,writeFile,mkdir,rm} from "node:fs/promises";
import {delimiter,dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {tmpdir} from "node:os";
import {constants} from "node:fs";
import {GTK_PACKAGES,gtkLibrary,gtkProxySource,requiredGlibc} from "./linux-package-support.mjs";

if(process.platform!=="linux")throw new Error("Run dist:linux on Linux; use dist:windows on Windows");
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),cli=join(root,"node_modules/@tauri-apps/cli/tauri.js");
function run(command,args,options={}) {
  const result=spawnSync(command,args,{cwd:root,stdio:"inherit",...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${command} exited with ${result.status??result.signal}`);
  return result.stdout?.trim();
}
const flags=new Set(process.argv.slice(2));
for(const flag of flags)if(!["--bundle-only","--verbose"].includes(flag))throw new Error(`Unknown packaging option: ${flag}`);
const scratch=await mkdtemp(join(tmpdir(),"btr-linux-package-"));
try {
  if(!flags.has("--bundle-only"))run(process.execPath,[cli,"build","--no-bundle","--ci"]);
  const metadata=JSON.parse(run("cargo",["metadata","--no-deps","--locked","--format-version","1"],{cwd:join(root,"src-tauri"),encoding:"utf8",stdio:["ignore","pipe","inherit"]}));
  const target=metadata.target_directory;
  const binary=join(target,"release/bubble-team-racing");
  const versionInfo=run("readelf",["--version-info",binary],{encoding:"utf8",stdio:["ignore","pipe","inherit"]});
  const glibc=requiredGlibc(versionInfo);
  const override=join(scratch,"linux.json");
  await writeFile(override,JSON.stringify({bundle:{linux:{deb:{depends:[`libc6 (>= ${glibc})`]}}}}));

  // The GTK plugin recursively searches /usr/lib and can accidentally collect
  // private libraries from VMware/other installed programs. Give only its
  // explicit GTK library queries a flat directory of the host's real GTK files.
  // Module, font, theme and transitive dependency lookup remain unchanged.
  const libraries=join(scratch,"gtk-libraries");await mkdir(libraries);
  const requested=process.env.PKG_CONFIG||"pkg-config";
  let pkgConfig;
  for(const dir of (requested.includes("/")?[""]:(process.env.PATH??"").split(delimiter))){
    const candidate=dir?join(dir,requested):resolve(root,requested);
    try{await access(candidate,constants.X_OK);pkgConfig=await realpath(candidate);break;}catch{}
  }
  if(!pkgConfig)throw new Error("pkg-config is required to package the Linux desktop app");
  const seen=new Set();
  for(const name of GTK_PACKAGES) {
    const libdir=run(pkgConfig,["--variable=libdir",name],{encoding:"utf8",stdio:["ignore","pipe","inherit"]});
    for(const entry of await readdir(libdir,{withFileTypes:true})) {
      if(!(entry.isFile()||entry.isSymbolicLink())||!gtkLibrary(entry.name)||seen.has(entry.name))continue;
      seen.add(entry.name);await symlink(await realpath(join(libdir,entry.name)),join(libraries,entry.name));
    }
  }
  if(!seen.size)throw new Error("No GTK libraries found; install the Linux build dependencies");
  const proxy=join(scratch,"pkg-config.cjs");
  await writeFile(proxy,gtkProxySource(libraries,pkgConfig),{mode:0o755});
  // Tauri's GTK plugin chooses pkgconf/pkg-config from PATH, ignoring PKG_CONFIG.
  const tools=join(scratch,"bin");await mkdir(tools);
  for(const name of ["pkgconf","pkg-config"])await symlink(proxy,join(tools,name));
  const probe=run(join(tools,"pkgconf"),["--variable=libdir","librsvg-2.0"],{encoding:"utf8",stdio:["ignore","pipe","inherit"]});
  if(probe!==libraries)throw new Error("GTK library proxy did not select its isolated directory");
  const config=JSON.parse(await readFile(join(root,"src-tauri/tauri.conf.json"),"utf8"));
  // Discard a previous generated AppDir, which may already contain foreign libraries.
  await rm(join(target,"release/bundle/appimage",`${config.productName}.AppDir`),{recursive:true,force:true});
  console.log(`Packaging DEB: GLIBC >= ${glibc}; ${seen.size} direct GTK library files`);
  run(process.execPath,[cli,"bundle","--bundles","deb,appimage","--ci","--config",override,...(flags.has("--verbose")?["--verbose"]:[])],{env:{...process.env,PATH:tools+delimiter+process.env.PATH}});
} finally {
  await rm(scratch,{recursive:true,force:true});
}
