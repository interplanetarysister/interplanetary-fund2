import {chromium} from 'playwright';
import assert from 'node:assert/strict';
// Run against a locally built preview on port 4179. All API responses are isolated fixtures.
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>localStorage.setItem('base44_access_token','fixture'));
await context.route('**/api/**',async route=>{
 const u=route.request().url();let body=[];
 if(u.includes('public-settings'))body={id:'6a67a778342a8fe05ee79cba',public_settings:'public_without_login'};
 else if(u.includes('/User/me'))body={id:'fixture',email:'user@interplanetaryfund.com',role:'user',tips_completed:true,onboarding_completed:true,subscription_tier:'enterprise',subscription_status:'active'};
 else if(u.includes('recordLegalAcceptance'))body={terms_version:'2026-10-13-v3',accepted:true};
 else if(u.includes('getPayPalSubscriptionOptions'))body={plans:[],readiness:'verification_checked',live_configured:true,webhook_configured:true};
 else if(u.includes('/functions/'))body={ok:true,enabled:false,flags:{},campaigns:[],entries:[],summary:{}};
 await route.fulfill({json:body});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const path of ['/dashboard','/subscriptions','/download','/discover','/campaign/sample']){
 await page.goto('http://127.0.0.1:4179'+path,{waitUntil:'networkidle'});
 const tour=page.getByRole('dialog',{name:/tour|walkthrough/i});await tour.waitFor();
 assert.match(await tour.innerText(),/Step 1 of [3-9]/i);await tour.getByRole('button',{name:'Next'}).click();assert.match(await tour.innerText(),/Step 2/i);await tour.getByRole('button',{name:'Next'}).click();assert.match(await tour.innerText(),/Step 3/i);await tour.getByRole('button',{name:'Close tour'}).click();
 if(path==='/dashboard') await page.getByRole('link',{name:/Get the app/}).waitFor();
 console.log('PASS walkthrough '+path);
}
await page.goto('http://127.0.0.1:4179/dashboard',{waitUntil:'networkidle'});await page.getByText(/Step 1 of 3/i).waitFor();console.log('PASS walkthrough reappears on return despite tips_completed');
assert.deepEqual(errors,[]);await browser.close();
