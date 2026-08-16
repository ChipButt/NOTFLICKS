async function identifyFilmArticle(item){
  const url=new URL('https://en.wikipedia.org/w/api.php');
  const search=`${item.title}${item.year?` ${item.year}`:''} film`;
  const params={action:'query',generator:'search',gsrsearch:search,gsrnamespace:'0',gsrlimit:'7',prop:'extracts|images|pageimages',imlimit:'max',piprop:'thumbnail|original',pithumbsize:'1200',exintro:'1',explaintext:'1',exsentences:'5',format:'json',formatversion:'2',origin:'*'};
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res=await fetch(url);if(!res.ok)throw new Error(`Wikipedia ${res.status}`);const data=await res.json();const pages=data.query?.pages||[];if(!pages.length)return null;
  return pages.map(page=>({page,score:articleScore(page,item)})).sort((a,b)=>b.score-a.score)[0]?.page||null;
}

async function imageInfoFromTitles(titles,source='article'){
  const usable=[...new Set(titles.filter(Boolean))].filter(t=>/^File:/i.test(t)).slice(0,45);if(!usable.length)return[];
  const batches=[];for(let i=0;i<usable.length;i+=20)batches.push(usable.slice(i,i+20));
  const out=[];
  for(const batch of batches){
    const url=new URL('https://en.wikipedia.org/w/api.php');
    const params={action:'query',titles:batch.join('|'),prop:'imageinfo',iiprop:'url|size|mime',iiurlwidth:'1600',format:'json',formatversion:'2',origin:'*'};
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    try{const res=await fetch(url);if(!res.ok)continue;const data=await res.json();for(const page of data.query?.pages||[]){const ii=page.imageinfo?.[0];if(!ii?.url||!ii.width||!ii.height)continue;out.push({title:page.title||'',url:ii.thumburl||ii.url,original:ii.url,width:ii.width,height:ii.height,mime:ii.mime||'',source})}}catch{}
  }
  return out;
}

async function commonsSearch(query,source='commons'){
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  const params={action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'24',prop:'imageinfo',iiprop:'url|size|mime',iiurlwidth:'1600',format:'json',formatversion:'2',origin:'*'};
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  try{const res=await fetch(url);if(!res.ok)return[];const data=await res.json();return(data.query?.pages||[]).map(page=>{const ii=page.imageinfo?.[0];return ii?.url&&ii.width&&ii.height?{title:page.title||'',url:ii.thumburl||ii.url,original:ii.url,width:ii.width,height:ii.height,mime:ii.mime||'',source}:null}).filter(Boolean)}catch{return[]}
}

function badArtwork(candidate){const n=filenameWords(candidate.title);return /\b(icon|logo|wordmark|symbol|flag|map|diagram|chart|svg|commons|wikidata|question mark|star icon|award|seal|signature|autograph|ticket|poster mockup)\b/.test(n)||candidate.mime==='image/svg+xml'}
function titleRelevance(candidate,item){const words=cleanTitle(item.title).split(' ').filter(w=>w.length>2);const name=filenameWords(candidate.title);return words.reduce((n,w)=>n+(name.includes(w)?4:0),0)+(item.year&&name.includes(item.year)?6:0)}
function posterScore(c,item){if(badArtwork(c))return-999;const ratio=c.width/c.height;const target=2/3;let score=0;score+=Math.max(-45,45-Math.abs(Math.log(ratio/target))*58);if(ratio<.9)score+=18;if(ratio>.95)score-=35;if(c.height>=700)score+=8;if(c.source==='lead')score+=34;if(c.source==='article')score+=18;score+=titleRelevance(c,item);const n=filenameWords(c.title);if(/\b(poster|cover|dvd|theatrical|one sheet|key art)\b/.test(n))score+=48;if(/\b(still|scene|premiere|cast|actor|actress)\b/.test(n))score-=20;return score}
function bannerScore(c,item,posterUrl){if(badArtwork(c)||c.url===posterUrl)return-999;const ratio=c.width/c.height;const target=16/9;let score=0;score+=Math.max(-50,48-Math.abs(Math.log(ratio/target))*52);if(ratio>=1.35)score+=28;else score-=50;if(ratio>=1.55&&ratio<=2.4)score+=18;if(c.width>=900)score+=12;if(c.source==='article')score+=24;if(c.source==='commons-still')score+=20;score+=titleRelevance(c,item);const n=filenameWords(c.title);if(/\b(still|scene|set|production|cast|film|movie|premiere)\b/.test(n))score+=18;if(/\b(poster|cover|dvd|one sheet)\b/.test(n))score-=45;return score}
function chooseBest(candidates,scorer,minScore=0){const ranked=candidates.map(c=>({c,score:scorer(c)})).sort((a,b)=>b.score-a.score);return ranked[0]&&ranked[0].score>=minScore?ranked[0].c:null}

async function locateArtwork(item,existing=null){
  const article=await identifyFilmArticle(item);if(!article)return{film:{...(existing||{}),id:existing?.id||uid(),title:item.title,year:item.year||'',poster:existing?.poster||'',backdrop:existing?.backdrop||'',overview:existing?.overview||'',categories:existing?.categories||['Drama']},posterFound:false,bannerFound:false};
  const overview=article.extract||existing?.overview||'';const year=item.year||existing?.year||inferredYear(overview);const articleImageTitles=(article.images||[]).map(x=>x.title);
  const articleImages=await imageInfoFromTitles(articleImageTitles,'article');
  const lead=[];if(article.thumbnail?.source&&article.thumbnail.width&&article.thumbnail.height)lead.push({title:`${article.title} lead image`,url:article.thumbnail.source,original:article.original?.source||article.thumbnail.source,width:article.thumbnail.width,height:article.thumbnail.height,mime:'',source:'lead'});
  const commonsPoster=await commonsSearch(`${item.title}${year?` ${year}`:''} film poster`,'commons-poster');
  const allPosterCandidates=dedupeCandidates([...lead,...articleImages,...commonsPoster]);
  const poster=chooseBest(allPosterCandidates,c=>posterScore(c,{...item,year}),8);
  const posterUrl=poster?.url||existing?.poster||'';
  const commonsWideA=await commonsSearch(`${item.title}${year?` ${year}`:''} film still`,'commons-still');
  const commonsWideB=await commonsSearch(`${item.title}${year?` ${year}`:''} film`,'commons');
  const allBannerCandidates=dedupeCandidates([...articleImages,...commonsWideA,...commonsWideB,...lead]);
  const banner=chooseBest(allBannerCandidates,c=>bannerScore(c,{...item,year},posterUrl),12);
  const bannerUrl=banner?.url||(existing?.backdrop&&existing.backdrop!==posterUrl?existing.backdrop:'');
  return{film:{...(existing||{}),id:existing?.id||uid(),source:'wikipedia',wikipediaTitle:article.title||'',title:item.title,year,poster:posterUrl,backdrop:bannerUrl,overview,categories:existing?.categories?.length?existing.categories:inferCategories(overview)},posterFound:!!poster,bannerFound:!!banner};
}
function dedupeCandidates(items){const seen=new Set();return items.filter(c=>{const k=c?.original||c?.url;if(!k||seen.has(k))return false;seen.add(k);return true})}

async function resolveFilms(){
  const items=titleInput.value.split(/\r?\n/).map(parseLine).filter(x=>x.title);if(!items.length){resolveStatus.textContent='Enter at least one film title.';return}
  $('resolveButton').disabled=true;$('refreshAllButton').disabled=true;let posters=0,banners=0;
  for(let i=0;i<items.length;i++){
    const item=items[i];resolveStatus.textContent=`Locating artwork ${i+1} of ${items.length}: ${item.title}`;
    try{const result=await locateArtwork(item);films.push(normaliseFilm(result.film));if(result.posterFound)posters++;if(result.bannerFound)banners++}catch(error){console.warn('Artwork lookup failed',item.title,error);films.push(normaliseFilm({id:uid(),title:item.title,year:item.year,poster:'',backdrop:'',overview:'',categories:['Drama']}))}
  }
  titleInput.value='';save();resolveStatus.textContent=`Added ${items.length} film${items.length===1?'':'s'} · ${posters} portrait poster${posters===1?'':'s'} · ${banners} wide banner${banners===1?'':'s'} found.`;$('resolveButton').disabled=false;$('refreshAllButton').disabled=false;
}

async function refindOne(index){const film=films[index];if(!film)return;resolveStatus.textContent=`Refinding poster + banner: ${film.title}`;try{const result=await locateArtwork({title:film.title,year:film.year},film);films[index]=normaliseFilm(result.film);save();resolveStatus.textContent=`${film.title}: poster ${result.posterFound?'found':'kept/missing'} · banner ${result.bannerFound?'found':'kept/missing'}.`}catch(error){resolveStatus.textContent=`Could not refind artwork for ${film.title}.`;console.warn(error)}}
async function refreshAllArtwork(){if(!films.length)return;$('refreshAllButton').disabled=true;$('resolveButton').disabled=true;let banners=0,posters=0;for(let i=0;i<films.length;i++){resolveStatus.textContent=`Refreshing artwork ${i+1} of ${films.length}: ${films[i].title}`;try{const result=await locateArtwork({title:films[i].title,year:films[i].year},films[i]);films[i]=normaliseFilm(result.film);if(result.posterFound)posters++;if(result.bannerFound)banners++;save()}catch{}}resolveStatus.textContent=`Artwork refresh complete · ${posters} posters · ${banners} banners located.`;$('refreshAllButton').disabled=false;$('resolveButton').disabled=false}
