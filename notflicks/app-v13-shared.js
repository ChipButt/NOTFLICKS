/* v23: Cloudflare Worker-backed shared library + bulk film removal */
const NOTFLICKS_SHARED={
  apiBase:'https://notflicks-shared-api.goldplushighdefinition.workers.dev',
  dirtyKey:'notflicks.libraryDirty.v2',
  syncedKey:'notflicks.sharedSyncedAt.v2',
  pinKey:'notflicks.editPin.session.v1'
};
let v13SharedInitComplete=false;
let v13ApplyingShared=false;
let v13PublishedLibrary=null;
const v13SelectedFilmIds=new Set();

function v13ApiConfigured(){
  return /^https:\/\//i.test(NOTFLICKS_SHARED.apiBase)&&!NOTFLICKS_SHARED.apiBase.includes('PASTE_YOUR_');
}
function v13ApiUrl(path){return `${NOTFLICKS_SHARED.apiBase.replace(/\/$/,'')}${path}`}
function v13IsDirty(){return localStorage.getItem(NOTFLICKS_SHARED.dirtyKey)==='1'}
function v13SetDirty(value){localStorage.setItem(NOTFLICKS_SHARED.dirtyKey,value?'1':'0');v13UpdateSharedStatus()}
function v13FormatPublishedTime(value){
  if(!value)return'';const d=new Date(value);if(Number.isNaN(d.getTime()))return'';
  return d.toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
}
function v13UpdateSharedStatus(message=''){
  const pill=$('sharedStatusPill'),detail=$('sharedLibraryStatus');if(!pill||!detail)return;
  if(message)detail.textContent=message;
  if(!v13ApiConfigured()){
    pill.textContent='SHARED API SETUP NEEDED';pill.classList.add('warning');pill.classList.remove('ok');
    if(!message)detail.textContent='Cloudflare Worker URL has not been added yet. Local changes still work on this browser.';
    return;
  }
  if(v13IsDirty()){
    pill.textContent='UNSAVED CHANGES';pill.classList.add('warning');pill.classList.remove('ok');
    if(!message)detail.textContent='This browser has changes that have not been saved to the shared library yet.';
    return;
  }
  if(v13PublishedLibrary?.updatedAt){
    pill.textContent='SHARED';pill.classList.add('ok');pill.classList.remove('warning');
    if(!message)detail.textContent=`Shared library saved ${v13FormatPublishedTime(v13PublishedLibrary.updatedAt)}.`;
  }else{
    pill.textContent='LOCAL ONLY';pill.classList.remove('ok','warning');
    if(!message)detail.textContent='No shared library has been loaded yet.';
  }
}

function v13ConfigureAccessUi(){
  const access=$('githubAccessButton'),dialog=$('githubDialog'),input=$('githubToken');
  if(access)access.textContent='Edit PIN';
  if(!dialog||!input)return;
  const heading=dialog.querySelector('h2');if(heading)heading.textContent='Shared edit access';
  const firstP=dialog.querySelector('p');if(firstP)firstP.textContent='Enter the shared edit PIN to save changes for every device. The PIN is sent only to the Cloudflare Worker over HTTPS; no GitHub token is stored in this browser.';
  const label=dialog.querySelector('label');if(label){
    for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE)node.textContent='Edit PIN';
  }
  input.placeholder='Shared edit PIN';input.autocomplete='off';
  const help=dialog.querySelector('.github-help');if(help)help.textContent='The GitHub write token lives only in Cloudflare as an encrypted secret. App users never receive it.';
  if($('githubTokenSave'))$('githubTokenSave').textContent='Use PIN';
  if($('githubTokenForget'))$('githubTokenForget').textContent='Forget PIN';
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

async function v13FetchPublishedLibrary(){
  if(!v13ApiConfigured()){
    const res=await fetch(`films.json?_=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)return null;
    const parsed=await res.json();const doc=Array.isArray(parsed)?{schema:1,updatedAt:null,films:parsed}:parsed;
    if(!doc||!Array.isArray(doc.films))throw new Error('Shared library format is invalid.');
    return{...doc,sha:'',films:doc.films.map(normaliseFilm)};
  }
  const res=await fetch(v13ApiUrl('/state'),{cache:'no-store',headers:{Accept:'application/json'}});
  if(res.status===404)return null;
  if(!res.ok)throw new Error(`Shared API ${res.status}`);
  const payload=await res.json();
  const doc=payload?.data;
  if(!doc||!Array.isArray(doc.films))throw new Error('Shared library format is invalid.');
  return{...doc,sha:payload.sha||'',films:doc.films.map(normaliseFilm)};
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
  const detail=$('sharedLibraryStatus');if(detail)detail.textContent=v13ApiConfigured()?'Checking the shared library…':'Loading the repository fallback…';
  try{
    const doc=await v13FetchPublishedLibrary();v13PublishedLibrary=doc;
    if(!doc){v13UpdateSharedStatus('No published shared library exists yet.');return false}
    if(force&&v13IsDirty()&&films.length&&!confirm('Replace this browser’s unsaved changes with the latest shared library?')){v13UpdateSharedStatus();return false}
    if(force){v13ApplyPublished(doc);return true}
    const synced=localStorage.getItem(NOTFLICKS_SHARED.syncedKey)||'';
    if(!films.length||(!v13IsDirty()&&doc.updatedAt&&doc.updatedAt!==synced))v13ApplyPublished(doc);
    else v13UpdateSharedStatus();
    return true;
  }catch(error){
    console.warn('Shared library load failed',error);v13UpdateSharedStatus('Could not reach the shared library. The local copy is still available.');return false;
  }
}

function v13OpenGithubDialog(){
  const input=$('githubToken'),saved=sessionStorage.getItem(NOTFLICKS_SHARED.pinKey)||'';
  input.value=saved;input.placeholder=saved?'PIN saved for this tab':'Shared edit PIN';$('githubDialog').showModal();setTimeout(()=>input.focus(),40);
}
function v13SaveGithubToken(){
  const pin=$('githubToken').value.trim();
  if(pin)sessionStorage.setItem(NOTFLICKS_SHARED.pinKey,pin);
  $('githubDialog').close();v13UpdateSharedStatus(pin?'Edit PIN saved for this browser tab.':'No PIN was entered.');
}
function v13ForgetGithubToken(){
  sessionStorage.removeItem(NOTFLICKS_SHARED.pinKey);$('githubToken').value='';v13UpdateSharedStatus('Edit PIN removed from this browser tab.');
}
async function v13PublishLibrary(){
  if(!v13ApiConfigured()){v13UpdateSharedStatus('Cloudflare Worker is not configured yet, so shared saving is disabled.');return}
  const pin=sessionStorage.getItem(NOTFLICKS_SHARED.pinKey)||'';
  if(!pin){v13OpenGithubDialog();v13UpdateSharedStatus('Enter the shared edit PIN, then press Save Shared Library again.');return}
  const button=$('publishLibraryButton');button.disabled=true;v13UpdateSharedStatus(`Saving ${films.length} film${films.length===1?'':'s'} for every device…`);
  try{
    const updatedAt=new Date().toISOString();
    const doc={schema:2,updatedAt,films:films.map(({id,...film})=>({id,...film}))};
    const res=await fetch(v13ApiUrl('/state'),{
      method:'PUT',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Edit-Pin':pin},
      body:JSON.stringify({data:doc,baseSha:v13PublishedLibrary?.sha||''})
    });
    if(res.status===401){sessionStorage.removeItem(NOTFLICKS_SHARED.pinKey);throw new Error('The edit PIN was rejected. Press Edit PIN and try again.')}
    if(res.status===409){throw new Error('Someone else saved a newer shared library. Press Load published before saving again so their changes are not overwritten.')}
    if(res.status===403)throw new Error('This website origin is not allowed to use the shared API. Check the Worker ALLOWED_ORIGINS setting.');
    if(!res.ok){const payload=await res.json().catch(()=>null);throw new Error(payload?.error||`Shared save failed (${res.status}).`)}
    const result=await res.json();
    v13PublishedLibrary={...doc,sha:result.sha||'',films:doc.films.map(normaliseFilm)};
    localStorage.setItem(NOTFLICKS_SHARED.syncedKey,updatedAt);localStorage.setItem(NOTFLICKS_SHARED.dirtyKey,'0');
    v13UpdateSharedStatus(`Saved ${films.length} film${films.length===1?'':'s'} successfully. Other devices will load this library automatically.`);
  }catch(error){
    console.warn('Shared save failed',error);v13SetDirty(true);v13UpdateSharedStatus(error.message||'Could not save the shared library.');
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

v13ConfigureAccessUi();
if($('publishLibraryButton'))$('publishLibraryButton').textContent='Save shared library';
if($('loadPublishedButton'))$('loadPublishedButton').textContent='Reload shared';
const sharedHeading=document.querySelector('.shared-panel h2');if(sharedHeading)sharedHeading.textContent='Shared library';
const sharedCopy=document.querySelector('.shared-panel p');if(sharedCopy)sharedCopy.textContent='Save the current film list through the secure shared API. Every device loads the same films, selected versions, poster URLs and banner URLs; the GitHub write credential never reaches the browser.';

(async()=>{
  renderLibrary();
  await v13LoadPublished(false);
  v13SharedInitComplete=true;
  v13UpdateSharedStatus();
})();
