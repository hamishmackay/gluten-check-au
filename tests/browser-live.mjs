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
  try{
   await page.locator('#barcode').fill(code);await page.locator('#lookup').click();
   await page.waitForFunction(()=>document.querySelector('#result .status')?.textContent&&!document.querySelector('#result .status').textContent.includes('Checking'),null,{timeout:90000});
   const text=await page.locator('#result').innerText();
   const links=await page.locator('#result a').evaluateAll(els=>els.map(e=>({text:e.textContent,url:e.href})));
   await page.screenshot({path:'test-results/'+code+'.png',fullPage:true});
   const hasPage=links.some(l=>!/openfoodfacts|google\.com/.test(l.url));
   assert.ok(hasPage&&/Retrieved product-page evidence/.test(text)&&!/No matching product page could be verified/.test(text),'No verified product-page declaration displayed');
   assert.match(text,/ingredients|allergens|gluten/i);report.push({code,passed:true,links,text});
  }catch(error){report.push({code,passed:false,error:error.message})}
 }
}finally{await writeFile('test-results/browser-live.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify(report));if(report.length!==4||report.some(x=>!x.passed))process.exitCode=1;
