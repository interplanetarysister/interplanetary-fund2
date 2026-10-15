import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

export function verifyReleaseContract(root=process.cwd()) {
  const errors=[];
  const read=(p)=>{ try{return readFileSync(join(root,p),'utf8')}catch{errors.push('missing:'+p);return ''} };
  const json=(p)=>{try{return JSON.parse(read(p))}catch{errors.push('malformed:'+p);return null}};
  const pkg=json('package.json');
  if(pkg?.engines?.node!=='>=20')errors.push('Node engine must allow every major release 20 and greater');
  // Host-managed defaults are the portable floating selector. Cloudflare Workers
  // Builds interprets "node" in version files as an invalid install version.
  for (const filename of ['.node-version', '.nvmrc']) {
    if (existsSync(join(root, filename))) errors.push(filename + ' overrides managed Node selection; remove the version file');
  }
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
    for(const [jobId,job] of Object.entries(workflow?.jobs||{})){
      for(const step of job?.steps||[]){
        if(!/^actions\/setup-node@/i.test(step?.uses||''))continue;
        found++;
        const version=String(step.with?.['node-version']||'').trim();
        // A Node 20 pin is allowed only for the dedicated minimum-runtime CI lane.
        // All other build/runtime jobs must use a floating supported selector.
        const minimumRuntimeLane = file==='quality-gates.yml' && jobId==='quality' && job.name==='Node 20 Base44 compatibility build';
        if(!['node','>=20'].includes(version) && !(minimumRuntimeLane && version==='20'))
          errors.push(p+' pins a Node major outside the dedicated Node 20 compatibility lane');
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
