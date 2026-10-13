import kid from "./ideas/kid.js";
import couple from "./ideas/couple.js";
import pet from "./ideas/pet.js";
import meme from "./ideas/meme.js";
export const STYLE = `
:root{--bg:#1a1612;--card:#241e18;--ink:#f6efe4;--mute:#b9ab97;--gold:#e6a23c;--line:#3a3128}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;justify-content:center}
main{width:100%;max-width:480px;padding:28px 18px 40px}
h1{font-size:26px;line-height:1.2;margin:6px 0 8px}
p{margin:0 0 12px;color:var(--mute)}
.mark{display:inline-block;width:14px;height:14px;border-radius:4px;background:var(--gold);margin-right:8px;vertical-align:-1px}
.brand{font-weight:600;letter-spacing:.02em;color:var(--ink)}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin:16px 0}
.bar{height:10px;background:var(--line);border-radius:6px;overflow:hidden;margin:10px 0 6px}
.bar i{display:block;height:100%;background:var(--gold);width:0;transition:width .4s}
label{display:block;font-size:14px;color:var(--mute);margin:12px 0 6px}
input[type=text]{width:100%;padding:13px;border-radius:12px;border:1px solid var(--line);background:#14100c;color:var(--ink);font-size:16px}
button,.btn{display:block;width:100%;padding:15px;border-radius:12px;border:0;background:var(--gold);color:#1a1612;font-size:17px;font-weight:600;margin-top:14px;text-align:center;text-decoration:none;cursor:pointer}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
button:disabled{opacity:.5}
.thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.thumbs div{aspect-ratio:1;border-radius:10px;background:#14100c center/cover;border:1px solid var(--line);position:relative}
.thumbs span{position:absolute;right:4px;bottom:4px;font-size:11px;background:#000a;border-radius:6px;padding:1px 6px}
.msg{min-height:22px;font-size:15px}.err{color:#ff9b8a}.ok{color:#9fe0a8}
figure{margin:0}.ideas{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.ideas img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block}figcaption{font-size:13px;color:var(--mute);margin-top:4px}
small{color:var(--mute);display:block;margin-top:18px;font-size:13px}
`;

export function friendPage(id) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Send a picture</title>
<style>${STYLE}</style></head><body><main>
<div><span class="mark"></span><span class="brand">Get Done</span></div>
<h1 id="h">Loading...</h1><p id="sub"></p>
<div class="card" id="prog" hidden><div id="count"></div><div class="bar"><i id="fill"></i></div></div>
<div class="card" id="ideas" hidden><p style="color:var(--ink);margin-bottom:4px">Not sure what to send?</p><p>Anything goes. Some ideas:</p><div class="ideas"><figure><img alt="Childhood photo" src="data:image/jpeg;base64,${kid}"><figcaption>Childhood photo</figcaption></figure><figure><img alt="Couple pic" src="data:image/jpeg;base64,${couple}"><figcaption>Couple pic</figcaption></figure><figure><img alt="Funny pet" src="data:image/jpeg;base64,${pet}"><figcaption>Funny pet</figcaption></figure><figure><img alt="Meme" src="data:image/jpeg;base64,${meme}"><figcaption>Meme</figcaption></figure></div></div>
<div class="card" id="form" hidden>
<label for="name">Your first name</label><input type="text" id="name" maxlength="30" autocomplete="given-name" placeholder="Optional">
<label for="cap">Note (optional)</label><input type="text" id="cap" maxlength="80" placeholder="Say something about it">
<input type="file" id="file" accept="image/*" multiple hidden>
<button id="pick" type="button">Choose pictures</button>
<div class="thumbs" id="thumbs"></div>
<p class="msg" id="msg" role="status"></p>
</div>
<div class="card" id="share" hidden><p style="color:var(--ink)">Know someone else who should send one? Pass it on.</p>
<button class="ghost" id="sharebtn" type="button">Share this link</button></div>
<small>Your pictures stay sealed until the person who sent you this link finishes their homework, so they can't peek. Photos are shrunk and stripped of location data before they leave your phone. They can delete a picture after it unlocks.</small>
</main>
<script>
const ID=${JSON.stringify(id)};
const $=s=>document.getElementById(s);
let info=null;
async function load(){
  const r=await fetch('/api/link/'+ID);
  if(!r.ok){$('h').textContent='This link is not active.';$('sub').textContent='Ask for a fresh one.';return}
  info=await r.json();render();
}
function render(){
  $('h').textContent=info.closed?'This link has closed.':'Send a picture, it unlocks when the homework is done';
  $('sub').textContent=info.closed?'The deadline passed or it was turned off. Thanks for stopping by.':'Anything works: a photo of you, of him, a meme, a pet. It stays sealed until each question is finished. Assignment: '+info.title+'.'+(info.due?' Closes '+new Date(info.due).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.':'');
  $('prog').hidden=false;
  const n=info.sent,e=info.expected;
  $('count').textContent=n+' of about '+e+' pictures sent';
  $('fill').style.width=Math.min(100,Math.round(n/e*100))+'%';
  $('form').hidden=!!info.closed;$('ideas').hidden=!!info.closed;
  $('share').hidden=!!info.closed;
}
$('pick').onclick=()=>$('file').click();
async function shrink(file){
  const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
  const max=1400,s=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  let q=.82,blob;
  for(let i=0;i<4;i++){blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));if(blob.size<1300000)break;q-=.15}
  return blob;
}
$('file').onchange=async()=>{
  const files=[...$('file').files];if(!files.length)return;
  $('pick').disabled=true;let done=0;const msg=$('msg');msg.className='msg';
  for(const f of files){
    msg.textContent='Sending '+(done+1)+' of '+files.length+'...';
    try{
      const blob=await shrink(f);
      const url='/api/link/'+ID+'/upload?name='+encodeURIComponent($('name').value)+'&cap='+encodeURIComponent($('cap').value);
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob});
      if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Upload failed')}
      done++;const d=document.createElement('div');d.style.backgroundImage='url('+URL.createObjectURL(blob)+')';d.innerHTML='<span>sent</span>';$('thumbs').appendChild(d);
    }catch(e){msg.className='msg err';msg.textContent=(e.message||'Could not send that one')+(done?' ('+done+' sent)':'');$('pick').disabled=false;$('file').value='';await load();return}
  }
  msg.className='msg ok';msg.textContent=done+' sent. Sealed until the homework gets done.';
  $('pick').disabled=false;$('file').value='';await load();
};
$('sharebtn').onclick=async()=>{
  const data={title:'Send a picture',text:'Send a picture that unlocks when he finishes his homework',url:location.href};
  try{if(navigator.share){await navigator.share(data)}else{await navigator.clipboard.writeText(location.href);$('sharebtn').textContent='Link copied'}}catch(e){}
};
load();
</script></body></html>`;
}

export const HOME = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Get Done</title><style>${STYLE}</style></head><body><main><div><span class="mark"></span><span class="brand">Get Done</span></div><h1>Friend links</h1><p>This is the picture drop for the Get Done browser extension. You need a link from a friend to send a picture.</p></main></body></html>`;
