// Site adapters describe catalog structure, never individual product results.
import {readURL,decode,text} from './research.js';
const manufacturers=[{brand:'ayam',origin:'https://ayam.com',index:'/products'},{brand:'red tractor',origin:'https://www.redtractorfoods.com.au',index:'/ranges/oats'},{brand:'majans',origin:'https://majans.com.au',index:'/bhuja/'}];
const tokens=s=>String(s||'').toLowerCase().match(/[a-z]+/g)||[];
export function links(html,base){return [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>{try{return new URL(decode(m[1]),base).href}catch{return ''}}).filter(u=>u.startsWith(new URL(base).origin)))];}
export async function catalogCandidates(identity,fetcher=fetch){
 const config=manufacturers.find(x=>tokens(identity?.brands).join(' ').includes(x.brand));if(!config)return {urls:[],errors:[]};
 const errors=[],urls=new Set(),wanted=tokens(identity.product_name);
 const stem=w=>w.replace(/s$/,'');const score=u=>wanted.filter(w=>tokens(new URL(u).pathname).map(stem).includes(stem(w))).length;
 try{
  const index=await readURL(config.origin+config.index,fetcher,[new URL(config.origin).hostname]);const all=links(index.body,index.url).filter(u=>score(u)>0).sort((a,b)=>score(b)-score(a));
  for(const u of all.filter(u=>/\/product\/|\/range\/|\/product\//.test(u)).slice(0,4))urls.add(u);
  const category=all.filter(u=>!/\/product\/|\/range\//.test(u)&&/\/products\/|\/ranges\//.test(u)).sort((a,b)=>score(b)-score(a)||new URL(a).pathname.split('/').length-new URL(b).pathname.split('/').length).slice(0,4);
  await Promise.all(category.map(async u=>{try{const page=await readURL(u,fetcher,[new URL(config.origin).hostname]);for(const v of links(page.body,page.url).filter(v=>/\/product\/|\/range\//.test(v)&&score(v)>0).sort((a,b)=>score(b)-score(a)).slice(0,3))urls.add(v)}catch(e){errors.push(e.message)}}));
 }catch(e){errors.push(config.origin+': '+e.message)}
 return {urls:[...urls].sort((a,b)=>score(b)-score(a)).slice(0,6),errors};
}
// Balanced element extraction scopes evidence away from menus, recipes and other products.
export function element(html,id){const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const start=new RegExp('<([a-z0-9]+)\\b[^>]*\\bid=["\']'+escaped+'["\'][^>]*>','i').exec(html);if(!start)return '';const tag=start[1];const re=new RegExp('<\\/?'+tag+'\\b[^>]*>','gi');re.lastIndex=start.index+start[0].length;let depth=1,m;while((m=re.exec(html))){depth+=m[0].startsWith('</')?-1:1;if(!depth)return html.slice(start.index+start[0].length,m.index)}return '';}
export function ayamPage(html,url,code){
 if(!/^(?:www\.)?ayam\.com$/.test(new URL(url).hostname))return null;
 const scope=element(html,'hikashop_product_'+code+'_page');if(!scope)return null;
 const name=text(element(scope,'hikashop_product_name_main'));if(!name)return null;
 const description=['hikashop_product_description_main','hikashop_show_tabular_description','hikashop_show_tabular_ingredients','hikashop_show_tabular_allergen'].map(id=>element(scope,id)).filter(Boolean).map(text).join(' ');
 return {name,description};
}

// Native store searches are a separate discovery channel, not declaration evidence.
// Every returned link must still pass the fetched-page GTIN/name/size checks.
export async function retailerCandidates(code,identity,fetcher=fetch){
 const query=identity?.product_name?[identity.brands,identity.product_name,identity.quantity].filter(Boolean).join(' '):code;
 const stores=[{origin:'https://www.woolworths.com.au',path:'/shop/search/products',parameter:'searchTerm',product:/^\/shop\/productdetails\/\d+\//},{origin:'https://www.harrisfarm.com.au',path:'/search',parameter:'q',product:/^\/products\//}];
 const found=[],errors=[];
 await Promise.all(stores.map(async store=>{
  const url=new URL(store.path,store.origin);url.searchParams.set(store.parameter,query);
  try{
   const page=await readURL(url.href,fetcher,[new URL(store.origin).hostname]);
   const wanted=tokens(identity?.product_name||'');const score=u=>wanted.filter(w=>tokens(new URL(u).pathname).includes(w)).length;
   const candidates=links(page.body,page.url).filter(u=>store.product.test(new URL(u).pathname));
   found.push(...candidates.sort((a,b)=>score(b)-score(a)).slice(0,3));
  }catch(e){errors.push(new URL(store.origin).hostname+' catalogue: '+e.message)}
 }));
 return {urls:[...new Set(found)].slice(0,6),errors};
}
