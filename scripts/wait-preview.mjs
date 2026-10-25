// Wait for the native Cloudflare build, verifying code identity rather than HTTP 200 alone.
import {readFile} from 'node:fs/promises';
const base=process.env.RESEARCH_API_BASE;if(!base)throw Error('RESEARCH_API_BASE required');
const expected=JSON.parse(await readFile(new URL('../worker/public/preview-build.json',import.meta.url),'utf8'));
for(let attempt=1;attempt<=6;attempt++){
 try{const r=await fetch(base+'/preview-build.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(r.ok&&(await r.json()).sourceDigest===expected.sourceDigest){console.log('Native preview matches source digest '+expected.sourceDigest);process.exit(0)}console.log('Native preview has not reached this version yet')}catch(e){console.log('Preview check: '+e.message)}
 if(attempt<6)await new Promise(r=>setTimeout(r,10000));
}
throw Error('Native Cloudflare preview did not publish the expected source version');
