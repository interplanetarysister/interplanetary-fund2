import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { owningNavigationTab, navigationBackFallback, canReturnWithinApp } from '../src/lib/navigation.js';

assert.equal(owningNavigationTab('/campaign/example',true),'/discover');
assert.equal(owningNavigationTab('/notifications',true),'/inbox');
assert.equal(owningNavigationTab('/devices',true),'/profile');
assert.equal(owningNavigationTab('/community/thread',false),'/community');
assert.equal(owningNavigationTab('/globe',false),'/globe');
assert.equal(navigationBackFallback('/community/entry',false),'/community');
assert.equal(navigationBackFallback('/not-a-route',true),'/dashboard');
assert.equal(canReturnWithinApp({idx:0}),false);
assert.equal(canReturnWithinApp({idx:3}),true);

let preview;
const origin=(process.env.IFUND_SMOKE_URL||'http://127.0.0.1:4187').replace(/\/+$/,'');
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
if(!process.env.IFUND_SMOKE_URL) {
  preview=spawn('./node_modules/.bin/vite',['preview','--host','127.0.0.1','--port','4187','--strictPort'],{stdio:'ignore',cwd:process.cwd()});
  let up=false;
  for(let n=0;n<40;n++){
    if(preview.exitCode!==null)throw Error('Preview terminated');
    try{if((await fetch(origin+'/')).ok){up=true;break}}catch{}
    await delay(250);
  }
  if(!up)throw Error('Navigation preview not ready');
}
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const exceptions=[];
  page.on('pageerror',error=>exceptions.push(error.message));
  page.on('console',msg=>{
    if(msg.type()==='error' && /ReferenceError|TypeError|Route render error/.test(msg.text())) exceptions.push(msg.text().slice(0,220));
  });
  await page.goto(origin+'/discover',{waitUntil:'domcontentloaded',timeout:18000});
  await page.getByRole('button',{name:/I Agree — Continue/}).click();
  const bottom=page.getByRole('navigation',{name:'Bottom navigation'});
  await bottom.waitFor({timeout:12000});
  async function bottomTab(name,path) {
    await bottom.getByRole('link',{name,exact:true}).click({timeout:7000});
    await page.waitForURL(url=>url.pathname===path,{timeout:12000});
    await delay(400);
    assert.ok(!(await page.locator('body').innerText()).includes('This page hit a snag'),
      name+' must render without the route error boundary');
    const active=await bottom.locator('a.text-cyan-400').allTextContents();
    assert.deepEqual(active,[name],'Only the current '+name+' tab may be highlighted');
  }
  await bottomTab('Community','/community');
  await bottomTab('Help','/help');
  await bottomTab('Discover','/discover');

  await page.getByRole('button',{name:'Toggle menu'}).click({timeout:7500});
  assert.equal(await page.locator('#mobile-menu').isVisible(),true,
    'Empty toast overlay must not intercept the mobile menu button');
  await page.locator('#mobile-menu').getByRole('link',{name:'Community'}).click();
  await page.waitForURL(url=>url.pathname==='/community');
  assert.equal(await page.locator('#mobile-menu').count(),0,'Menu must close after changing pages');

  await bottom.getByRole('link',{name:'Global Globe',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/globe');
  await page.getByRole('heading',{name:'Campaigns across the planet'}).waitFor({timeout:12000});
  await page.getByRole('link',{name:/Browse campaigns/}).click();
  await page.waitForURL(url=>url.pathname==='/discover');
  assert.equal(await bottom.locator('a.text-cyan-400').first().innerText(),'Discover');

  await page.goto(origin+'/community/nonexistent',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Back'}).click({timeout:9000});
  await page.waitForURL(url=>url.pathname==='/community');
  assert.equal(await page.locator('#mobile-menu').count(),0);
  assert.deepEqual(exceptions,[],'No uncaught browser errors during mobile navigation');
  console.log('PASS: mobile tabs, active route, drawer overlay, globe return, deep-link back and browser startup');

  const desktop=await browser.newContext({viewport:{width:1280,height:800}});
  const d=await desktop.newPage();
  const desktopExceptions=[];
  d.on('pageerror',error=>desktopExceptions.push(error.message));
  await d.goto(origin+'/discover',{waitUntil:'domcontentloaded'});
  await d.getByRole('button',{name:/I Agree — Continue/}).click();
  await d.locator('aside').getByRole('link',{name:'Community'}).click({timeout:8500});
  await d.waitForURL(url=>url.pathname==='/community');
  assert.equal(await d.locator('aside').isVisible(),true);
  assert.deepEqual(desktopExceptions,[]);
  console.log('PASS: desktop sidebar changes route while preserving navigation');
  await desktop.close();
  await context.close();
}finally{
  await browser?.close();
  if(preview){preview.kill();await delay(200)}
}
