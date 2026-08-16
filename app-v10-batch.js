/* v12: robust batch entry; supports real new lines, literal \n, literal /n, and semicolons. No-year titles default to the most popular film version. */
function parseBatchFilmInput(raw){
  const normalised=String(raw||'')
    .replace(/\r/g,'')
    .replace(/(?:\\n|\/n)/gi,'\n');
  let parts=normalised.split('\n');
  // Also allow a quick semicolon-separated paste when there are no line breaks.
  if(parts.length===1&&parts[0].includes(';'))parts=parts[0].split(';');
  const seen=new Set();
  const items=[];
  for(let line of parts){
    line=line
      .replace(/^\s*(?:[-*•▪◦]+\s*)+/,'')
      .replace(/^\s*\d+[.)]\s*/, '')
      .trim();
    if(!line)continue;
    const item=parseLine(line);
    if(!item.title)continue;
    const key=`${cleanTitle(item.title)}|${item.year||''}`;
    if(seen.has(key))continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

async function resolveFilms(){
  const items=parseBatchFilmInput(titleInput.value);
  if(!items.length){resolveStatus.textContent='Paste one or more film titles first.';return}
  $('resolveButton').disabled=true;
  $('refreshAllButton').disabled=true;
  let posters=0,banners=0,popularityChosen=0;
  for(let i=0;i<items.length;i++){
    const item=items[i];
    resolveStatus.textContent=item.year
      ? `Adding ${i+1} of ${items.length}: ${item.title} (${item.year})…`
      : `Adding ${i+1} of ${items.length}: ${item.title} · finding most popular version…`;
    try{
      const result=await locateArtwork(item);
      const film=normaliseFilm(result.film);
      films.push(film);
      if(result.posterFound)posters++;
      if(result.bannerFound)banners++;
      if(!item.year&&film.wikipediaTitle)popularityChosen++;
    }catch(error){
      console.warn('Batch artwork lookup failed',item.title,error);
      films.push(normaliseFilm({id:uid(),title:item.title,year:item.year,poster:'',backdrop:'',overview:'',categories:['Drama']}));
    }
    save();
  }
  titleInput.value='';
  resolveStatus.textContent=`Added ${items.length} film${items.length===1?'':'s'} · ${popularityChosen} automatically matched to the most popular version · ${posters} posters · ${banners} banners.`;
  $('resolveButton').disabled=false;
  $('refreshAllButton').disabled=false;
}
