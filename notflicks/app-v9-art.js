function filmPageLooksValid(page,item){
  const title=cleanTitle(page.title||''),extract=cleanTitle(page.extract||''),wanted=cleanTitle(item.title||'');
  if(!title.includes(wanted)&&!extract.includes(wanted))return false;
  return title.includes('film')||extract.includes(' film')||extract.includes(' movie');
}
function extractVersionYear(page){
  const titleYear=(page.title||'').match(/\((18|19|20)\d{2}\s+film\)/i)?.[0]?.match(/\d{4}/)?.[0];
  return titleYear||inferredYear(page.extract||'')||'';
}
function ymd(date){return date.toISOString().slice(0,10).replaceAll('-','')}
async function pageViewsFor(title){
  try{
    const end=new Date();end.setUTCDate(end.getUTCDate()-1);
    const start=new Date(end);start.setUTCDate(start.getUTCDate()-29);
    const article=encodeURIComponent(String(title).replaceAll(' ','_'));
    const url=`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/all-agents/${article}/daily/${ymd(start)}/${ymd(end)}`;
    const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)return 0;
    const data=await res.json();return(data.items||[]).reduce((sum,item)=>sum+(Number(item.views)||0),0);
  }catch{return 0}
}
async function searchFilmVersions(item){
  const url=new URL('https://en.wikipedia.org/w/api.php');
  const params={action:'query',generator:'search',gsrsearch:`${item.title} film`,gsrnamespace:'0',gsrlimit:'12',prop:'extracts|images|pageimages',imlimit:'max',piprop:'thumbnail|original',pithumbsize:'1200',exintro:'1',explaintext:'1',exsentences:'5',format:'json',formatversion:'2',origin:'*'};
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res=await fetch(url);if(!res.ok)throw new Error(`Wikipedia ${res.status}`);const data=await res.json();
  let pages=(data.query?.pages||[]).filter(page=>filmPageLooksValid(page,item));
  pages=pages.map(page=>({...page,versionYear:extractVersionYear(page),baseScore:articleScore(page,item)})).sort((a,b)=>b.baseScore-a.baseScore).slice(0,7);
  await Promise.all(pages.map(async page=>{page.pageviews=await pageViewsFor(page.title)}));
  pages.sort((a,b)=>{
    if(item.year){const ay=pageYearMatch(a,item.year),by=pageYearMatch(b,item.year);if(ay!==by)return by-ay}
    const viewDelta=(b.pageviews||0)-(a.pageviews||0);if(viewDelta)return viewDelta;
    return b.baseScore-a.baseScore;
  });
  return pages;
}
function pageYearMatch(page,year){return String(page.versionYear||'')===String(year)?1:0}
async function fetchArticleByTitle(title){
  const url=new URL('https://en.wikipedia.org/w/api.php');
  const params={action:'query',titles:title,prop:'extracts|images|pageimages',imlimit:'max',piprop:'thumbnail|original',pithumbsize:'1200',exintro:'1',explaintext:'1',exsentences:'5',format:'json',formatversion:'2',origin:'*'};
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));const res=await fetch(url);if(!res.ok)throw new Error(`Wikipedia ${res.status}`);const data=await res.json();return(data.query?.pages||[])[0]||null;
}
async function identifyFilmArticle(item,forcedTitle=''){
  if(forcedTitle)return fetchArticleByTitle(forcedTitle);
  const versions=await searchFilmVersions(item);return versions[0]||null;
}
async function imageInfoFromTitles(titles,source='article'){
  const usable=[...new Set(titles.filter(Boolean))].filter(t=>/^File:/i.test(t)).slice(0,45);if(!usable.length)return[];
  const batches=[];for(let i=0;i<usable.length;i+=20)batches.push(usable.slice(i,i+20));const out=[];
  for(const batch of batches){const url=new URL('https://en.wikipedia.org/w/api.php');const params={action:'query',titles:batch.join('|'),prop:'imageinfo',iiprop:'url|size|mime',iiurlwidth:'1600',format:'json',formatversion:'2',origin:'*'};Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));try{const res=await fetch(url);if(!res.ok)continue;const data=await res.json();for(const page of data.query?.pages||[]){const ii=page.imageinfo?.[0];if(!ii?.url||!ii.width||!ii.height)continue;out.push({title:page.title||'',url:ii.thumburl||ii.url,original:ii.url,width:ii.width,height:ii.height,mime:ii.mime||'',source})}}catch{}}
  return out;
}
async function commonsSearch(query,source='commons'){
  const url=new URL('https://commons.wikimedia.org/w/api.php');const params={action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'24',prop:'imageinfo',iiprop:'url|size|mime',iiurlwidth:'1600',format:'json',formatversion:'2',origin:'*'};Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));try{const res=await fetch(url);if(!res.ok)return[];const data=await res.json();return(data.query?.pages||[]).map(page=>{const ii=page.imageinfo?.[0];return ii?.url&&ii.width&&ii.height?{title:page.title||'',url:ii.thumburl||ii.url,original:ii.url,width:ii.width,height:ii.height,mime:ii.mime||'',source}:null}).filter(Boolean)}catch{return[]}
}
function badArtwork(candidate){const n=filenameWords(candidate.title);return /\b(icon|logo|wordmark|symbol|flag|map|diagram|chart|svg|commons|wikidata|question mark|star icon|award|seal|signature|autograph|ticket|poster mockup)\b/.test(n)||candidate.mime==='image/svg+xml'}
function titleRelevance(candidate,item){const words=cleanTitle(item.title).split(' ').filter(w=>w.length>2),name=filenameWords(candidate.title);return words.reduce((n,w)=>n+(name.includes(w)?4:0),0)+(item.year&&name.includes(item.year)?6:0)}
function posterScore(c,item){if(badArtwork(c))return-999;const ratio=c.width/c.height,target=2/3;let score=Math.max(-45,45-Math.abs(Math.log(ratio/target))*58);if(ratio<.9)score+=18;if(ratio>.95)score-=35;if(c.height>=700)score+=8;if(c.source==='lead')score+=34;if(c.source==='article')score+=18;score+=titleRelevance(c,item);const n=filenameWords(c.title);if(/\b(poster|cover|dvd|theatrical|one sheet|key art)\b/.test(n))score+=48;if(/\b(still|scene|premiere|cast|actor|actress)\b/.test(n))score-=20;return score}
function bannerScore(c,item,posterUrl){if(badArtwork(c)||c.url===posterUrl)return-999;const ratio=c.width/c.height,target=16/9;let score=Math.max(-50,48-Math.abs(Math.log(ratio/target))*52);if(ratio>=1.35)score+=28;else score-=50;if(ratio>=1.55&&ratio<=2.4)score+=18;if(c.width>=900)score+=12;if(c.source==='article')score+=24;if(c.source==='commons-still')score+=20;score+=titleRelevance(c,item);const n=filenameWords(c.title);if(/\b(still|scene|set|production|cast|film|movie|premiere)\b/.test(n))score+=18;if(/\b(poster|cover|dvd|one sheet)\b/.test(n))score-=45;return score}
function chooseBest(candidates,scorer,minScore=0){const ranked=candidates.map(c=>({c,score:scorer(c)})).sort((a,b)=>b.score-a.score);return ranked[0]&&ranked[0].score>=minScore?ranked[0].c:null}
function dedupeCandidates(items){const seen=new Set();return items.filter(c=>{const k=c?.original||c?.url;if(!k||seen.has(k))return false;seen.add(k);return true})}
async function locateArtwork(item,existing=null,forcedTitle=''){
  const article=await identifyFilmArticle(item,forcedTitle);if(!article)return{film:{...(existing||{}),id:existing?.id||uid(),title:item.title,year:item.year||'',poster:existing?.poster||'',backdrop:existing?.backdrop||'',overview:existing?.overview||'',categories:existing?.categories||['Drama']},posterFound:false,bannerFound:false};
  const overview=article.extract||existing?.overview||'',articleYear=extractVersionYear(article),year=item.year||articleYear||existing?.year||inferredYear(overview),articleImageTitles=(article.images||[]).map(x=>x.title),articleImages=await imageInfoFromTitles(articleImageTitles,'article');
  const lead=[];if(article.thumbnail?.source&&article.thumbnail.width&&article.thumbnail.height)lead.push({title:`${article.title} lead image`,url:article.thumbnail.source,original:article.original?.source||article.thumbnail.source,width:article.thumbnail.width,height:article.thumbnail.height,mime:'',source:'lead'});
  const commonsPoster=await commonsSearch(`${item.title}${year?` ${year}`:''} film poster`,'commons-poster'),allPosterCandidates=dedupeCandidates([...lead,...articleImages,...commonsPoster]),poster=chooseBest(allPosterCandidates,c=>posterScore(c,{...item,year}),8),posterUrl=poster?.url||existing?.poster||'';
  const commonsWideA=await commonsSearch(`${item.title}${year?` ${year}`:''} film still`,'commons-still'),commonsWideB=await commonsSearch(`${item.title}${year?` ${year}`:''} film`,'commons'),allBannerCandidates=dedupeCandidates([...articleImages,...commonsWideA,...commonsWideB,...lead]),banner=chooseBest(allBannerCandidates,c=>bannerScore(c,{...item,year},posterUrl),12),bannerUrl=banner?.url||(existing?.backdrop&&existing.backdrop!==posterUrl?existing.backdrop:'');
  const views=article.pageviews??await pageViewsFor(article.title||'');
  return{film:{...(existing||{}),id:existing?.id||uid(),source:'wikipedia',wikipediaTitle:article.title||'',versionPageviews:views,title:item.title,year,poster:posterUrl,backdrop:bannerUrl,overview,categories:existing?.categories?.length?existing.categories:inferCategories(overview)},posterFound:!!poster,bannerFound:!!banner};
}
async function resolveFilms(){const items=titleInput.value.split(/\r?\n/).map(parseLine).filter(x=>x.title);if(!items.length){resolveStatus.textContent='Enter at least one film title.';return}$('resolveButton').disabled=true;$('refreshAllButton').disabled=true;let posters=0,banners=0;for(let i=0;i<items.length;i++){const item=items[i];resolveStatus.textContent=`Locating artwork ${i+1} of ${items.length}: ${item.title}`;try{const result=await locateArtwork(item);films.push(normaliseFilm(result.film));if(result.posterFound)posters++;if(result.bannerFound)banners++}catch(error){console.warn('Artwork lookup failed',item.title,error);films.push(normaliseFilm({id:uid(),title:item.title,year:item.year,poster:'',backdrop:'',overview:'',categories:['Drama']}))}}titleInput.value='';save();resolveStatus.textContent=`Added ${items.length} film${items.length===1?'':'s'} · ${posters} portrait poster${posters===1?'':'s'} · ${banners} wide banner${banners===1?'':'s'} found.`;$('resolveButton').disabled=false;$('refreshAllButton').disabled=false}
async function refindOne(index){const film=films[index];if(!film)return;resolveStatus.textContent=`Refinding poster + banner: ${film.title}`;try{const result=await locateArtwork({title:film.title,year:film.year},film,film.wikipediaTitle||'');films[index]=normaliseFilm(result.film);save();resolveStatus.textContent=`${film.title}: poster ${result.posterFound?'found':'kept/missing'} · banner ${result.bannerFound?'found':'kept/missing'}.`}catch(error){resolveStatus.textContent=`Could not refind artwork for ${film.title}.`;console.warn(error)}}
async function refreshAllArtwork(){if(!films.length)return;$('refreshAllButton').disabled=true;$('resolveButton').disabled=true;let banners=0,posters=0;for(let i=0;i<films.length;i++){resolveStatus.textContent=`Refreshing artwork ${i+1} of ${films.length}: ${films[i].title}`;try{const result=await locateArtwork({title:films[i].title,year:films[i].year},films[i],films[i].wikipediaTitle||'');films[i]=normaliseFilm(result.film);if(result.posterFound)posters++;if(result.bannerFound)banners++;save()}catch{}}resolveStatus.textContent=`Artwork refresh complete · ${posters} posters · ${banners} banners located.`;$('refreshAllButton').disabled=false;$('resolveButton').disabled=false}
async function openVersionsDialog(index){
  const film=films[index];if(!film)return;versionDialogFilmIndex=index;$('versionDialogTitle').textContent=`Choose version — ${film.title}`;$('versionStatus').textContent='Finding film versions and comparing popularity…';$('versionOptions').innerHTML='';$('versionDialog').showModal();
  try{const options=await searchFilmVersions({title:film.title,year:''});if(!options.length){$('versionStatus').textContent='No alternative film versions were found.';return}$('versionStatus').textContent='Most viewed version is listed first. Select any version to override it.';$('versionOptions').innerHTML=options.map((page,i)=>`<button type="button" class="version-option ${page.title===film.wikipediaTitle?'current':''}" data-wiki-title="${escapeHtml(page.title)}"><span class="version-rank">${i===0?'MOST POPULAR':''}</span><strong>${escapeHtml(page.title)}</strong><small>${page.versionYear?escapeHtml(page.versionYear)+' · ':''}${Number(page.pageviews||0).toLocaleString()} Wikipedia views / last 30 days${page.title===film.wikipediaTitle?' · CURRENT':''}</small></button>`).join('')}catch(error){console.warn(error);$('versionStatus').textContent='Could not load alternative versions.'}
}
let versionDialogFilmIndex=-1;
async function chooseVersion(wikiTitle){
  const index=versionDialogFilmIndex,film=films[index];if(!film)return;$('versionStatus').textContent=`Switching to ${wikiTitle}…`;try{const article=await fetchArticleByTitle(wikiTitle),year=extractVersionYear(article)||'';const result=await locateArtwork({title:film.title,year},film,wikiTitle);films[index]=normaliseFilm({...result.film,year:year||result.film.year});save();$('versionDialog').close();resolveStatus.textContent=`${film.title} switched to ${wikiTitle}.`}catch(error){console.warn(error);$('versionStatus').textContent='Could not switch version.'}
}
