// Uses the real browser OCR engine, never a mocked recognise() result.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const live=process.env.RESEARCH_API_BASE;let server;
const allowed=['index.html','research-ui.js','label-analysis.js','label-photo.js','manifest.webmanifest'];
if(!live){server=createServer(async(req,res)=>{try{const path=req.url.split('?')[0].replace(/^\//,'')||'index.html';if(!allowed.includes(path)){res.writeHead(404);res.end();return}res.setHeader('content-type',path.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(new URL('../'+path,import.meta.url)))}catch{res.writeHead(500);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r))}
const base=live||'http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const checks=[];
await mkdir('test-results',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});const writes=[];const pageErrors=[];
 context.on('request',r=>{if(!['GET','HEAD'].includes(r.method())||r.postDataBuffer()?.length)writes.push({url:r.url(),method:r.method()})});
 const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
 // Barcode camera CDN is unrelated to the OCR engine; keep it from delaying local fixtures.
 if(!live)await page.route('https://unpkg.com/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
 if(!live)await page.route('**/api/products/*',route=>route.fulfill({json:{barcode:'1234567890128',found:false,assessment:{status:'AMBER',claim:false,notDetected:false,conflicting:false,reason:'No online evidence.'},web:{results:[]}}}));
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
 if(live){const expected=JSON.parse(await readFile(new URL('../worker/public/preview-build.json',import.meta.url),'utf8'));assert.equal(await page.locator('meta[name="preview-source-digest"]').getAttribute('content'),expected.sourceDigest)}
 async function lookup(code){await page.locator('#barcode').fill(code);await page.locator('#lookup').click();await page.locator('#labelPhoto').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#result .status')?.textContent.includes('Checking'),null,{timeout:90000})}
 async function synthetic(lines){const data=await page.evaluate(lines=>{const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=600;const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1400,600);c.fillStyle='black';c.font='38px Arial';lines.forEach((line,i)=>c.fillText(line,50,75+i*70));return canvas.toDataURL('image/png')},lines);return {name:'test-label.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')}}
 async function readPhoto(file){await page.locator('#labelPhoto').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#labelPhotoEvidence .status')||document.querySelector('#labelPhotoStatus')?.textContent.startsWith('Could not read'),null,{timeout:120000});const status=await page.locator('#labelPhotoStatus').innerText();assert.ok(!status.startsWith('Could not read'),status);await page.waitForFunction(()=>!document.querySelector('#labelPhoto').disabled,null,{timeout:15000})}
 await lookup('1234567890128');
 const risk=await synthetic(['DEMO SNACK','INGREDIENTS: Rice flour, wheat flour.','CONTAINS: WHEAT.','MAY CONTAIN BARLEY.','GLUTEN FREE.']);
 await readPhoto(risk);assert.match(await page.locator('#labelPhotoEvidence').innerText(),/WHEAT|wheat/);assert.match(await page.locator('#labelPhotoEvidence .status').innerText(),/RISK|CONFLICT/);assert.ok((await page.locator('#labelPhotoEvidence').getAttribute('class')).includes('red'));assert.ok(await page.locator('#labelPhotoEvidence mark').count()>0);checks.push('Actual OCR read a synthetic warning label and highlighted wheat/barley');
 await page.screenshot({path:'test-results/ocr-risk-label.png',fullPage:true});
 // A new scan must remove the previous photo and text, not carry it to another item.
 await page.locator('#barcode').fill('1234567890128');await page.locator('#lookup').click();await page.locator('#labelPhoto').waitFor({state:'visible'});assert.equal(await page.locator('#labelPhotoEvidence').innerText(),'');checks.push('A new lookup clears previous photo evidence');
 const positive=await synthetic(['DEMO RICE SNACK','INGREDIENTS: Rice, water, salt.','GLUTEN NOT DETECTED.','GLUTEN FREE.']);
 await readPhoto(positive);await page.locator('#glutenPreference').evaluate(e=>e.closest('details').open=true);
 if(!live)await page.evaluate(()=>{lastResearch=null});
 for(const mode of ['strict','moderate','flexible']){await page.locator('#glutenPreference').selectOption(mode);assert.ok((await page.locator('#labelPhotoEvidence').getAttribute('class')).includes('amber'));const labelStatus=await page.locator('#labelPhotoEvidence .status').innerText();assert.ok(!labelStatus.includes('VERIFIED SAFE'));if(!live){if(mode==='strict')assert.match(labelStatus,/AMBER/);if(mode==='moderate')assert.match(labelStatus,/GLUTEN NOT DETECTED/);if(mode==='flexible')assert.match(labelStatus,/GLUTEN DECLARATION/)}}
 checks.push('Positive OCR wording remains unverified under every preference');
 await page.locator('#labelPhoto').setInputFiles(risk);await page.locator('#labelPhotoCancel').click();assert.match(await page.locator('#labelPhotoStatus').innerText(),/cancelled/);assert.equal(await page.locator('#labelPhotoEvidence').innerText(),'');checks.push('Cancellation clears evidence and restores the input');
 // Independently retrieved manufacturer label image: image text, not a preset OCR answer.
 const source='https://cdn.prod.website-files.com/6351d7b549918d02ead5e0fe/6850fb436db133ca23f527e2_Wheat%20Free%20Oats%20600g%20NIP.avif';
 const response=await fetch(source,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,'Manufacturer label fixture is unavailable');
 await lookup('9348219002738');await readPhoto({name:'manufacturer-oats-label.avif',mimeType:'image/avif',buffer:Buffer.from(await response.arrayBuffer())});
 const evidence=await page.locator('#labelPhotoEvidence').innerText();assert.match(evidence,/GLUTEN|gluten/);assert.match(evidence,/OATS|oats/);assert.ok((await page.locator('#labelPhotoEvidence').getAttribute('class')).includes('red'));checks.push('Actual manufacturer label OCR detected gluten/oats; product identity remains unverified');
 await page.screenshot({path:'test-results/ocr-manufacturer-label.png',fullPage:true});assert.deepEqual(writes,[],'Photo/text must not be sent in HTTP request bodies');assert.deepEqual(pageErrors,[]);assert.ok(await page.locator('#start').isVisible());checks.push('No HTTP writes/photo uploads occurred; scanner control is retained');
 console.log(JSON.stringify({live:!!live,checks,manufacturerSource:source,photoReading:evidence}));await writeFile('test-results/ocr-checks.json',JSON.stringify({live:!!live,checks,manufacturerSource:source,photoReading:evidence},null,2));
}finally{await browser.close();server?.close()}
