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
 const claim=/\bgluten[ -]?free\b/i.test(labelText)||evidence.some(x=>x.type==='gluten_free_claim');
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

export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/health')return json({ok:true,version:'research-v1',publicApiEnabled:env.ENABLE_PUBLIC_API==='true',sources:['open_food_facts',...(env.APPROVED_PRODUCT_FEED_URL?['approved_feed']:[])]});
 // Fail closed: API is disabled unless explicitly enabled by the owner. No browser-embedded shared secret.
 if(env.ENABLE_PUBLIC_API!=='true')return json({error:'Research API not enabled. Owner must configure authentication, abuse controls and a request budget first.'},503);
 const match=url.pathname.match(/^\/api\/products\/(\d{8,14})$/);
 if(!match)return json({error:'Not found. Use /api/products/{barcode}'},404);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const userId=await authenticatedUser(request,env);
 if(!userId)return authError('Authentication required or Supabase not configured.');
 // The Cloudflare rate-limiter binding must exist before public access can be enabled.
 if(!env.USER_RATE_LIMIT||typeof env.USER_RATE_LIMIT.limit!=='function')return authError('Rate limiter not configured.',503);
 try{const limit=await env.USER_RATE_LIMIT.limit({key:userId});if(!limit.success)return authError('Too many requests. Please try later.',429)}catch{return authError('Rate limiter unavailable.',503)}
 const code=match[1],sources=[],errors=[];
 let product=null;
 try{product=await openFoodFacts(code);if(product)sources.push({source:'Open Food Facts',url:'https://world.openfoodfacts.org/product/'+code,kind:'community',updated:product.last_modified_t||null});}catch(e){errors.push('Open Food Facts: '+e.message)}
 let feed=null;
 try{feed=await approvedFeed(code,env);if(feed)sources.push({source:feed.source||'Approved product feed',url:typeof feed.claimUrl==='string'&&feed.claimUrl.startsWith('https://')?feed.claimUrl:null,kind:'provider',updated:feed.updated||null});}catch(e){errors.push('Approved feed: '+e.message)}
 if(feed){
  product={...product,product_name:feed.name||product?.product_name||'',brands:feed.brand||product?.brands||'',ingredients_text:feed.ingredients??product?.ingredients_text??'',allergens:feed.allergens??product?.allergens??'',traces:feed.traces??product?.traces??'',labels:[product?.labels||'',feed.glutenFreeClaim?'gluten free':''].join(' ')};
 }
 const evidence=feed?.glutenFreeClaim?[{type:'gluten_free_claim',source:feed.source||'Approved product feed'}]:[];
 return json({barcode:code,found:!!product,product:product||null,assessment:assess(product,evidence),sources,errors,sourceCount:sources.length});
}};