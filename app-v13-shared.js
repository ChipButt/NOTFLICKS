/* v13: GitHub-backed shared library + bulk film removal */
const NOTFLICKS_SHARED={
  owner:'ChipButt',repo:'NOTFLICKS',branch:'main',path:'films.json',
  tokenKey:'notflicks.githubToken.v1',dirtyKey:'notflicks.libraryDirty.v1',syncedKey:'notflicks.sharedSyncedAt.v1'
};
let v13SharedInitComplete=false;
let v13ApplyingShared=false;
let v13PublishedLibrary=null;
const v13SelectedFilmIds=new Set();

function v13EncodeBase64Utf8(text){
  const bytes=new TextEncoder().encode(text);let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
function v13DecodeBase64Utf8(base64){
  const binary=atob(String(base64||'').replace(/\s/g,''));const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function v13Headers(token=''){
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(token)headers.Authorization=`Bearer ${token}`;
  return headers;
}
function v13ContentsUrl(){return`https://api.github.com/repos/${NOTFLICKS_SHARED.owner}/${NOTFLICKS_SHARED.repo}/contents/${NOTFLICKS_SHARED.path}?ref=${encodeURIComponent(NOTFLICKS_SHARED.branch)}`}
function v13IsDirty(){return localStorage.getItem(NOTFLICKS_SHARED.dirtyKey)==='1'}
function v13SetDirty(value){localStorage.setItem(NOTFLICKS_SHARED.dirtyKey,value?'1':'0');v13UpdateSharedStatus()}
function v13FormatPublishedTime(value){
  if(!value)return'';const d=new Date(value);if(Number.isNaN(d.getTime()))return'';
  return d.toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
}
function v13UpdateSharedStatus(message=''){
  const pill=$('sharedStatusPill'),detail=$('sharedLibraryStatus');if(!pill||!detail)return;
  if(message)detail.textContent=message;
  if(v13IsDirty()){
    pill.textContent='LOCAL CHANGES';pill.classList.add('warning');pill.classList.remove('ok');
    if(!message)detail.textContent='This browser has unpublished changes. Publish when you want other devices to receive them.';
    return;
  }
  if(v13PublishedLibrary?.updatedAt){
    pill.textContent='PUBLISHED';pill.classList.add('ok');pill.classList.remove('warning');
    if(!message)detail.textContent=`Shared library published ${v13FormatPublishedTime(v13PublishedLibrary.updatedAt)}.`;
  }else{
    pill.textContent='LOCAL ONLY';pill.classList.remove('ok','warning');
    if(!message)detail.textContent='No shared library has been published yet.';
  }
}

const v13OriginalSave=save;
save=function(){
  v13OriginalSave();
  if(v13SharedInitComplete&&!v13ApplyingShared)v13SetDirty(true);
};

function v13UpdateBulkControls(){
  for(const id of [...v13SelectedFilmIds])if(!films.some(f=>f.id===id))v13SelectedFilmIds.delete(id);
  const count=v13SelectedFilmIds.size,selectedCount=$('selectedCount'),removeButton=$('removeSelectedButton'),clearButton=$('clearSelectionButton');
  if(selectedCount)selectedCount.textContent=`${count} selected`;
  if(removeButton)removeButton.disabled=count===0;
  if(clearButton)clearButton.disabled=count===0;
}

renderLibrary=function(){
  $('filmCountPill').textContent=`${films.length} FILM${films.length===1?'':'S'}`;
  $('libraryEmpty').hidden=films.length>0;
  for(const id of [...v13SelectedFilmIds])if(!films.some(f=>f.id===id))v13SelectedFilmIds.delete(id);
  library.innerHTML=films.map((film,index)=>`<article class="film-row bulk-film-row" data-id="${escapeHtml(film.id)}">
    <label class="film-select-box" title="Select ${escapeHtml(film.title)}"><input type="checkbox" data-film-select="${escapeHtml(film.id)}" ${v13SelectedFilmIds.has(film.id)?'checked':''}/><span></span></label>
    <div class="library-poster-frame">${film.poster?`<img src="${escapeHtml(film.poster)}" alt=""/>`:`<div class="art-placeholder">POSTER<br>MISSING</div>`}</div>
    <div class="library-banner-frame">${film.backdrop?`<img src="${escapeHtml(film.backdrop)}" alt=""/>`:`<div class="art-placeholder">BANNER<br>MISSING</div>`}</div>
    <div><h3>${escapeHtml(film.title)}</h3><div class="row-meta">${escapeHtml(film.year||'Year unknown')} · ${sourceLabel(film)}${film.wikipediaTitle?`<br>Version: ${escapeHtml(film.wikipediaTitle)}`:''}<br>${escapeHtml((film.categories||[]).join(' · '))}</div><div class="art-status"><span class="art-chip ${film.poster?'ok':''}">POSTER ${film.poster?'✓':'—'}</span><span class="art-chip ${film.backdrop?'ok':''}">BANNER ${film.backdrop?'✓':'—'}</span></div></div>
    <div class="row-actions"><button data-action="versions">VERSIONS</button><button data-action="refind">REFIND ART</button><button data-action="google-poster">GOOGLE POSTER</button><button data-action="google-banner">GOOGLE BANNER</button><button data-action="edit">EDIT</button><button data-action="up" ${index===0?'disabled':''}>↑</button><button data-action="down" ${index===films.length-1?'disabled':''}>↓</button><button data-action="remove">×</button></div>
  </article>`).join('');
  v13UpdateBulkControls();
};

function v13SelectAll(){films.forEach(f=>v13SelectedFilmIds.add(f.id));renderLibrary()}
function v13ClearSelection(){v13SelectedFilmIds.clear();renderLibrary()}
function v13RemoveSelected(){
  const count=v13SelectedFilmIds.size;if(!count)return;
  if(!confirm(`Remove ${count} selected film${count===1?'':'s'} from this library?`))return;
  films=films.filter(f=>!v13SelectedFilmIds.has(f.id));v13SelectedFilmIds.clear();filmIndex=clampIndex(filmIndex);save();
}

async function v13FetchPublishedLibrary(token=''){
  try{
    const res=await fetch(`${v13ContentsUrl()}&_=${Date.now()}`,{headers:v13Headers(token),cache:'no-store'});
    if(res.status===404)return null;
    if(!res.ok)throw new Error(`GitHub ${res.status}`);
    const payload=await res.json();
    const parsed=JSON.parse(v13DecodeBase64Utf8(payload.content||''));
    const doc=Array.isArray(parsed)?{schema:1,updatedAt:null,films:parsed}:parsed;
    if(!doc||!Array.isArray(doc.films))throw new Error('Shared library format is invalid.');
    return{...doc,sha:payload.sha||'',films:doc.films.map(normaliseFilm)};
  }catch(error){
    try{
      const res=await fetch(`films.json?_=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw error;
      const parsed=await res.json();const doc=Array.isArray(parsed)?{schema:1,updatedAt:null,films:parsed}:parsed;
      if(!doc||!Array.isArray(doc.films))throw error;
      return{...doc,sha:'',films:doc.films.map(normaliseFilm)};
    }catch{throw error}
  }
}
function v13ApplyPublished(doc){
  if(!doc)return;
  v13ApplyingShared=true;
  films=(doc.films||[]).map(normaliseFilm);filmIndex=clampIndex(filmIndex);v13SelectedFilmIds.clear();
  localStorage.setItem(STORAGE.films,JSON.stringify(films));
  localStorage.setItem(NOTFLICKS_SHARED.syncedKey,doc.updatedAt||'');
  localStorage.setItem(NOTFLICKS_SHARED.dirtyKey,'0');
  v13PublishedLibrary=doc;
  renderLibrary();
  v13ApplyingShared=false;
  v13UpdateSharedStatus();
}
async function v13LoadPublished(force=false){
  const detail=$('sharedLibraryStatus');if(detail)detail.textContent='Checking GitHub for the published library…';
  try{
    const doc=await v13FetchPublishedLibrary();v13PublishedLibrary=doc;
    if(!doc){v13UpdateSharedStatus('No published shared library exists yet.');return false}
    if(force&&v13IsDirty()&&films.length&&!confirm('Replace this browser’s unpublished local changes with the published library?')){v13UpdateSharedStatus();return false}
    if(force){v13ApplyPublished(doc);return true}
    const synced=localStorage.getItem(NOTFLICKS_SHARED.syncedKey)||'';
    if(!films.length||(!v13IsDirty()&&doc.updatedAt&&doc.updatedAt!==synced))v13ApplyPublished(doc);
    else v13UpdateSharedStatus();
    return true;
  }catch(error){
    console.warn('Shared library load failed',error);v13UpdateSharedStatus('Could not reach the shared library. The local copy is still available offline.');return false;
  }
}

function v13OpenGithubDialog(){
  const input=$('githubToken'),saved=localStorage.getItem(NOTFLICKS_SHARED.tokenKey)||'';
  input.value=saved;input.placeholder=saved?'Token saved on this browser':'github_pat_…';$('githubDialog').showModal();setTimeout(()=>input.focus(),40);
}
function v13SaveGithubToken(){
  const token=$('githubToken').value.trim();
  if(token)localStorage.setItem(NOTFLICKS_SHARED.tokenKey,token);
  $('githubDialog').close();v13UpdateSharedStatus(token?'GitHub publishing access saved on this browser.':'No token was entered.');
}
function v13ForgetGithubToken(){
  localStorage.removeItem(NOTFLICKS_SHARED.tokenKey);$('githubToken').value='';v13UpdateSharedStatus('GitHub publishing access removed from this browser.');
}
async function v13PublishLibrary(retry=true){
  const token=localStorage.getItem(NOTFLICKS_SHARED.tokenKey)||'';
  if(!token){v13OpenGithubDialog();v13UpdateSharedStatus('Add GitHub publishing access on this browser, then press Publish Library again.');return}
  const button=$('publishLibraryButton');button.disabled=true;v13UpdateSharedStatus(`Publishing ${films.length} film${films.length===1?'':'s'} to GitHub…`);
  try{
    const currentRes=await fetch(v13ContentsUrl(),{headers:v13Headers(token),cache:'no-store'});
    let sha='';
    if(currentRes.ok){const current=await currentRes.json();sha=current.sha||''}
    else if(currentRes.status!==404)throw new Error(currentRes.status===401||currentRes.status===403?'GitHub access was rejected. Check that the token is restricted to ChipButt/NOTFLICKS and has Contents read/write permission.':`GitHub ${currentRes.status}`);
    const updatedAt=new Date().toISOString();
    const doc={schema:1,updatedAt,films:films.map(({id,...film})=>({id,...film}))};
    const body={message:`Publish NOTFLICKS library (${films.length} films)`,content:v13EncodeBase64Utf8(JSON.stringify(doc,null,2)),branch:NOTFLICKS_SHARED.branch};if(sha)body.sha=sha;
    const put=await fetch(`https://api.github.com/repos/${NOTFLICKS_SHARED.owner}/${NOTFLICKS_SHARED.repo}/contents/${NOTFLICKS_SHARED.path}`,{method:'PUT',headers:{...v13Headers(token),'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(put.status===409&&retry){button.disabled=false;return v13PublishLibrary(false)}
    if(!put.ok)throw new Error(put.status===401||put.status===403?'GitHub access was rejected. Check the token permissions.':`GitHub publish failed (${put.status}).`);
    const result=await put.json();
    v13PublishedLibrary={...doc,sha:result.content?.sha||'',films:doc.films.map(normaliseFilm)};
    localStorage.setItem(NOTFLICKS_SHARED.syncedKey,updatedAt);localStorage.setItem(NOTFLICKS_SHARED.dirtyKey,'0');
    v13UpdateSharedStatus(`Published ${films.length} film${films.length===1?'':'s'} successfully. Other devices will load this library automatically.`);
  }catch(error){
    console.warn('Publish failed',error);v13SetDirty(true);v13UpdateSharedStatus(error.message||'Could not publish the library.');
  }finally{button.disabled=false}
}

library.addEventListener('change',event=>{
  const checkbox=event.target.closest('input[data-film-select]');if(!checkbox)return;
  checkbox.checked?v13SelectedFilmIds.add(checkbox.dataset.filmSelect):v13SelectedFilmIds.delete(checkbox.dataset.filmSelect);v13UpdateBulkControls();
});
$('selectAllButton')?.addEventListener('click',v13SelectAll);
$('clearSelectionButton')?.addEventListener('click',v13ClearSelection);
$('removeSelectedButton')?.addEventListener('click',v13RemoveSelected);
$('loadPublishedButton')?.addEventListener('click',()=>v13LoadPublished(true));
$('publishLibraryButton')?.addEventListener('click',()=>v13PublishLibrary());
$('githubAccessButton')?.addEventListener('click',v13OpenGithubDialog);
$('githubTokenSave')?.addEventListener('click',v13SaveGithubToken);
$('githubTokenForget')?.addEventListener('click',v13ForgetGithubToken);
$('githubTokenCancel')?.addEventListener('click',()=>$('githubDialog').close());

(async()=>{
  renderLibrary();
  await v13LoadPublished(false);
  v13SharedInitComplete=true;
  v13UpdateSharedStatus();
})();
