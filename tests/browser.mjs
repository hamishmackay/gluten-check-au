import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const server=createServer(async(req,res)=>{try{const path=req.url.split('?')[0];if(!['/','/index.html','/research-ui.js','/manifest.webmanifest'].includes(path)){res.writeHead(404);res.end();return}res.setHeader('content-type',path.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(new URL('..'+(path==='/'?'/index.html':path),import.meta.url)))}catch{res.writeHead(500);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://unpkg.com/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
 const data={barcode:'1234567890123',found:true,product:{product_name:'Demo Rice 200g'},assessment:{status:'AMBER',claim:false,notDetected:true,conflicting:false,reason:'Gluten not detected declaration found.'},web:{results:[{title:'Demo Rice 200g',url:'https://store.com/product',match:'exact_barcode',verification:'page_retrieved',retrievedAt:new Date().toISOString(),statements:[{type:'gluten_not_detected',excerpt:'Gluten not detected'},{type:'ingredients',excerpt:'Ingredients: Rice, salt.'}]}]}};
 await page.route('**/api/products/*',route=>route.fulfill({json:data}));
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.locator('#barcode').fill(data.barcode);await page.evaluate(()=>lookup());
 await page.locator('#result a[href="https://store.com/product"]').waitFor();assert.match(await page.locator('#result').innerText(),/Ingredients: Rice, salt/);assert.match(await page.locator('#result .status').innerText(),/AMBER/);
 await page.locator('#glutenPreference').evaluate(el=>el.closest('details').open=true);await page.locator('#glutenPreference').selectOption('moderate');assert.equal(await page.locator('#result .status').innerText(),'GLUTEN NOT DETECTED');
 await page.locator('#glutenPreference').selectOption('flexible');assert.equal(await page.locator('#result .status').innerText(),'GLUTEN DECLARATION FOUND');
 await page.locator('#save').click();assert.ok(await page.locator('#start').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/gluten-check-browser.png',fullPage:true});console.log('Browser checks passed: barcode lookup, fetched evidence link, ingredients, preferences, save and mobile layout. Camera hardware not tested.');
}finally{await browser?.close();server.close()}
