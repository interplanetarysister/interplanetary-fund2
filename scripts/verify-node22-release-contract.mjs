import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

export function verifyReleaseContract(root=process.cwd()) {
  const errors=[];
  const read=(p)=>{ try{return readFileSync(join(root,p),'utf8')}catch{errors.push('missing:'+p);return ''} };
  const json=(p)=>{try{return JSON.parse(read(p))}catch{errors.push('malformed:'+p);return null}};
  const pkg=json('package.json');
  if(pkg?.engines?.node!=='>=20')errors.push('Node engine must allow every major release 20 and greater');
  if(read('.node-version').trim()!=='node')errors.push('.node-version must track the current Node release');
  if(read('.nvmrc').trim()!=='node')errors.push('.nvmrc must track the current Node release');
  if(Number(process.versions.node.split('.')[0])<20)errors.push('Node 20 or newer required');
  const lock=json('package-lock.json');
  if(lock?.packages?.['']?.engines?.node!=='>=20')errors.push('Lockfile must declare Node >=20');
  let files=[];
  try{files=readdirSync(join(root,'.github/workflows')).filter(p=>/\.ya?ml$/.test(p))}
  catch{errors.push('missing:.github/workflows')}
  let found=0;
  for(const file of files){
    const p=join('.github/workflows',file);
    let workflow;
    try{workflow=yaml.load(read(p))}catch{errors.push('malformed:'+p);continue}
    for(const job of Object.values(workflow?.jobs||{})){
      for(const step of job?.steps||[]){
        if(!/^actions\/setup-node@/i.test(step?.uses||''))continue;
        found++;
        const version=String(step.with?.['node-version']||'').trim();
        if(!['node','>=20'].includes(version))errors.push(p+' pins a Node major instead of using a floating Node 20+ selector');
      }
    }
  }
  if(!found)errors.push('No Node setup configured');
  return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const errors=verifyReleaseContract();
 if(errors.length){for(const error of errors)console.error(error);process.exitCode=1}
 else console.log('PASS: Node >=20 with floating current Node selectors');
}
