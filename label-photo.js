/* Lazy, on-device Tesseract OCR. No photo or recognised text is sent to the API. */
(function(root){
const VERSION='6.0.1',SCRIPT='https://cdn.jsdelivr.net/npm/tesseract.js@'+VERSION+'/dist/tesseract.min.js';
let options,libraryPromise,job=0,worker=null,photoURL=null,reading=null,readingCode=null,busy=false;
const el=id=>document.getElementById(id);
function status(message){el('labelPhotoStatus').textContent=message}
function loadLibrary(){
 if(root.Tesseract?.createWorker)return Promise.resolve(root.Tesseract);
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');const timer=setTimeout(()=>{script.remove();libraryPromise=null;reject(Error('Label-reader download timed out. Try again with an internet connection.'))},25000);script.src=SCRIPT;script.onload=()=>{clearTimeout(timer);if(root.Tesseract?.createWorker)resolve(root.Tesseract);else{libraryPromise=null;reject(Error('Label reader did not load'))}};script.onerror=()=>{clearTimeout(timer);libraryPromise=null;script.remove();reject(Error('Could not download the label reader. Try again when online.'))};document.head.appendChild(script)});
 return libraryPromise;
}
function refresh(){if(!reading)return;const context=options.getContext();if(context.code!==readingCode)return;const result=GlutenLabelAnalysis.analyse(reading.text,reading.confidence,readingCode,context.online||{},context.preference);el('labelPhotoEvidence').className='card '+result.tone;el('labelPhotoEvidence').innerHTML=GlutenLabelAnalysis.render(result);el('labelPanel').style.order='-1';el('labelPhotoEvidence').scrollIntoView({block:'start'})}
function reset(){job++;if(worker){try{Promise.resolve(worker.terminate()).catch(()=>{})}catch{}worker=null}busy=false;reading=null;readingCode=null;if(photoURL){URL.revokeObjectURL(photoURL);photoURL=null}el('labelPhotoPreview').removeAttribute('src');el('labelPhotoPreview').hidden=true;el('labelPhotoEvidence').innerHTML='';el('labelPanel').style.order='0';el('labelPhotoCancel').hidden=true;el('labelPhoto').disabled=false;el('labelPanel').hidden=true;status('')}
function show(){const context=options.getContext();if(!/^\d{8,14}$/.test(context.code))return;el('labelPanel').hidden=false;const pages=context.pages||[];if(!pages.some(p=>p.statements?.length))el('labelPhotoDetails').open=true}
async function read(file){
 const context=options.getContext();if(!/^\d{8,14}$/.test(context.code)){status('Scan or enter the product barcode first.');return}
 if(!file.type.startsWith('image/')){status('Choose a photo of the label.');return}
 if(file.size>20*1024*1024){status('This photo is too large. Take a closer photo of the label (under 20 MB).');return}
 reset();show();const token=job;const code=context.code;busy=true;el('labelPhoto').disabled=true;el('labelPhotoCancel').hidden=false;el('labelPhotoDetails').open=true;el('labelPanel').style.order='-1';
 photoURL=URL.createObjectURL(file);el('labelPhotoPreview').src=photoURL;el('labelPhotoPreview').hidden=false;status('Preparing the label reader… The first use downloads its reading engine.');
 let timeout,bitmap,localWorker;
 try{
  const operation=(async()=>{
   const api=await loadLibrary();if(token!==job)return;
   localWorker=await api.createWorker('eng',1,{logger:m=>{if(token===job){const progress=Number.isFinite(m.progress)?' '+Math.round(m.progress*100)+'%':'';status((m.status==='recognizing text'?'Reading label…':m.status==='loading language traineddata'?'Downloading English reader…':'Preparing label reader…')+progress)}}});
   if(token!==job){await localWorker.terminate();return}worker=localWorker;
   bitmap=await createImageBitmap(file);if(token!==job){bitmap.close();bitmap=null;return}
   const canvas=document.createElement('canvas');const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Photo processing is unavailable');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();bitmap=null;
   const result=await localWorker.recognize(canvas,{rotateAuto:true},{text:true});
   canvas.width=1;canvas.height=1;if(token!==job)return;
   reading={text:result.data.text,confidence:result.data.confidence};readingCode=code;refresh();status('Label read. Check highlighted words against your photo.');
  })();
  await Promise.race([operation,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Label reading took too long. Try a smaller, sharper photo of just the panel.')),90000)})]);
 }catch(error){if(token===job){job++;worker=null;busy=false;el('labelPhoto').disabled=false;el('labelPhotoCancel').hidden=true;el('labelPhoto').value='';status('Could not read the label: '+(error.message||error))}}
 finally{clearTimeout(timeout);if(bitmap)bitmap.close();if(localWorker){try{await localWorker.terminate()}catch{}}if(token===job){worker=null;busy=false;el('labelPhoto').disabled=false;el('labelPhotoCancel').hidden=true;el('labelPhoto').value=''}}
}
function init(config){options=config;el('labelPhoto').addEventListener('change',event=>{const file=event.target.files?.[0];if(file){options.stopCamera?.();read(file)}});el('labelPhotoCancel').addEventListener('click',()=>{reset();show();status('Label reading cancelled. No photo was uploaded.')});root.addEventListener('pagehide',reset)}
root.LabelPhoto={init,reset,show,refresh};
})(globalThis);
