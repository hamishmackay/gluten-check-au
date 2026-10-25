import {research, assessEvidence} from './research.js';
// Gluten Check AU research API — source-attributed and fail-closed.
// Public product pages are retrieved through bounded, fail-closed research.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=180':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff'}});
const fields='code,product_name,brands,ingredients_text,allergens,allergens_tags,traces,traces_tags,labels,labels_tags,last_modified_t,countries_tags,quantity';
async function openFoodFacts(code){
 const url='https://world.openfoodfacts.org/api/v2/product/'+code+'.json?fields='+fields;
 const r=await fetch(url,{headers:{'accept':'application/json','user-agent':'GlutenCheckAU/0.3 (https://github.com/hamishmackay/gluten-check-au)'},signal:AbortSignal.timeout(10000)});
 if(r.status===404)return null;
 if(!r.ok)throw Error('Open Food Facts unavailable ('+r.status+')');
 const data=await r.json();
 return data.status===1&&data.product?data.product:null;
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/health')return json({ok:true,version:'research-v3',deployment:env.CF_VERSION_METADATA?.id||null,enabled:env.ENABLE_PUBLIC_API==='true',discovery:'public-html-and-manufacturer-catalogs'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}});
 const match=url.pathname.match(/^\/api\/products\/(\d{8,14})$/);
 if(!match)return json({error:'Not found'},404);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(env.ENABLE_PUBLIC_API!=='true')return json({error:'Research API not enabled'},503);
 if(!env.USER_RATE_LIMIT||typeof env.USER_RATE_LIMIT.limit!=='function')return json({error:'Rate limiter unavailable'},503);
 const client=request.headers.get('cf-connecting-ip')||'anonymous';
 try{const limit=await env.USER_RATE_LIMIT.limit({key:client});if(!limit.success)return json({error:'Rate limit exceeded'},429)}catch{return json({error:'Rate limiter failed'},503)}
 const code=match[1];let product=null;const errors=[];
 try{product=await openFoodFacts(code)}catch(e){errors.push('Open Food Facts: '+e.message)}
 let web;
 try{web=await research(code,product)}catch(e){web={status:'error',results:[],errors:[String(e.message||e)]}}
 return json({barcode:code,found:!!product||!!web.identity,product:product||web.identity,assessment:assessEvidence(product,web.results),web,sources:product?[{source:'Open Food Facts',url:'https://world.openfoodfacts.org/product/'+code}]:[],errors});
}};
