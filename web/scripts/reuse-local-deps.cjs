// Verification-only helper: read a user-specified installed project and copy matching
// dependencies into this standalone workspace. No edits to the donor project.
const fs=require('node:fs'),path=require('node:path');
const roots=process.argv.slice(2);
if(!roots.length) throw new Error('Pass an existing node_modules directory as the first argument');
const dest=path.join(__dirname,'..','node_modules');
const seen=new Set(),miss=new Set();
function stage(name,root=roots[0],optional=false) {
 const source=roots.map(r=>path.join(r,name)).find(d=>fs.existsSync(path.join(d,'package.json')));
 if(!source){if(!optional)miss.add(name);return;}
 if(seen.has(name))return;
 seen.add(name);
 const p=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
 fs.cpSync(source,path.join(dest,name),{recursive:true,force:false,errorOnExist:false});
 for(const d of Object.keys(p.dependencies||{}))stage(d,root);
 for(const d of Object.keys(p.optionalDependencies||{}))stage(d,root,true);
 for(const d of Object.keys(p.peerDependencies||{}))stage(d,root,true);
}
const p=require('../package.json');
for(const d of [...Object.keys(p.dependencies),...Object.keys(p.devDependencies)])stage(d);
console.log('Copied',seen.size,'packages. Top-level misses',Array.from(miss).join(', '));

