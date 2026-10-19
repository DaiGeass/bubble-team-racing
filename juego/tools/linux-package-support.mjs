/** Only direct files from pkg-config's own libdir belong in GTK's explicit library scan. */
export const GTK_PACKAGES = ["gdk-pixbuf-2.0", "gobject-2.0", "gio-2.0", "librsvg-2.0", "pango", "pangocairo", "pangoft2"];
export function gtkLibrary(name) {
  return /^lib(?:gdk_pixbuf|gobject|gio|rsvg|pango|pangocairo|pangoft2)-[^/]+\.so(?:\.[0-9.]+)?$/.test(name);
}
export function requiredGlibc(output) {
  const versions = [...output.matchAll(/\bGLIBC_([0-9]+(?:\.[0-9]+)+)\b/g)].map(m => m[1]);
  if (!versions.length) throw new Error("No GLIBC version requirements found in the Linux executable");
  return versions.sort((a, b) => {
    const x=a.split(".").map(Number), y=b.split(".").map(Number);
    for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]??0)-(y[i]??0);if(d)return d;}
    return 0;
  }).at(-1);
}

export function gtkProxySource(libraries,pkgConfig){
  return `#!/usr/bin/env node
const {spawnSync}=require("node:child_process");
const args=process.argv.slice(2),packages=new Set(${JSON.stringify(GTK_PACKAGES)});
if(args.length===2&&args[0]==="--variable=libdir"&&packages.has(args[1]))console.log(${JSON.stringify(libraries)});
else {const r=spawnSync(${JSON.stringify(pkgConfig)},args,{stdio:"inherit"});if(r.error){process.stderr.write(r.error.message);process.exit(1);}process.exit(r.status??1);}
`;
}
