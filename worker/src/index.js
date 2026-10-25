// Gluten Check AU research API — source-attributed and fail-closed.
// No scraping of retailer websites. Additional sources require approved data feeds.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=180','access-control-allow-origin':'*','x-content-type-options':'nosniff'}});
const fields='code,product_name,brands,ingredients_text,allergens,allergens_tags,traces,traces_tags,labels,labels_tags,last_modified_t,countries_tags';
const glutenTerms=/\b(gluten|wheat|barley|rye|spelt|triticale|malt|semolina|couscous|bulgur|farina)\b/i;
const grainTerms=/\b(oats?|wheat|barley|rye|spelt|triticale|semolina|couscous|bulgur|farina|malt)\b/i;
function assess(product,evidence){
 const p=product||{}, ingredients=p.ingredients_text||'';
 const allergenText=[p.allergens||'',p.traces||'',...(p.allergens_tags||[]),...(p.traces_tags||[])].join(' ');
 const labelText=[p.product_name||'',p.labels||'',...(p.labels_tags||[])].join(' ');
 const claim=/\b(?:gluten[ -]?free|no[ -]+gluten)\b/i.test(labelText)||evidence.some(x=>x.type==='gluten_free_claim');
 const warning=glutenTerms.test(allergenText)||/\b(?:may\s+(?:also\s+)?contain|traces?\s+of)\s*:?[^.;\n]*\b(gluten|wheat|barley|rye|spelt|triticale|malt)\b/i.test(ingredients);
 const ingredientConflict=grainTerms.test(ingredients);
 const conflicting=warning||ingredientConflict;
 const status=conflicting?(claim?'AMBER':'RED'):claim?'CLAIM':'AMBER';
 return {status,claim,conflicting,reason:conflicting&&claim?'Gluten-free claim conflicts with recorded ingredients or warnings.':conflicting?'Gluten-related ingredients or warnings recorded.':claim?'Gluten-free claim found; current Australian packaging and compliance not independently verified.':'Insufficient evidence to verify gluten status.'};
}
async function openFoodFacts(code){
 const url='https://world.openfoodfacts.org/api/v2/product/'+code+'.json?fields='+fields;
 const r=await fetch(url,{headers:{'accept':'application/json','user-agent':'GlutenCheckAU/0.1 (https://github.com/hamishmackay/gluten-check-au)'}});
 if(r.status===404)return null;
 if(!r.ok)throw Error('Open Food Facts unavailable ('+r.status+')');
 const data=await r.json();
 return data.status===1&&data.product?data.product:null;
}
async function approvedFeed(code,env){
 // Optional approved JSON data feed, not a search/scrape proxy.
 // JSON shape: { "barcode": {"name":"...", "glutenFreeClaim":true, "claimUrl":"https://...", "ingredients":"...", "allergens":"...", "traces":"...", "source":"Manufacturer"} }
 if(!env.APPROVED_PRODUCT_FEED_URL)return null;
 const url=new URL(env.APPROVED_PRODUCT_FEED_URL);
 if(url.protocol!=='https:')throw Error('Approved feed must use HTTPS');
 const response=await fetch(url.toString(),{headers:{accept:'application/json'}});
 if(!response.ok)throw Error('Approved feed unavailable');
 const records=await response.json();
 const item=records[code];
 if(!item||typeof item!=='object')return null;
 return item;
}

const authError=(message,status=401)=>new Response(JSON.stringify({error:message}),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
function decodeBase64Url(value){
 const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function authenticatedUser(request,env){
 // Require an explicitly configured Supabase project; never trust unsigned JWT payloads.
 if(!env.SUPABASE_URL)return null;
 let origin;
 try{origin=new URL(env.SUPABASE_URL)}catch{return null}
 if(origin.protocol!=='https:'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(origin.origin))return null;
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization))return null;
 const token=authorization.slice(7),parts=token.split('.');
 if(parts.length!==3||token.length>8192)return null;
 let header,payload;
 try{header=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));payload=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])))}catch{return null}
 if(header.alg!=='ES256'||typeof header.kid!=='string'||!header.kid||typeof payload.sub!=='string'||!payload.sub)return null;
 const now=Math.floor(Date.now()/1000);
 if(payload.iss!==origin.origin+'/auth/v1'||payload.aud!=='authenticated'||payload.role!=='authenticated'||typeof payload.exp!=='number'||payload.exp<=now||typeof payload.iat!=='number'||payload.iat>now+60)return null;
 try{
  const response=await fetch(origin.origin+'/auth/v1/.well-known/jwks.json',{headers:{accept:'application/json'},cf:{cacheTtl:300,cacheEverything:true}});
  if(!response.ok)return null;
  const jwks=await response.json();
  const jwk=Array.isArray(jwks.keys)?jwks.keys.find(k=>k.kid===header.kid&&k.kty==='EC'&&k.crv==='P-256'&&k.alg==='ES256'):null;
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const data=new TextEncoder().encode(parts[0]+'.'+parts[1]);
  const valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decodeBase64Url(parts[2]),data);
  return valid?payload.sub:null;
 }catch{return null}
}

// Product research uses an explicitly configured search provider.
// No browser CORS proxies, scraping or invented product claims.
function xmlText(xml,tag){const match=xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));return match?match[1].replace(/<!\\[CDATA\\[|\\]\\]>/g,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim():'';}
async function publicRssSearch(code,product){
 const q='"'+code+'" gluten free';
 const endpoint='https://www.bing.com/search?format=rss&q='+encodeURIComponent(q);
 const r=await fetch(endpoint,{headers:{accept:'application/rss+xml,application/xml'},signal:AbortSignal.timeout(7500)});
 if(!r.ok)throw Error('Public RSS search HTTP '+r.status);
 const body=await r.text();
 if(!body.includes('<rss')&&!body.includes('<channel'))throw Error('Public RSS search returned no feed');
 const items=body.match(/<item>[\s\S]*?<\/item>/gi)||[];
 return items.slice(0,12).map(x=>({title:xmlText(x,'title'),description:xmlText(x,'description'),url:xmlText(x,'link')})).filter(x=>x.url.startsWith('https://')&&(x.title+' '+x.description+' '+x.url).includes(code)).map(x=>({...x,match:'exact_barcode',statements:[],verification:'search_snippet_only'}));
}
async function webResearch(code,product,env){
 if(!env.BRAVE_SEARCH_API_KEY){try{return {status:'ok',provider:'public_rss',results:await publicRssSearch(code,product)}}catch(e){return {status:'unavailable',provider:'public_rss',results:[],errors:[String(e.message||e)]}}}
 const name=product?.product_name||'';
 const queries=['"'+code+'" gluten free allergens','"'+code+'" '+name+' ingredients may contain'];
 const found=[];const errors=[];
 for(const q of queries){
  try{
   const url='https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(q)+'&count=10&country=au&search_lang=en';
   const r=await fetch(url,{headers:{accept:'application/json','x-subscription-token':env.BRAVE_SEARCH_API_KEY}});
   if(!r.ok)throw Error('Search provider HTTP '+r.status);
   const data=await r.json();
   for(const item of data.web?.results||[]){
    const title=String(item.title||'');const description=String(item.description||'').replace(/<[^>]+>/g,' ');
    const link=String(item.url||'');
    if(!link.startsWith('https://'))continue;
    const exact=(title+' '+description+' '+link).includes(code);
    const nameMatch=name&&name.length>4&&name.toLowerCase().split(/\s+/).filter(w=>w.length>3).slice(0,3).every(w=>(title+' '+description).toLowerCase().includes(w));
    if(!exact&&!nameMatch)continue;
    const statements=[];
    const excerpt=(title+' '+description);
    for(const [type,re] of [['gluten_free_claim',/\bgluten[ -]?free\b/ig],['gluten_not_detected',/\bgluten\s*[:\-]?\s*not detected\b/ig],['may_contain_gluten',/\bmay contain[^.!;]{0,100}\b(?:gluten|wheat|barley|rye)\b/ig],['contains_gluten',/\bcontains[^.!;]{0,80}\b(?:gluten|wheat|barley|rye)\b/ig]]){
     const m=re.exec(excerpt);if(m)statements.push({type,excerpt:m[0]});
    }
    if(!found.some(x=>x.url===link))found.push({title,description,url:link,match:exact?'exact_barcode':'product_name',statements,verification:'search_snippet_only'});
   }
  }catch(e){errors.push(String(e.message||e))}
 }
 return {status:errors.length?'partial':'ok',results:found.slice(0,12),errors};
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/health')return json({ok:true,version:'research-v2',enabled:env.ENABLE_PUBLIC_API==='true',searchConfigured:!!env.BRAVE_SEARCH_API_KEY});
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
 try{web=await webResearch(code,product,env)}catch(e){web={status:'error',results:[],errors:[String(e.message||e)]}}
 return json({barcode:code,found:!!product,product,assessment:assess(product,[]),web,sources:product?[{source:'Open Food Facts',url:'https://world.openfoodfacts.org/product/'+code}]:[],errors});
}};
