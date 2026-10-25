import {catalogCandidates,ayamPage} from './catalogs.js';
// Discovery text is never declaration evidence. Only retrieved product pages qualify.
const sourceHosts=['ayam.com','www.ayam.com','majans.com.au','www.majans.com.au','redtractorfoods.com.au','www.redtractorfoods.com.au','coles.com.au','www.coles.com.au','woolworths.com.au','www.woolworths.com.au','harrisfarm.com.au','www.harrisfarm.com.au','iga.com.au','www.iga.com.au','asiangroceronline.com.au','www.asiangroceronline.com.au','asianmarketgrocery.com.au','www.asianmarketgrocery.com.au','umall.com.au','www.umall.com.au'];
const agent='GlutenCheckAU/0.3 (+https://github.com/hamishmackay/gluten-check-au)';
export function safeURL(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|au|org|net|co|uk|nz)$/i.test(u.hostname)&&!/(?:^|\.)(?:localhost|local|internal|test|example)\./i.test(u.hostname)?u:null}catch{return null}
}
export async function readURL(value,fetcher=fetch,allowedHosts=null){
 let url=safeURL(value);if(!url||allowedHosts&&!allowedHosts.includes(url.hostname))throw Error('Blocked source URL');
 for(let i=0;i<4;i++){
  const r=await fetcher(url.href,{redirect:'manual',headers:{'user-agent':agent,accept:'text/html,application/json'},signal:AbortSignal.timeout(10000)});
  if(r.status>=300&&r.status<400){const location=r.headers.get('location');if(!location)throw Error('Missing redirect');url=safeURL(new URL(location,url).href);if(!url||allowedHosts&&!allowedHosts.includes(url.hostname))throw Error('Blocked redirect');continue}
  if(!r.ok)throw Error('HTTP '+r.status);
  if(!/html|json|xml|text/i.test(r.headers.get('content-type')||''))throw Error('Unsupported format');
  const reader=r.body.getReader();let size=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000)throw Error('Page too large');chunks.push(value)}}finally{await reader.cancel()}
  const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length}const body=new TextDecoder().decode(bytes);if(/Incapsula incident ID|<title[^>]*>\s*(?:Access Denied|Just a moment)|cf-chl-|verify you are human/i.test(body))throw Error('Source access screening');return {url:url.href,body};
 }throw Error('Too many redirects');
}
export function decode(s){return String(s||'').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,m=>{const v={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};if(v[m])return v[m];const n=m[2].toLowerCase()==='x'?parseInt(m.slice(3),16):parseInt(m.slice(2),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):' '})}
export function text(html){return decode(String(html).replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()}
const words=s=>text(s).toLowerCase().replace(/(\d)\s+(g|kg|ml|l)\b/g,'$1$2').match(/[a-z0-9]+/g)||[];
function productObjects(html){const out=[];function walk(x){if(!x||typeof x!=='object')return;if([].concat(x['@type']||[]).some(t=>/^(?:https?:\/\/schema.org\/)?Product$/i.test(t)))out.push(x);if(Array.isArray(x))x.forEach(walk);else if(x['@graph'])walk(x['@graph'])}
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]))}catch{}}return out}
export function parsePage(html,url,code,identity){
 const ayam=ayamPage(html,url,code);if(ayam)return {url,title:ayam.name,brand:'AYAM',match:'exact_barcode',verification:'page_retrieved',retrievedAt:new Date().toISOString(),statements:extractStatements(ayam.description),description:ayam.description.slice(0,500),identity:{product_name:ayam.name,brands:'AYAM',quantity:ayam.name.match(/\b\d+\s*(?:g|kg|ml|l)\b/i)?.[0]||''}};
 const products=productObjects(html);const sameCode=p=>['gtin','gtin8','gtin12','gtin13','gtin14'].some(k=>String(p[k]||'').replace(/^0+/,'')===code.replace(/^0+/,''));
 const title=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const main=html.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1]||'';
 if(/\/(?:search|collections|categories)(?:[/?]|$)/i.test(new URL(url).pathname))return null;
 const scope=main.split(/<(?:section|div)[^>]*(?:related|recommend|upsell|cross-sell)[^>]*>/i)[0];const mainText=text(scope);
 // A multi-product listing is not an exact product page, even if one GTIN matches.
 if(products.length>1)return null;
 const p=products[0];const name=text(p?.name||title);const brand=text(typeof p?.brand==='object'?p.brand.name:p?.brand||'');
 if(title&&p?.name&&!words(p.name).every(w=>words(title).includes(w)))return null;
 const declaredCodes=p?['gtin','gtin8','gtin12','gtin13','gtin14'].map(k=>p[k]).filter(Boolean):[];
 if(declaredCodes.length&&!sameCode(p))return null;
 let match=p&&sameCode(p)?'exact_barcode':null;
 if(!match&&new RegExp('\\b(?:barcode|ean|gtin|apn)\\s*[:#]?\\s*0*'+code+'\\b','i').test(mainText)&&title&&mainText.includes(title))match='barcode_in_product_page';
 if(!match&&identity?.product_name&&identity?.brands&&identity?.quantity){
  const expected=words(identity.brands.split(',')[0]+' '+identity.product_name+' '+identity.quantity);const actual=words(name);
  if(expected.length>=3&&expected.every(w=>actual.includes(w)))match='brand_name_pack_size';
 }
 if(!match)return null;
 const content=[text(p?.description||''),mainText&&title?mainText:''].filter(Boolean).join(' ');
 return {url,title:name,brand,match,verification:'page_retrieved',retrievedAt:new Date().toISOString(),statements:extractStatements(content),description:content.slice(0,500),identity:{product_name:name,brands:brand,quantity:text(p?.size||'')}};
}
export function extractStatements(content){
 const out=[];const add=(type,re)=>{for(const m of content.matchAll(re)){out.push({type,excerpt:m[0].trim().slice(0,650)});if(out.length>=24)break}};
 add('ingredients',/\bingredients?\s*:?\s+.{1,600}?(?=\s+(?:allergen|contains|may contain|nutrition|storage|directions)\b|$)/gi);
 add('precautionary_warning',/\b(?:may\s+(?:also\s+)?contain|may be present|traces? of)\s*:?[^.;]{1,220}/gi);
 add('allergens',/(?<!may )(?<!also )\bcontains?\s*:?\s+[^.;]{1,220}/gi);
 add('gluten_not_detected',/\bgluten\s*[:\-]?\s*not detected\b/gi);
 for(const m of content.matchAll(/\bgluten[ -]free\b/gi)){const prefix=content.slice(Math.max(0,m.index-65),m.index).split(/[.;!?]/).pop();if(!/\b(?:not|never|cannot|isn't|isnt|can't|cant)\b/i.test(prefix))out.push({type:'gluten_free_claim',excerpt:m[0]})}
 return out;
}
export function assessEvidence(product,results){
 const statements=results.flatMap(r=>r.statements);const claim=statements.some(s=>s.type==='gluten_free_claim');const notDetected=statements.some(s=>s.type==='gluten_not_detected');
 const riskTerms=/\b(wheat|barley|rye|spelt|triticale|oats?|malt|semolina|couscous|bulgur|farina|gluten)\b/i;
 const risk=statements.filter(s=>['ingredients','allergens','precautionary_warning'].includes(s.type)&&riskTerms.test(s.excerpt.replace(/\b(?:gluten[ -]free|gluten\s*:?\s*not detected|no gluten)\b/gi,'')));
 const dbRisk=riskTerms.test([product?.ingredients_text,product?.allergens,product?.traces,...(product?.allergens_tags||[]),...(product?.traces_tags||[])].filter(Boolean).join(' ').replace(/gluten[ -]free/gi,''));
 const conflicting=(claim||notDetected)&&(risk.length>0||dbRisk);const status=conflicting?'AMBER':risk.length||dbRisk?'RED':claim?'CLAIM':'AMBER';
 return {status,claim,notDetected,conflicting,risk,reason:conflicting?'Declarations conflict with ingredients or warnings. Do not rely on the claim.':status==='RED'?'Gluten-related ingredients, oats or warnings recorded.':claim?'Gluten-free claim on a matching retrieved page; check current Australian packaging.':notDetected?'Gluten not detected declaration found. This is not a gluten-free certification.':'Insufficient product-page evidence. Missing warnings remain unknown.'};
}
export async function discover(query,fetcher=fetch){
 const endpoints=['https://html.duckduckgo.com/html/?q=','https://www.bing.com/search?q='];const links=new Set(),errors=[];
 for(const endpoint of endpoints){try{const {body}=await readURL(endpoint+encodeURIComponent(query),fetcher,[new URL(endpoint).hostname]);if(/anomaly|captcha|unusual traffic/i.test(body))throw Error('Search challenge');const resultHTML=endpoint.includes('bing.com')?(body.match(/<li class="b_algo"[\s\S]*?<\/li>/gi)||[]).join(' '):(body.match(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][\s\S]*?<\/a>/gi)||[]).join(' ');for(const m of resultHTML.matchAll(/href=["']([^"']+)["']/gi)){let v=decode(m[1]);try{const u=new URL(v,endpoint);if(u.searchParams.has('uddg'))v=u.searchParams.get('uddg');if(u.hostname.endsWith('bing.com')&&u.pathname==='/ck/a'){const encoded=u.searchParams.get('u');if(encoded?.startsWith('a1'))v=atob(encoded.slice(2).replace(/-/g,'+').replace(/_/g,'/'))}}catch{continue}const u=safeURL(v);if(u&&sourceHosts.includes(u.hostname))links.add(u.href)}if(links.size)break}catch(e){errors.push(new URL(endpoint).hostname+': '+e.message)}}
 return {urls:[...links].slice(0,6),errors};
}
export async function research(code,product,fetcher=fetch){
 let identity=product?.product_name?product:null;const results=[],errors=[],attempts=[],seen=new Set();
 const inspect=async d=>{errors.push(...d.errors);const candidates=d.urls.filter(u=>safeURL(u)&&sourceHosts.includes(new URL(u).hostname)&&!seen.has(u));candidates.forEach(u=>seen.add(u));const pages=await Promise.all(candidates.map(async u=>{try{const page=await readURL(u,fetcher,sourceHosts);const parsed=parsePage(page.body,page.url,code,identity);attempts.push({url:page.url,outcome:parsed?'matched':'identity_not_confirmed'});return parsed}catch(e){attempts.push({url:u,outcome:'unavailable',reason:e.message});errors.push(new URL(u).hostname+': '+e.message);return null}}));for(const page of pages.filter(Boolean)){if(!results.some(r=>r.url===page.url))results.push(page);if(!identity&&page.match==='exact_barcode')identity=page.identity}};
 const namedDiscovery=async()=>{const [search,catalog]=await Promise.all([discover([identity.brands,identity.product_name,identity.quantity,'Australia ingredients allergens'].filter(Boolean).join(' '),fetcher),catalogCandidates(identity,fetcher)]);return {urls:[...catalog.urls,...search.urls].slice(0,8),errors:[...search.errors,...catalog.errors]}};
 // A known database identity allows independent discoveries to run together.
 // Unknown barcodes still need exact-page identification before any name search.
 if(identity){const [barcode,named]=await Promise.all([discover('"'+code+'"',fetcher),namedDiscovery()]);await inspect({urls:[...barcode.urls,...named.urls],errors:[...barcode.errors,...named.errors]})}
 else{await inspect(await discover('"'+code+'"',fetcher));if(identity)await inspect(await namedDiscovery())}
 return {status:results.length?(errors.length?'partial':'ok'):'unavailable',provider:'public_html_pages',results,errors,identity,attempts,identityStatus:identity?'database_or_exact_page':'unresolved'};
}
