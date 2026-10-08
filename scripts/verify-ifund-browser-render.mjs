import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const remote = process.env.IFUND_SMOKE_URL?.trim();
const origin = remote?.replace(/\/+$/,'') || 'http://127.0.0.1:4179';
let preview = null;
function delay(ms){return new Promise(resolve => setTimeout(resolve,ms))}
if(!remote) {
  preview=spawn('./node_modules/.bin/vite',['preview','--host','127.0.0.1','--port','4179','--strictPort'],{
    cwd:process.cwd(),stdio:'ignore',
  });
  let ready=false;
  for(let i=0;i<45;i++){
    if(preview.exitCode!==null)throw Error('Local preview exited unexpectedly');
    try{const res=await fetch(origin+'/');if(res.ok){ready=true;break}}catch{}
    await delay(200);
  }
  if(!ready){preview.kill();throw Error('Timed out waiting for Vite preview')}
}

let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const route of ['/','/login','/activate']){
    const context=await browser.newContext({viewport:{width:420,height:850}});
    const page=await context.newPage();
    const exceptions=[];
    page.on('pageerror',err=>exceptions.push(err.message));
    const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:25000});
    assert.equal(response?.status(),200,'HTML request failed for '+route);
    await page.getByRole('button',{name:'I Agree — Continue'}).waitFor({timeout:12000});
    await page.getByRole('button',{name:'I Agree — Continue'}).click();
    if(route==='/login'){
      await page.getByRole('heading',{name:'Welcome back'}).waitFor({timeout:12000});
      await page.getByLabel('Password').waitFor({timeout:12000});
    }else if(route==='/activate'){
      await page.getByRole('heading',{name:'Authorize a device'}).waitFor({timeout:12000});
    }else{
      await page.getByText('What If?',{exact:false}).first().waitFor({timeout:12000});
    }
    assert.deepEqual(exceptions,[],'Browser threw uncaught JS errors at '+route);
    console.log('PASS browser mounted IFund '+route);
    await context.close();
  }
  const chunks=fs.readdirSync('dist/assets');
  assert.ok(chunks.some(x=>/^react-runtime-[^/]+\.js$/.test(x)),
    'The shared React/ReactDOM/Router runtime must not be split into cyclic chunks');
  assert.ok(!chunks.some(x=>/^react-dom-[^/]+\.js$/.test(x)),
    'A separate ReactDOM vendor chunk reintroduces a React circular dependency');
  console.log('PASS React chunk is coherent without the useLayoutEffect startup regression.');
} finally {
  await browser?.close();
  if(preview){preview.kill();await delay(200)}
}
