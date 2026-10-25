// Real app and real API: no intercepted product responses and no fixture evidence.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.RESEARCH_API_BASE;if(!base)throw Error('RESEARCH_API_BASE is required');
const codes=['9556041613354','9556041610841','9316401203164','9348219002738'];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const report=[];
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('#barcode').waitFor();
 const expected=JSON.parse(await readFile(new URL('../worker/public/preview-build.json',import.meta.url),'utf8'));assert.equal(await page.locator('meta[name="preview-source-digest"]').getAttribute('content'),expected.sourceDigest,'Live app does not match this source version');
 for(const code of codes){
  let observed={};
  try{
   await page.locator('#barcode').fill(code);const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/products/'+code,{timeout:90000});await page.locator('#lookup').click();const response=await responsePromise;assert.equal(response.status(),200,'Live product API failed');const api=await response.json();
   await page.waitForFunction(()=>document.querySelector('#result .status')?.textContent&&!document.querySelector('#result .status').textContent.includes('Checking'),null,{timeout:90000});
   const text=await page.locator('#result').innerText();
   const links=await page.locator('#result a').evaluateAll(els=>els.map(e=>({text:e.textContent,url:e.href})));
   await page.screenshot({path:'test-results/'+code+'.png',fullPage:true});
   observed={links,text,sourceErrors:[...(api.errors||[]),...(api.web?.errors||[])]};const evidence=(api.web?.results||[]).filter(p=>p.verification==='page_retrieved'&&p.statements?.length);
   const hasPage=evidence.length&&evidence.every(p=>links.some(l=>l.url===p.url));
   assert.ok(hasPage&&/Retrieved product-page evidence/.test(text)&&!/No matching product page could be verified/.test(text),'No verified product-page declaration displayed');
   for(const p of evidence)for(const statement of p.statements)assert.ok(text.replace(/\s+/g,' ').includes(statement.excerpt.replace(/\s+/g,' ')),'Fetched declaration missing from rendered UI');
   await page.locator('#glutenPreference').evaluate(e=>e.closest('details').open=true);
   for(const mode of ['strict','moderate','flexible']){await page.locator('#glutenPreference').selectOption(mode);if(api.assessment.conflicting)assert.match(await page.locator('#result .status').innerText(),/CONFLICTING/);else if(api.assessment.status==='RED')assert.match(await page.locator('#result .status').innerText(),/GLUTEN RISK/)}
   report.push({code,passed:true,...observed});
  }catch(error){report.push({code,passed:false,...observed,error:error.message})}
 }
}finally{await writeFile('test-results/browser-live.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify(report));if(report.length!==4||report.some(x=>!x.passed))process.exitCode=1;
