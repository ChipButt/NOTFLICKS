/* v14: resilient large-batch imports */
async function v14ResolveOneWithRetry(item,maxAttempts=3){
  let lastError=null;
  for(let attempt=0;attempt<maxAttempts;attempt++){
    try{return await locateArtwork(item)}catch(error){
      lastError=error;
      if(attempt<maxAttempts-1)await v14Sleep(900*Math.pow(2,attempt)+Math.floor(Math.random()*350));
    }
  }
  throw lastError||new Error('Artwork lookup failed');
}

async function resolveFilms(){
  const items=parseBatchFilmInput(titleInput.value);
  if(!items.length){resolveStatus.textContent='Paste one or more film titles first.';return}

  $('resolveButton').disabled=true;$('refreshAllButton').disabled=true;
  let posters=0,banners=0,popularityChosen=0,unmatched=0;
  const failed=[];

  for(let i=0;i<items.length;i++){
    const item=items[i];
    resolveStatus.textContent=item.year
      ? `Adding ${i+1} of ${items.length}: ${item.title} (${item.year})…`
      : `Adding ${i+1} of ${items.length}: ${item.title} · choosing most popular film version…`;
    try{
      const result=await v14ResolveOneWithRetry(item,3);
      films.push(normaliseFilm(result.film));
      if(result.posterFound)posters++;
      if(result.bannerFound)banners++;
      if(result.noMatch)unmatched++;
      else if(!item.year&&result.film.wikipediaTitle)popularityChosen++;
      save();
    }catch(error){
      console.warn('Batch lookup deferred',item.title,error);
      failed.push(item);
    }

    // Avoid hammering Wikimedia during very long production lists.
    if(i%10===9)await v14Sleep(750);else await v14Sleep(140);
  }

  // One cooled-down second pass for transient network/rate-limit failures.
  if(failed.length){
    resolveStatus.textContent=`First pass complete. Retrying ${failed.length} temporary failure${failed.length===1?'':'s'}…`;
    await v14Sleep(2200);
    for(let i=0;i<failed.length;i++){
      const item=failed[i];
      resolveStatus.textContent=`Retrying ${i+1} of ${failed.length}: ${item.title}…`;
      try{
        const result=await v14ResolveOneWithRetry(item,3);
        films.push(normaliseFilm(result.film));
        if(result.posterFound)posters++;
        if(result.bannerFound)banners++;
        if(result.noMatch)unmatched++;
        else if(!item.year&&result.film.wikipediaTitle)popularityChosen++;
        save();
      }catch(error){
        console.warn('Batch lookup ultimately failed',item.title,error);
        films.push(normaliseFilm({id:uid(),title:item.title,year:item.year||'',poster:'',backdrop:'',overview:'',categories:['Drama'],lookupFailed:true}));
        unmatched++;save();
      }
      await v14Sleep(300);
    }
  }

  titleInput.value='';
  resolveStatus.textContent=`Added ${items.length} film${items.length===1?'':'s'} · ${popularityChosen} matched to the most popular actual film version · ${posters} posters · ${banners} banners · ${unmatched} needing review.`;
  $('resolveButton').disabled=false;$('refreshAllButton').disabled=false;
}
