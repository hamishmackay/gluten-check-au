/* Photo OCR is evidence to review, never an independent gluten-free clearance. */
(function(root){
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grain=/\b(?:gluten|wheat|barley|rye|spelt|triticale|oats?|malt|semolina|couscous|bulgur|farina)\b/gi;
const harmless=/\b(?:gluten[ -]?free|no gluten|gluten\s*[:\-]?\s*not detected|wheat[ -]?free)\b/gi;
function validGTIN(code){if(!/^\d{8}$|^\d{12,14}$/.test(code))return false;let sum=0;for(let i=code.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=Number(code[i])*weight;return (10-sum%10)%10===Number(code.at(-1))}
function section(text,kind){
 const starts={ingredients:/\bingredients?\s*[:\-]?\s*/i,allergens:/\b(?:contains|allergens?(?:\s+information)?)\s*[:\-]?\s*/i,warnings:/\b(?:may\s+(?:also\s+)?contain|may be present|traces? of)\s*[:\-]?\s*/i};
 const matches=[...text.matchAll(new RegExp(starts[kind].source,'ig'))];
 for(const m of matches){
  if(kind==='allergens'&&/\bmay(?:\s+also)?\s*$/i.test(text.slice(Math.max(0,m.index-14),m.index)))continue;
  const rest=text.slice(m.index+m[0].length);
  const stop=/\b(?:ingredients?|allergens?|contains|may\s+(?:also\s+)?contain|nutrition(?:al)?\s+(?:information|facts)|servings?\s+(?:per|size)|storage|directions|cooking|best before|manufactured|distributed)\b/i.exec(rest);
  const value=rest.slice(0,stop?stop.index:kind==='ingredients'?900:300).trim().replace(/^[\s:;,-]+|[\s:;,-]+$/g,'');
  if(value)return value;
 }
 return '';
}
function analyse(text,confidence,barcode,online={},preference='strict'){
 const raw=String(text||'').normalize('NFKC').slice(0,16000).replace(/\r/g,'').trim();
 const normalized=raw.replace(/\s+/g,' ');
 const score=Number.isFinite(confidence)?Math.max(0,Math.min(100,confidence)):0;
 const ingredients=section(normalized,'ingredients'),allergens=section(normalized,'allergens'),warnings=section(normalized,'warnings');
 const relevant=[ingredients,allergens,warnings].filter(Boolean).join(' ').replace(harmless,'');
 const terms=[...new Set((relevant.match(grain)||[]).map(s=>s.toLowerCase()))];
 const claim=/\bgluten[ -]?free\b/i.test(normalized)&&!/\b(?:not|never|cannot|can't|isn't)\b[^.!;]{0,55}\bgluten[ -]?free\b/i.test(normalized);
 const notDetected=/\bgluten\s*[:\-]?\s*not detected\b/i.test(normalized);
 const codes=[...new Set((normalized.match(/\b\d{8,14}\b/g)||[]).filter(validGTIN))];
 const codeKey=s=>String(s).replace(/^0+/,'');const mismatch=codes.length>0&&!codes.some(c=>codeKey(c)===codeKey(barcode));
 const empty=normalized.replace(/[^a-z]/gi,'').length<12;const lowClarity=score<80||empty;
 const onlineRisk=online.status==='RED'||online.conflicting===true;
 const conflict=!mismatch&&((terms.length>0&&(online.claim||online.notDetected||claim||notDetected))||(onlineRisk&&(claim||notDetected)));
 let status='AMBER — PHOTO NOT VERIFIED',tone='amber';
 if(mismatch){status='PHOTO MAY BE A DIFFERENT PRODUCT';if(onlineRisk)tone='red'}
 else if(terms.length){status=conflict?'POSSIBLE RISK / CONFLICT IN PHOTO':'POSSIBLE GLUTEN RISK IN PHOTO';tone='red'}
 else if(onlineRisk){status='EXISTING GLUTEN RISK REMAINS';tone='red'}
 else if(!lowClarity&&notDetected&&preference==='moderate')status='GLUTEN NOT DETECTED — PHOTO READING';
 else if(!lowClarity&&(notDetected||claim)&&preference==='flexible')status='GLUTEN DECLARATION — PHOTO READING';
 let message=mismatch?'A different barcode was read in this photo. Do not apply this reading to the scanned product.':empty?'No useful label text was read. Try a sharper photo of the full ingredient and allergen panel.':terms.length?'Possible gluten-related words were read. Check the highlighted wording on the photo.':onlineRisk?'The photo does not cancel the online ingredient, warning or conflict already recorded.':lowClarity?'The photo was difficult to read. Missing words or warnings may have been missed. Try a clearer, closer photo.':'No gluten-related risk was read in the extracted sections. This does not establish that the product is gluten-free.';
 if(mismatch&&onlineRisk)message+=' The existing online gluten risk remains.';
 if(conflict)message+=' The photo reading and other declarations conflict; do not rely on a positive claim.';
 if(!mismatch&&!codes.length)message+=' The photo is linked to your scanned barcode, but its product identity was not independently checked.';
 return {raw,score,lowClarity,empty,ingredients,allergens,warnings,terms,claim,notDetected,codes,mismatch,conflict,status,tone,message,barcode};
}
function highlight(value){return esc(value).replace(grain,m=>'<mark>'+m+'</mark>')}
function render(reading){
 const r=reading;const field=(name,value)=>'<div class="keyfact"><b>'+name+'</b>'+highlight(value||'Not read — unknown')+'</div>';
 return '<p class="subtle">Photo for barcode '+esc(r.barcode)+'</p><div class="status">'+esc(r.status)+'</div><p>'+esc(r.message)+'</p><div class="keyfacts">'+field('INGREDIENTS',r.ingredients)+field('CONTAINS / ALLERGENS',r.allergens)+field('MAY CONTAIN',r.warnings)+'</div>'+(r.claim?'<p><b>Gluten-free wording read from photo.</b> OCR can misread or omit words; this is not a verified claim.</p>':'')+(r.notDetected?'<p><b>“Gluten not detected” wording read from photo.</b> Check it against the image.</p>':'')+'<details><summary>Text read from your photo</summary><p style="white-space:pre-wrap">'+highlight(r.raw||'No readable text')+'</p></details><p class="subtle">Source: your photo, processed on this device. Recognition quality is not a food-safety confidence score. No GREEN clearance is issued.</p>';
}
root.GlutenLabelAnalysis={analyse,render,validGTIN};
})(typeof module!=='undefined'?module.exports:globalThis);
