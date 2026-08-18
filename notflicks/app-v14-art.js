/* v14: strict film-version matching + lower-request artwork lookup */
const v14Sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function v14FetchJson(url,options={},attempt=0){
  const maxAttempts=4;
  try{
    const res=await fetch(url,{...options,cache:'no-store'});
    if(res.ok)return res.json();
    if((res.status===429||res.status>=500)&&attempt<maxAttempts-1){
      const retryAfter=Number(res.headers.get('Retry-After'))||0;
      const wait=Math.max(retryAfter*1000,700*Math.pow(2,attempt))+Math.floor(Math.random()*300);
      await v14Sleep(wait);
      return v14FetchJson(url,options,attempt+1);
    }
    throw new Error(`Wikipedia request failed (${res.status})`);
  }catch(error){
    if(attempt<maxAttempts-1&&(error instanceof TypeError||/network|fetch|failed/i.test(String(error?.message||error)))){
      await v14Sleep(700*Math.pow(2,attempt)+Math.floor(Math.random()*300));
      return v14FetchJson(url,options,attempt+1);
    }
    throw error;
  }
}

function v14PageviewTotal(page){
  const values=Object.values(page?.pageviews||{});
  return values.reduce((sum,n)=>sum+(Number(n)||0),0);
}

function v14TitleLooksLikeFilmVersion(pageTitle,wantedTitle){
  const pageRaw=String(pageTitle||'').trim();
  const wantedRaw=String(wantedTitle||'').trim();
  const page=cleanTitle(pageRaw),wanted=cleanTitle(wantedRaw);
  if(!page||!wanted)return false;
  if(page===wanted)return true;
  if(!page.startsWith(`${wanted} `))return false;
  const suffix=pageRaw.slice(wantedRaw.length).trim();
  return /^\([^)]*\bfilm\b[^)]*\)$/i.test(suffix);
}

function v14FilmCategoryEvidence(page){
  return (page.categories||[]).some(cat=>{
    const t=String(cat.title||'').replace(/^Category:/i,'');
    if(!/\bfilms\b/i.test(t))return false;
    return !/actors|actresses|people|births|deaths|filmographies|awards|critics|producers|directors|screenwriters|cinematographers/i.test(t);
  });
}

function v14LeadSaysFilm(page){
  const lead=String(page.extract||'').slice(0,420);
  return /\b(?:is|was)\s+(?:an?|the)\s+[^.]{0,220}\b(?:film|movie)\b/i.test(lead);
}

function v14IsActualFilmPage(page,item){
  if(!v14TitleLooksLikeFilmVersion(page.title,item.title))return false;
  if(/\b(disambiguation|soundtrack|novel|song|album|television series|tv series)\b/i.test(String(page.title||'')))return false;
  return v14LeadSaysFilm(page)||v14FilmCategoryEvidence(page);
}

async function v14SearchFilmCandidates(item){
  const url=new URL('https://en.wikipedia.org/w/api.php');
  const query=[item.title,item.year,'film'].filter(Boolean).join(' ');
  const params={
    action:'query',generator:'search',gsrsearch:query,gsrnamespace:'0',gsrlimit:'12',
    prop:'extracts|images|pageimages|categories|pageviews',imlimit:'max',cllimit:'max',
    piprop:'thumbnail|original',pithumbsize:'1200',pvipdays:'30',
    exintro:'1',explaintext:'1',exsentences:'5',format:'json',formatversion:'2',origin:'*'
  };
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const data=await v14FetchJson(url);
  return (data.query?.pages||[]).filter(page=>v14IsActualFilmPage(page,item)).map(page=>({
    ...page,
    versionYear:extractVersionYear(page),
    pageviews:v14PageviewTotal(page),
    baseScore:articleScore(page,item)
  }));
}

async function searchFilmVersions(item){
  let pages=await v14SearchFilmCandidates(item);
  if(!pages.length&&item.year){
    pages=await v14SearchFilmCandidates({title:item.title,year:''});
  }
  pages.sort((a,b)=>{
    if(item.year){
      const ay=String(a.versionYear||'')===String(item.year)?1:0;
      const by=String(b.versionYear||'')===String(item.year)?1:0;
      if(ay!==by)return by-ay;
    }
    const views=(b.pageviews||0)-(a.pageviews||0);
    if(views)return views;
    return (b.baseScore||0)-(a.baseScore||0);
  });
  return pages;
}

async function fetchArticleByTitle(title){
  const url=new URL('https://en.wikipedia.org/w/api.php');
  const params={
    action:'query',titles:title,prop:'extracts|images|pageimages|categories|pageviews',
    imlimit:'max',cllimit:'max',piprop:'thumbnail|original',pithumbsize:'1200',pvipdays:'30',
    exintro:'1',explaintext:'1',exsentences:'5',format:'json',formatversion:'2',origin:'*'
  };
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const data=await v14FetchJson(url);
  const page=(data.query?.pages||[])[0]||null;
  if(page)page.pageviews=v14PageviewTotal(page);
  return page;
}

async function identifyFilmArticle(item,forcedTitle=''){
  if(forcedTitle)return fetchArticleByTitle(forcedTitle);
  const versions=await searchFilmVersions(item);
  return versions[0]||null;
}

async function imageInfoFromTitles(titles,source='article'){
  const usable=[...new Set(titles.filter(Boolean))].filter(t=>/^File:/i.test(t)).slice(0,40);
  if(!usable.length)return[];
  const out=[];
  for(let i=0;i<usable.length;i+=20){
    const url=new URL('https://en.wikipedia.org/w/api.php');
    const params={action:'query',titles:usable.slice(i,i+20).join('|'),prop:'imageinfo',iiprop:'url|size|mime',iiurlwidth:'1600',format:'json',formatversion:'2',origin:'*'};
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    const data=await v14FetchJson(url);
    for(const page of data.query?.pages||[]){
      const ii=page.imageinfo?.[0];
      if(!ii?.url||!ii.width||!ii.height)continue;
      out.push({title:page.title||'',url:ii.thumburl||ii.url,original:ii.url,width:ii.width,height:ii.height,mime:ii.mime||'',source});
    }
  }
  return out;
}

async function commonsSearch(query,source='commons'){
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  const params={action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'20',prop:'imageinfo',iiprop:'url|size|mime',iiurlwidth:'1600',format:'json',formatversion:'2',origin:'*'};
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  try{
    const data=await v14FetchJson(url);
    return (data.query?.pages||[]).map(page=>{
      const ii=page.imageinfo?.[0];
      return ii?.url&&ii.width&&ii.height?{title:page.title||'',url:ii.thumburl||ii.url,original:ii.url,width:ii.width,height:ii.height,mime:ii.mime||'',source}:null;
    }).filter(Boolean);
  }catch(error){
    console.warn('Commons artwork search failed',query,error);
    return [];
  }
}

async function locateArtwork(item,existing=null,forcedTitle=''){
  const article=await identifyFilmArticle(item,forcedTitle);
  if(!article){
    return{film:{...(existing||{}),id:existing?.id||uid(),title:item.title,year:item.year||existing?.year||'',poster:existing?.poster||'',backdrop:existing?.backdrop||'',overview:existing?.overview||'',categories:existing?.categories||['Drama'],wikipediaTitle:''},posterFound:false,bannerFound:false,noMatch:true};
  }

  const overview=article.extract||existing?.overview||'';
  const articleYear=extractVersionYear(article);
  const year=item.year||articleYear||existing?.year||inferredYear(overview);
  const articleImages=await imageInfoFromTitles((article.images||[]).map(x=>x.title),'article');
  const lead=[];
  if(article.thumbnail?.source&&article.thumbnail.width&&article.thumbnail.height){
    lead.push({title:`${article.title} lead image`,url:article.thumbnail.source,original:article.original?.source||article.thumbnail.source,width:article.thumbnail.width,height:article.thumbnail.height,mime:'',source:'lead'});
  }

  let poster=chooseBest(dedupeCandidates([...lead,...articleImages]),c=>posterScore(c,{...item,year}),8);
  if(!poster){
    const extra=await commonsSearch(`${item.title}${year?` ${year}`:''} film poster`,'commons-poster');
    poster=chooseBest(extra,c=>posterScore(c,{...item,year}),8);
  }
  const posterUrl=poster?.url||existing?.poster||'';

  let banner=chooseBest(dedupeCandidates(articleImages),c=>bannerScore(c,{...item,year},posterUrl),12);
  if(!banner){
    const extra=await commonsSearch(`${item.title}${year?` ${year}`:''} film still`,'commons-still');
    banner=chooseBest(extra,c=>bannerScore(c,{...item,year},posterUrl),12);
  }
  const bannerUrl=banner?.url||(existing?.backdrop&&existing.backdrop!==posterUrl?existing.backdrop:'');

  return{film:{...(existing||{}),id:existing?.id||uid(),source:'wikipedia',wikipediaTitle:article.title||'',versionPageviews:Number(article.pageviews)||v14PageviewTotal(article),title:item.title,year,poster:posterUrl,backdrop:bannerUrl,overview,categories:existing?.categories?.length?existing.categories:inferCategories(overview)},posterFound:!!poster,bannerFound:!!banner,noMatch:false};
}

async function refindOne(index){
  const film=films[index];if(!film)return;
  resolveStatus.textContent=`Refinding poster + banner: ${film.title}`;
  try{
    const forced=film.wikipediaTitle&&v14TitleLooksLikeFilmVersion(film.wikipediaTitle,film.title)?film.wikipediaTitle:'';
    const result=await locateArtwork({title:film.title,year:film.year},film,forced);
    films[index]=normaliseFilm(result.film);save();
    resolveStatus.textContent=result.noMatch?`${film.title}: no valid film article matched. Use VERSIONS or EDIT.`:`${film.title}: poster ${result.posterFound?'found':'kept/missing'} · banner ${result.bannerFound?'found':'kept/missing'}.`;
  }catch(error){resolveStatus.textContent=`Could not refind artwork for ${film.title}.`;console.warn(error)}
}

async function refreshAllArtwork(){
  if(!films.length)return;
  $('refreshAllButton').disabled=true;$('resolveButton').disabled=true;
  let posters=0,banners=0,unmatched=0;
  for(let i=0;i<films.length;i++){
    resolveStatus.textContent=`Refreshing artwork ${i+1} of ${films.length}: ${films[i].title}`;
    try{
      const forced=films[i].wikipediaTitle&&v14TitleLooksLikeFilmVersion(films[i].wikipediaTitle,films[i].title)?films[i].wikipediaTitle:'';
      const result=await locateArtwork({title:films[i].title,year:films[i].year},films[i],forced);
      films[i]=normaliseFilm(result.film);if(result.posterFound)posters++;if(result.bannerFound)banners++;if(result.noMatch)unmatched++;save();
    }catch(error){console.warn('Refresh failed',films[i]?.title,error)}
    if(i%10===9)await v14Sleep(650);else await v14Sleep(120);
  }
  resolveStatus.textContent=`Artwork refresh complete · ${posters} posters · ${banners} banners · ${unmatched} unmatched.`;
  $('refreshAllButton').disabled=false;$('resolveButton').disabled=false;
}

async function openVersionsDialog(index){
  const film=films[index];if(!film)return;versionDialogFilmIndex=index;
  $('versionDialogTitle').textContent=`Choose version — ${film.title}`;
  $('versionStatus').textContent='Finding actual film versions and comparing popularity…';$('versionOptions').innerHTML='';$('versionDialog').showModal();
  try{
    const options=await searchFilmVersions({title:film.title,year:''});
    if(!options.length){$('versionStatus').textContent='No alternative film versions were found.';return}
    $('versionStatus').textContent='Only matching film articles are shown. Most viewed version is listed first.';
    $('versionOptions').innerHTML=options.map((page,i)=>`<button type="button" class="version-option ${page.title===film.wikipediaTitle?'current':''}" data-wiki-title="${escapeHtml(page.title)}"><span class="version-rank">${i===0?'MOST POPULAR':''}</span><strong>${escapeHtml(page.title)}</strong><small>${page.versionYear?escapeHtml(page.versionYear)+' · ':''}${Number(page.pageviews||0).toLocaleString()} Wikipedia views / last 30 days${page.title===film.wikipediaTitle?' · CURRENT':''}</small></button>`).join('');
  }catch(error){console.warn(error);$('versionStatus').textContent='Could not load alternative versions.'}
}
