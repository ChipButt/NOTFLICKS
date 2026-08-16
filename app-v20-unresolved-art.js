/* v20: explicit unresolved artwork state + black launch placeholders */
(function(){
  let unresolvedOnly=false;

  function ensureArtState(film){
    if(!film)return film;
    if(!film.poster)film.needsWebArtPoster=true;
    else if(typeof film.needsWebArtPoster!=='boolean')film.needsWebArtPoster=false;
    if(!film.backdrop)film.needsWebArtBanner=true;
    else if(typeof film.needsWebArtBanner!=='boolean')film.needsWebArtBanner=false;
    film.needsWebArt=!!(film.needsWebArtPoster||film.needsWebArtBanner||!film.poster||!film.backdrop);
    if(!film.needsWebArt)film.needsWebArtReason='';
    return film;
  }

  window.filmNeedsWebArt=function(film){
    ensureArtState(film);
    return !!film?.needsWebArt;
  };
  window.markFilmNeedsWebArt=function(film,reason='Automatic artwork needs review'){
    if(!film)return film;
    film.needsWebArt=true;
    if(!film.poster)film.needsWebArtPoster=true;
    if(!film.backdrop)film.needsWebArtBanner=true;
    film.needsWebArtReason=reason;
    return film;
  };
  window.clearFilmNeedsWebArtIfResolved=function(film){
    if(!film)return film;
    ensureArtState(film);
    if(film.poster&&film.backdrop&&!film.needsWebArtPoster&&!film.needsWebArtBanner){
      film.needsWebArt=false;
      film.needsWebArtReason='';
    }
    return film;
  };

  films.forEach(ensureArtState);

  /* Automatic lookups must explicitly say whether each artwork slot was
     actually resolved in this lookup. Existing/custom art is preserved only
     when that slot had already been manually confirmed. */
  if(typeof locateArtwork==='function'){
    const previousLocateArtwork=locateArtwork;
    locateArtwork=async function(item,existing=null,forcedTitle=''){
      const result=await previousLocateArtwork(item,existing,forcedTitle);
      const film=result?.film;
      if(!film)return result;

      const previousPosterConfirmed=!!(existing?.poster&&existing?.needsWebArtPoster===false&&existing?.source==='custom');
      const previousBannerConfirmed=!!(existing?.backdrop&&existing?.needsWebArtBanner===false&&existing?.source==='custom');

      film.needsWebArtPoster=result.posterFound?false:!previousPosterConfirmed;
      film.needsWebArtBanner=result.bannerFound?false:!previousBannerConfirmed;
      if(!film.poster)film.needsWebArtPoster=true;
      if(!film.backdrop)film.needsWebArtBanner=true;
      film.needsWebArt=!!(film.needsWebArtPoster||film.needsWebArtBanner);
      film.needsWebArtReason=film.needsWebArt
        ? (result.noMatch?'No confident film artwork match was found.':'One or more artwork slots need web art.')
        : '';
      return result;
    };
  }

  /* Any save keeps the unresolved fields coherent. It does not automatically
     trust an existing automatic image just because a URL happens to exist. */
  const previousSave=save;
  save=function(){
    films.forEach(ensureArtState);
    return previousSave();
  };

  /* USE THIS is the explicit confirmation step for a poster/banner candidate. */
  if(typeof v16ApplyArt==='function'){
    const previousApplyArt=v16ApplyArt;
    v16ApplyArt=function(kind,value,label='Custom artwork'){
      const film=films.find(f=>f.id===v16ArtFilmId);
      if(film&&value){
        if(kind==='poster')film.needsWebArtPoster=false;
        if(kind==='banner')film.needsWebArtBanner=false;
        film.needsWebArtReason='';
      }
      const result=previousApplyArt(kind,value,label);
      const updated=films.find(f=>f.id===v16ArtFilmId);
      if(updated){ensureArtState(updated);clearFilmNeedsWebArtIfResolved(updated)}
      return result;
    };
  }

  /* A manual Edit save counts as an explicit decision for every populated art
     field. Run after the older submit handler has written the values. */
  $('manualForm')?.addEventListener('submit',event=>{
    if(event.submitter?.value==='cancel')return;
    const editedId=editingId;
    const title=$('manualTitle')?.value.trim()||'';
    const year=$('manualYear')?.value.trim()||'';
    setTimeout(()=>{
      let film=editedId?films.find(f=>f.id===editedId):null;
      if(!film)film=[...films].reverse().find(f=>f.title===title&&String(f.year||'')===String(year||''));
      if(!film)return;
      film.needsWebArtPoster=!film.poster;
      film.needsWebArtBanner=!film.backdrop;
      film.needsWebArt=!!(film.needsWebArtPoster||film.needsWebArtBanner);
      film.needsWebArtReason=film.needsWebArt?'One or more artwork slots still need web art.':'';
      save();
    },0);
  },true);

  function ensureUnresolvedFilter(){
    if($('unresolvedFilterButton'))return;
    const actions=document.querySelector('.library-heading .button-row.compact');
    if(!actions)return;
    const button=document.createElement('button');
    button.id='unresolvedFilterButton';
    button.className='button secondary';
    button.type='button';
    button.textContent='Unresolved only';
    button.addEventListener('click',()=>{
      unresolvedOnly=!unresolvedOnly;
      button.classList.toggle('active',unresolvedOnly);
      decorateLibrary();
    });
    actions.prepend(button);
  }

  function chipFor(row,selector,text){
    let chip=row.querySelector(selector);
    if(!chip){
      chip=document.createElement('span');
      chip.className='art-chip needs-web-art-chip';
      chip.dataset.webArtStatus='1';
      row.querySelector('.art-status')?.appendChild(chip);
    }
    chip.textContent=text;
    return chip;
  }

  function decorateLibrary(){
    ensureUnresolvedFilter();
    let unresolvedCount=0;
    document.querySelectorAll('.film-row[data-id]').forEach(row=>{
      const film=films.find(f=>f.id===row.dataset.id);if(!film)return;
      const unresolved=filmNeedsWebArt(film);
      if(unresolved)unresolvedCount++;
      row.classList.toggle('needs-web-art-row',unresolved);
      row.hidden=!!(unresolvedOnly&&!unresolved);

      const old=row.querySelector('[data-web-art-status="1"]');
      if(unresolved){
        const parts=[];
        if(film.needsWebArtPoster||!film.poster)parts.push('POSTER');
        if(film.needsWebArtBanner||!film.backdrop)parts.push('BANNER');
        chipFor(row,'[data-web-art-status="1"]',`CHOOSE WEB ART · ${parts.join(' + ')}`);
      }else old?.remove();

      let choose=row.querySelector('button[data-action="choose-web-art"]');
      if(unresolved&&!choose){
        choose=document.createElement('button');
        choose.type='button';
        choose.dataset.action='choose-web-art';
        choose.textContent='CHOOSE WEB ART';
        const view=row.querySelector('button[data-action="view-art"]');
        const refind=row.querySelector('button[data-action="refind"]');
        (view||refind)?.insertAdjacentElement('afterend',choose);
        if(!choose.parentElement)row.querySelector('.row-actions')?.prepend(choose);
      }else if(!unresolved&&choose)choose.remove();
    });

    const filter=$('unresolvedFilterButton');
    if(filter)filter.textContent=unresolvedOnly?`Show all (${films.length})`:`Unresolved only (${unresolvedCount})`;
    if(unresolvedOnly){
      $('libraryEmpty').hidden=unresolvedCount>0;
      $('libraryEmpty').textContent='No unresolved films.';
    }else{
      $('libraryEmpty').hidden=films.length>0;
      $('libraryEmpty').textContent='No films have been added yet.';
    }
  }

  const previousRenderLibrary=renderLibrary;
  renderLibrary=function(){
    previousRenderLibrary();
    decorateLibrary();
  };

  /* CHOOSE WEB ART opens the same candidate/paste workflow as VIEW ART, but
     prevents the legacy row handler from treating the new action as a save. */
  library.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action="choose-web-art"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const row=button.closest('.film-row');
    if(row&&typeof v16OpenArt==='function')v16OpenArt(row.dataset.id);
  },true);

  /* The launch screen never displays questionable art. If either slot is
     unresolved, every visual representation for that film becomes black. */
  const previousBuildCarousel=buildCarousel;
  buildCarousel=function(){
    previousBuildCarousel();
    track.querySelectorAll('.poster-card[data-film-id]').forEach(card=>{
      const film=films.find(f=>f.id===card.dataset.filmId);
      const unresolved=filmNeedsWebArt(film);
      card.classList.toggle('unresolved-art',unresolved);
      if(unresolved)card.innerHTML='<div class="unresolved-black" aria-label="Artwork unresolved"></div>';
    });
  };

  const previousRenderCategoryRows=renderCategoryRows;
  renderCategoryRows=function(){
    previousRenderCategoryRows();
    categoryRows.querySelectorAll('.category-card[data-film-id]').forEach(card=>{
      const film=films.find(f=>f.id===card.dataset.filmId);
      const unresolved=filmNeedsWebArt(film);
      card.classList.toggle('unresolved-art',unresolved);
      if(unresolved)card.innerHTML='<div class="unresolved-black" aria-hidden="true"></div>';
    });
  };

  const previousUpdateFilmDetails=updateFilmDetails;
  updateFilmDetails=function(){
    previousUpdateFilmDetails();
    const film=films[filmIndex];
    const unresolved=filmNeedsWebArt(film);
    const hero=$('heroBackdrop');
    hero?.classList.toggle('unresolved-art',unresolved);
    if(unresolved&&hero)hero.style.backgroundImage='none';
  };

  preloadArtwork=function(){
    films.filter(f=>!filmNeedsWebArt(f)).forEach(f=>[f.poster,f.backdrop].filter(Boolean).forEach(src=>{
      const image=new Image();image.src=src;
    }));
  };

  decorateLibrary();
})();
