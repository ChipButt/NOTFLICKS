/* v16: view/select artwork candidates + URL/clipboard paste */
let v16ArtFilmId='';
let v16ArtCandidates={poster:[],banner:[]};

function v16EnsureDialog(){
  if(document.getElementById('artViewDialog'))return;
  const dialog=document.createElement('dialog');
  dialog.id='artViewDialog';dialog.className='art-view-dialog';
  dialog.innerHTML=`<div class="art-view-head"><div><h2 id="artViewTitle">Artwork</h2><p>Choose from likely artwork, paste an image URL, or paste a copied image directly.</p></div><button id="artViewClose" class="art-view-close" type="button" aria-label="Close">×</button></div><div class="art-view-body"><div id="artViewStatus" class="art-view-status"></div><section class="art-view-section"><div class="art-view-section-head"><div><h3>Poster / DVD cover</h3><small>Portrait artwork used in selector cards.</small></div></div><div id="posterCandidateGrid" class="art-candidate-grid"><div class="art-loading">Finding poster options…</div></div><div class="custom-art-box"><input id="posterUrlInput" type="url" placeholder="Paste poster image URL"><button type="button" data-use-url="poster">Use URL</button></div><div class="paste-art-zone" tabindex="0" data-paste-target="poster">Click here, then paste a copied image (Ctrl/Cmd+V)</div><div class="clipboard-note">Copied images are resized and compressed before being saved into the library.</div></section><section class="art-view-section"><div class="art-view-section-head"><div><h3>Banner / backdrop</h3><small>Landscape artwork used in the selected-film banner.</small></div></div><div id="bannerCandidateGrid" class="art-candidate-grid"><div class="art-loading">Finding banner options…</div></div><div class="custom-art-box"><input id="bannerUrlInput" type="url" placeholder="Paste banner image URL"><button type="button" data-use-url="banner">Use URL</button></div><div class="paste-art-zone" tabindex="0" data-paste-target="banner">Click here, then paste a copied image (Ctrl/Cmd+V)</div><div class="clipboard-note">If you later publish the library, pasted image data is included in the shared library too.</div></section></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('#artViewClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
    const use=event.target.closest('[data-art-use]');if(use)v16UseCandidate(use.dataset.kind,Number(use.dataset.index));
    const urlButton=event.target.closest('[data-use-url]');if(urlButton)v16UseUrl(urlButton.dataset.useUrl);
  });
  dialog.addEventListener('paste',v16HandlePaste);
}

function v16AugmentLibrary(){
  document.querySelectorAll('.film-row .row-actions').forEach(actions=>{
    if(actions.querySelector('[data-action="view-art"]'))return;
    const refind=actions.querySelector('[data-action="refind"]');
    const button=document.createElement('button');button.type='button';button.dataset.action='view-art';button.textContent='VIEW ART';
    if(refind)refind.insertAdjacentElement('afterend',button);else actions.prepend(button);
  });
}

const v16PreviousRenderLibrary=renderLibrary;
renderLibrary=function(){v16PreviousRenderLibrary();v16AugmentLibrary()};
v16AugmentLibrary();

function v16CandidateKey(c){return c?.original||c?.url||''}
function v16UniqueCandidates(list){const seen=new Set();return list.filter(c=>{const k=v16CandidateKey(c);if(!k||seen.has(k))return false;seen.add(k);return true})}
function v16PlausiblePoster(c){const r=(Number(c.width)||0)/(Number(c.height)||1);return r>=.42&&r<=.9}
function v16PlausibleBanner(c){const r=(Number(c.width)||0)/(Number(c.height)||1);return r>=1.25&&r<=2.6}
function v16SortCandidates(list,kind,film){
  const scorer=kind==='poster'?c=>posterScore(c,{title:film.title,year:film.year}):c=>bannerScore(c,{title:film.title,year:film.year},film.poster||'');
  const plausible=kind==='poster'?v16PlausiblePoster:v16PlausibleBanner;
  return v16UniqueCandidates(list).filter(plausible).map(c=>({...c,_score:Number(scorer(c))||0})).sort((a,b)=>b._score-a._score).slice(0,24);
}

async function v16GetCandidates(film){
  let article=null;
  if(film.wikipediaTitle)try{article=await fetchArticleByTitle(film.wikipediaTitle)}catch{}
  if(!article)article=await identifyFilmArticle({title:film.title,year:film.year});
  const articleImages=article?await imageInfoFromTitles((article.images||[]).map(x=>x.title),'article'):[];
  const lead=[];
  if(article?.thumbnail?.source&&article.thumbnail.width&&article.thumbnail.height)lead.push({title:`${article.title} lead image`,url:article.thumbnail.source,original:article.original?.source||article.thumbnail.source,width:article.thumbnail.width,height:article.thumbnail.height,source:'lead'});
  const y=film.year?` ${film.year}`:'';
  const [posterSearch,dvdSearch,stillSearch,bannerSearch]=await Promise.all([
    commonsSearch(`${film.title}${y} film poster`,'commons-poster'),
    commonsSearch(`${film.title}${y} DVD cover`,'commons-dvd'),
    commonsSearch(`${film.title}${y} film still`,'commons-still'),
    commonsSearch(`${film.title}${y} film banner backdrop`,'commons-banner')
  ]);
  return{
    poster:v16SortCandidates([...lead,...articleImages,...posterSearch,...dvdSearch],'poster',film),
    banner:v16SortCandidates([...articleImages,...stillSearch,...bannerSearch],'banner',film)
  };
}

function v16CandidateCard(c,kind,index,current){
  const url=c.url||c.original||'';const isCurrent=!!current&&(current===url||current===c.original);
  return `<article class="art-candidate ${kind} ${isCurrent?'current':''}"><div class="art-candidate-frame"><img src="${escapeHtml(url)}" alt=""></div><div class="art-candidate-meta"><strong>${escapeHtml(String(c.title||c.source||'Artwork'))}</strong>${Number(c.width)||0}×${Number(c.height)||0} · ${escapeHtml(String(c.source||''))}</div><button type="button" data-art-use="1" data-kind="${kind}" data-index="${index}" ${isCurrent?'disabled':''}>${isCurrent?'CURRENT':'USE THIS'}</button></article>`
}
function v16RenderCandidates(film){
  const pg=$('posterCandidateGrid'),bg=$('bannerCandidateGrid');
  pg.innerHTML=v16ArtCandidates.poster.length?v16ArtCandidates.poster.map((c,i)=>v16CandidateCard(c,'poster',i,film.poster)).join(''):'<div class="art-loading">No additional portrait candidates found. You can paste your own below.</div>';
  bg.innerHTML=v16ArtCandidates.banner.length?v16ArtCandidates.banner.map((c,i)=>v16CandidateCard(c,'banner',i,film.backdrop)).join(''):'<div class="art-loading">No additional landscape candidates found. You can paste your own below.</div>';
}

async function v16OpenArt(filmId){
  const film=films.find(f=>f.id===filmId);if(!film)return;
  v16EnsureDialog();v16ArtFilmId=filmId;v16ArtCandidates={poster:[],banner:[]};
  $('artViewTitle').textContent=`View art — ${film.title}${film.year?` (${film.year})`:''}`;
  $('artViewStatus').textContent='Finding likely poster and banner options…';
  $('posterCandidateGrid').innerHTML='<div class="art-loading">Finding poster options…</div>';
  $('bannerCandidateGrid').innerHTML='<div class="art-loading">Finding banner options…</div>';
  $('posterUrlInput').value='';$('bannerUrlInput').value='';$('artViewDialog').showModal();
  try{
    v16ArtCandidates=await v16GetCandidates(film);
    v16RenderCandidates(film);
    $('artViewStatus').textContent=`Found ${v16ArtCandidates.poster.length} plausible poster option${v16ArtCandidates.poster.length===1?'':'s'} and ${v16ArtCandidates.banner.length} plausible banner option${v16ArtCandidates.banner.length===1?'':'s'}.`;
  }catch(error){console.warn('Artwork candidate lookup failed',error);$('artViewStatus').textContent='Could not load all suggested artwork. You can still paste an image URL or copied image below.';$('posterCandidateGrid').innerHTML='<div class="art-loading">Suggestions unavailable.</div>';$('bannerCandidateGrid').innerHTML='<div class="art-loading">Suggestions unavailable.</div>'}
}

function v16ApplyArt(kind,value,label='Custom artwork'){
  const index=films.findIndex(f=>f.id===v16ArtFilmId);if(index<0||!value)return;
  if(kind==='poster')films[index].poster=value;else films[index].backdrop=value;
  films[index].source='custom';save();renderLibrary();
  const film=films[index];v16RenderCandidates(film);$('artViewStatus').textContent=`${kind==='poster'?'Poster':'Banner'} changed to ${label}.`;
}
function v16UseCandidate(kind,index){const c=v16ArtCandidates[kind]?.[index];if(c)v16ApplyArt(kind,c.url||c.original,c.title||'selected artwork')}
function v16UseUrl(kind){const input=$(kind==='poster'?'posterUrlInput':'bannerUrlInput');const value=input.value.trim();if(!/^https?:\/\//i.test(value)&&!/^data:image\//i.test(value)){ $('artViewStatus').textContent='Paste a direct http/https image URL.';return}v16ApplyArt(kind,value,'pasted URL')}

async function v16BlobToCompressedDataUrl(blob,kind){
  let bitmap=null;
  try{bitmap=await createImageBitmap(blob)}catch{}
  if(!bitmap){
    bitmap=await new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(blob);img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Could not read pasted image'))};img.src=u});
  }
  const sw=bitmap.width||bitmap.naturalWidth,sh=bitmap.height||bitmap.naturalHeight;
  const maxW=kind==='poster'?1000:1600,maxH=kind==='poster'?1500:900;
  const scale=Math.min(1,maxW/sw,maxH/sh),w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();
  return canvas.toDataURL('image/jpeg',.76);
}
async function v16HandlePaste(event){
  const zone=event.target.closest('[data-paste-target]');if(!zone)return;
  const kind=zone.dataset.pasteTarget;const items=[...(event.clipboardData?.items||[])];
  const imageItem=items.find(item=>String(item.type||'').startsWith('image/'));
  if(imageItem){
    event.preventDefault();$('artViewStatus').textContent=`Preparing pasted ${kind} image…`;
    try{const dataUrl=await v16BlobToCompressedDataUrl(imageItem.getAsFile(),kind);v16ApplyArt(kind,dataUrl,'pasted clipboard image')}catch(error){console.warn(error);$('artViewStatus').textContent='Could not read that pasted image.'}
    return;
  }
  const text=event.clipboardData?.getData('text/plain')?.trim();
  if(text&&/^https?:\/\//i.test(text)){event.preventDefault();$(kind==='poster'?'posterUrlInput':'bannerUrlInput').value=text;v16ApplyArt(kind,text,'pasted URL')}
}

library.addEventListener('click',event=>{const button=event.target.closest('button[data-action="view-art"]');if(!button)return;const row=button.closest('.film-row');if(row)v16OpenArt(row.dataset.id)});
v16EnsureDialog();
