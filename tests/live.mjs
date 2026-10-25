// Deliberately fails when any acceptance product lacks retrieved declarations.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import worker from '../worker/src/index.js';
const require=createRequire(import.meta.url);const {GlutenResearchUI:{renderResearch}}=require('../research-ui.js');
const codes=['9556041613354','9556041610841','9316401203164','9348219002738'];
let failures=0;
for(const code of codes){
 try{
 const url=(process.env.RESEARCH_API_BASE||'https://local-api.com')+'/api/products/'+code;
 const response=process.env.RESEARCH_API_BASE?await fetch(url,{signal:AbortSignal.timeout(60000)}):await worker.fetch(new Request(url),{ENABLE_PUBLIC_API:'true',USER_RATE_LIMIT:{limit:async()=>({success:true})}});
 assert.equal(response.status,200,'API must respond successfully');const data=await response.json();
 const pages=(data.web?.results||[]).filter(p=>p.verification==='page_retrieved'&&p.statements?.length);
 console.log(JSON.stringify({barcode:code,name:data.product?.product_name,evidence:pages.map(p=>({url:p.url,match:p.match,statements:p.statements})),assessment:data.assessment,errors:[...(data.errors||[]),...(data.web?.errors||[])],attempts:data.web?.attempts||[]}));
 assert.ok(pages.length,'No automatically discovered product-page declarations');
 for(const mode of ['strict','moderate','flexible']){const view=renderResearch(data,mode);for(const p of pages){assert.ok(view.html.includes(p.url.replaceAll('&','&amp;')),'Source must be clickable');assert.ok(view.html.includes(p.statements[0].excerpt.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')),'Actual evidence must display')}}
 }catch(e){failures++;console.error(code+': FAIL — '+e.message)}
}
if(failures)process.exitCode=1;
