const JSON_HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};

export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin')||'';
    const cors=getCors(origin,env);
    if(request.method==='OPTIONS')return new Response(null,{status:cors.allowed?204:403,headers:cors.headers});
    if(!cors.allowed)return json({error:'Origin not allowed.',origin,allowedOrigins:String(env.ALLOWED_ORIGINS||'')},403,cors.headers);

    const url=new URL(request.url);
    try{
      if(url.pathname==='/health'&&request.method==='GET')return await health(env,cors.headers);
      if(url.pathname==='/state'&&request.method==='GET')return await getState(env,cors.headers);
      if(url.pathname==='/state'&&request.method==='PUT'){
        if(!await validPin(request,env))return json({error:'Invalid edit PIN.'},401,cors.headers);
        return await putState(request,env,cors.headers);
      }
      return json({error:'Not found.'},404,cors.headers);
    }catch(error){
      console.error(error);
      return json({error:error?.message||'Unexpected server error.'},500,cors.headers);
    }
  }
};

function getCors(origin,env){
  const allowedOrigins=String(env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
  const allowed=!origin||allowedOrigins.includes(origin);
  const headers={
    ...JSON_HEADERS,
    'Vary':'Origin',
    'Access-Control-Allow-Methods':'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,X-Edit-Pin',
    'Access-Control-Max-Age':'86400'
  };
  if(origin&&allowed)headers['Access-Control-Allow-Origin']=origin;
  return{allowed,headers};
}

async function health(env,corsHeaders){
  const result={
    ok:true,
    service:'notflicks-shared-api',
    githubTokenConfigured:!!env.GITHUB_TOKEN,
    editPinConfigured:!!env.EDIT_PIN,
    statePath:env.STATE_PATH||'films.json',
    repo:`${env.GITHUB_OWNER||''}/${env.GITHUB_REPO||''}`,
    branch:env.GITHUB_BRANCH||'main',
    githubRead:false
  };
  try{
    const current=await fetchCurrent(env);
    result.githubRead=true;
    result.stateExists=!!current;
    result.stateSha=current?.sha||'';
    result.filmCount=Array.isArray(current?.data?.films)?current.data.films.length:0;
    result.updatedAt=current?.data?.updatedAt||null;
  }catch(error){
    result.githubError=error?.message||String(error);
  }
  return json(result,200,corsHeaders);
}

async function validPin(request,env){
  const provided=request.headers.get('X-Edit-Pin')||'';
  if(!provided||!env.EDIT_PIN)return false;
  const [a,b]=await Promise.all([digest(provided),digest(env.EDIT_PIN)]);
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}

function githubHeaders(env,accept='application/vnd.github+json'){
  const headers={Accept:accept,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'NOTFLICKS-Shared-Worker'};
  if(env.GITHUB_TOKEN)headers.Authorization=`Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}
function contentsUrl(env){
  const path=String(env.STATE_PATH||'films.json').split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${path}`;
}
async function fetchCurrent(env){
  const res=await fetch(`${contentsUrl(env)}?ref=${encodeURIComponent(env.GITHUB_BRANCH||'main')}`,{headers:githubHeaders(env)});
  if(res.status===404)return null;
  if(!res.ok)throw new Error(`GitHub read failed (${res.status}).`);
  const payload=await res.json();
  const text=base64ToUtf8(payload.content||'');
  let data;
  try{data=JSON.parse(text)}catch{throw new Error('Shared films.json is not valid JSON.')}
  return{sha:payload.sha||'',data};
}
async function getState(env,corsHeaders){
  const current=await fetchCurrent(env);
  if(!current)return json({data:{schema:2,updatedAt:null,films:[]},sha:''},200,corsHeaders);
  return json(current,200,corsHeaders);
}
async function putState(request,env,corsHeaders){
  const raw=await request.text();
  if(raw.length>2_000_000)return json({error:'Shared library payload is too large.'},413,corsHeaders);
  let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON.'},400,corsHeaders)}
  const data=body?.data;
  if(!data||!Array.isArray(data.films))return json({error:'Invalid NOTFLICKS library.'},400,corsHeaders);
  const current=await fetchCurrent(env);
  const currentSha=current?.sha||'';
  const baseSha=String(body.baseSha||'');
  if(currentSha&&baseSha!==currentSha)return json({error:'Shared library changed on another device.',latestSha:currentSha},409,corsHeaders);

  const payload={
    message:`Save NOTFLICKS shared library (${data.films.length} films)`,
    content:utf8ToBase64(JSON.stringify(data,null,2)),
    branch:env.GITHUB_BRANCH||'main'
  };
  if(currentSha)payload.sha=currentSha;
  const res=await fetch(contentsUrl(env),{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.status===409)return json({error:'Shared library changed while saving.'},409,corsHeaders);
  if(!res.ok){const text=await res.text();console.error('GitHub write',res.status,text);throw new Error(`GitHub write failed (${res.status}).`)}
  const result=await res.json();
  return json({ok:true,sha:result?.content?.sha||''},200,corsHeaders);
}

function utf8ToBase64(text){
  const bytes=new TextEncoder().encode(text);let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
function base64ToUtf8(base64){
  const binary=atob(String(base64).replace(/\s/g,''));const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...extra}})}
