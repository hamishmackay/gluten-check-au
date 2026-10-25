// Keep the isolated Worker preview reproducible from the existing app sources.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const check=process.argv.includes('--check');
const files=['index.html','research-ui.js','label-analysis.js','label-photo.js','sw.js','manifest.webmanifest'];
const digest=createHash('sha256');
for(const name of [...files,'worker/src/index.js','worker/src/research.js','worker/src/catalogs.js','worker/wrangler.toml','scripts/build-preview.mjs'])digest.update(name+'\n'+await readFile(new URL('../'+name,import.meta.url),'utf8'));
const sourceDigest=digest.digest('hex');
for(const name of files){
 let content=await readFile(new URL('../'+name,import.meta.url),'utf8');
 if(name==='index.html'){
  const pattern=/const RESEARCH_API_BASE='https:\/\/[^']+';/;
  if(!pattern.test(content))throw Error('Cannot locate app API origin');
  content=content.replace(pattern,'const RESEARCH_API_BASE=location.origin;');
  content=content.replace('<head>','<head><meta name="preview-source-digest" content="'+sourceDigest+'">');
  content=content.replace('</header>','</header><p role="status" style="padding:10px;background:#fff0cd;border-radius:8px">Development preview — product research is incomplete. No safety clearance.</p>');
 }
 const out=new URL('../worker/public/'+name,import.meta.url);
 if(check){if(await readFile(out,'utf8')!==content)throw Error('Preview asset out of date: '+name)}
 else{await mkdir(new URL('../worker/public/',import.meta.url),{recursive:true});await writeFile(out,content)}
}
const manifest=JSON.stringify({sourceDigest})+'\n';const manifestPath=new URL('../worker/public/preview-build.json',import.meta.url);
if(check){if(await readFile(manifestPath,'utf8')!==manifest)throw Error('Preview source digest out of date')}else await writeFile(manifestPath,manifest);
console.log(check?'Preview assets match app sources':'Preview assets built');
