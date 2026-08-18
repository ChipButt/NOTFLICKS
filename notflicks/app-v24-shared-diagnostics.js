/* v24: persistent shared-sync diagnostics and clearer connection state */
let v24LastSharedError='';
let v24ConnectionChecked=false;

v13UpdateSharedStatus=function(message=''){
  const pill=$('sharedStatusPill'),detail=$('sharedLibraryStatus');if(!pill||!detail)return;
  if(message){
    detail.textContent=message;
    if(/could not|failed|error|missing|rejected|not allowed|invalid/i.test(message))v24LastSharedError=message;
  }
  pill.classList.remove('ok','warning');
  if(!v13ApiConfigured()){
    pill.textContent='SHARED API SETUP NEEDED';pill.classList.add('warning');
    if(!message)detail.textContent='Cloudflare Worker URL has not been added yet.';
    return;
  }
  if(v13IsDirty()){
    pill.textContent='UNSAVED CHANGES';pill.classList.add('warning');
    if(!message)detail.textContent='This browser has changes that have not been saved to the shared library yet.';
    return;
  }
  if(v24LastSharedError){
    pill.textContent='SHARED ERROR';pill.classList.add('warning');
    if(!message)detail.textContent=v24LastSharedError;
    return;
  }
  if(v13PublishedLibrary){
    const count=Array.isArray(v13PublishedLibrary.films)?v13PublishedLibrary.films.length:0;
    pill.textContent=count?'SHARED':'SHARED EMPTY';pill.classList.add('ok');
    if(!message){
      const saved=v13PublishedLibrary.updatedAt?` Last saved ${v13FormatPublishedTime(v13PublishedLibrary.updatedAt)}.`:'';
      detail.textContent=`Connected to the shared library · ${count} film${count===1?'':'s'}.${saved}`;
    }
    return;
  }
  pill.textContent=v24ConnectionChecked?'NOT CONNECTED':'CONNECTING…';
  if(v24ConnectionChecked)pill.classList.add('warning');
  if(!message)detail.textContent=v24ConnectionChecked?'No shared library connection is active.':'Checking the shared library…';
};

v13FetchPublishedLibrary=async function(){
  if(!v13ApiConfigured()){
    const res=await fetch(`films.json?_=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)return null;
    const parsed=await res.json();const doc=Array.isArray(parsed)?{schema:1,updatedAt:null,films:parsed}:parsed;
    if(!doc||!Array.isArray(doc.films))throw new Error('Repository fallback is not valid NOTFLICKS data.');
    return{...doc,sha:'',films:doc.films.map(normaliseFilm)};
  }
  try{
    const res=await fetch(`${v13ApiUrl('/state')}?_=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});
    const payload=await res.json().catch(()=>null);
    if(!res.ok)throw new Error(payload?.error||`Shared API returned HTTP ${res.status}.`);
    const doc=payload?.data;
    if(!doc||!Array.isArray(doc.films))throw new Error('Shared API returned an invalid library.');
    v24ConnectionChecked=true;v24LastSharedError='';
    return{...doc,sha:payload.sha||'',films:doc.films.map(normaliseFilm)};
  }catch(error){
    v24ConnectionChecked=true;
    let reason=error?.message||'Shared API request failed.';
    try{
      const healthRes=await fetch(`${v13ApiUrl('/health')}?_=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});
      const health=await healthRes.json().catch(()=>null);
      if(health){
        if(!health.githubTokenConfigured)reason='Cloudflare Worker is live, but the GITHUB_TOKEN secret is missing.';
        else if(!health.editPinConfigured)reason='Cloudflare Worker is live, but the EDIT_PIN secret is missing.';
        else if(health.githubRead===false)reason=`Cloudflare Worker is live, but ${health.githubError||'it cannot read the GitHub library.'}`;
        else if(health.githubRead===true)reason=`Cloudflare Worker and GitHub are reachable, but loading /state failed: ${reason}`;
      }
    }catch{}
    v24LastSharedError=reason;
    throw new Error(reason);
  }
};

const v24OriginalLoadPublished=v13LoadPublished;
v13LoadPublished=async function(force=false){
  try{
    const result=await v24OriginalLoadPublished(force);
    if(result&&v13PublishedLibrary){v24ConnectionChecked=true;v24LastSharedError='';}
    v13UpdateSharedStatus();
    return result;
  }catch(error){
    v24ConnectionChecked=true;v24LastSharedError=error?.message||'Shared library load failed.';v13UpdateSharedStatus();return false;
  }
};

// The v23 script starts one load before this patch is parsed. Run one fresh diagnostic
// load after all current scripts have had a chance to initialise.
setTimeout(()=>v13LoadPublished(false),100);
