/* v11: events using prize-wheel motion */
library.addEventListener('click',async event=>{const button=event.target.closest('button[data-action]'),row=event.target.closest('.film-row');if(!button||!row)return;const index=films.findIndex(f=>f.id===row.dataset.id);if(index<0)return;const film=films[index],action=button.dataset.action;if(action==='versions')return openVersionsDialog(index);if(action==='google-poster')return window.open(googleImagesUrl(film,'poster'),'_blank','noopener,noreferrer');if(action==='google-banner')return window.open(googleImagesUrl(film,'banner'),'_blank','noopener,noreferrer');if(action==='refind'){button.disabled=true;await refindOne(index);button.disabled=false;return}if(action==='edit')return openManualDialog(film);if(action==='remove')films.splice(index,1);if(action==='up'&&index>0)[films[index-1],films[index]]=[films[index],films[index-1]];if(action==='down'&&index<films.length-1)[films[index+1],films[index]]=[films[index],films[index+1]];save()});
track.addEventListener('click',event=>{const card=event.target.closest('.poster-card');if(!card||locked||spinning)return;virtualIndex=Number(card.dataset.virtualIndex);filmIndex=Number(card.dataset.filmIndex);commitSelection(280,true);setTimeout(recenter,300)});
categoryRows.addEventListener('click',event=>{const card=event.target.closest('.category-card');if(card&&!spinning)selectFilmById(card.dataset.filmId)});

carousel.addEventListener('wheel',event=>{
  if(locked||spinning)return;
  event.preventDefault();
  const amount=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
  wheelDirection=amount>=0?1:-1;
  wheelBurst+=Math.abs(amount);
  clearTimeout(wheelTimer);
  wheelTimer=setTimeout(()=>{
    const burst=wheelBurst;
    wheelBurst=0;
    if(burst>300)spin(wheelDirection,burst);
    else if(burst>16)move(wheelDirection);
  },90);
},{passive:false});

carousel.addEventListener('pointerdown',event=>{if(locked||spinning)return;dragging=true;dragStartX=event.clientX;dragStartTime=performance.now();carousel.setPointerCapture?.(event.pointerId)});
carousel.addEventListener('pointerup',event=>{
  if(!dragging||locked||spinning)return;
  dragging=false;
  const dx=event.clientX-dragStartX,dt=Math.max(1,performance.now()-dragStartTime),velocity=Math.abs(dx/dt);
  if(velocity>1.15||Math.abs(dx)>240)spin(dx<0?1:-1,Math.abs(dx)+velocity*180);
  else if(Math.abs(dx)>38)move(dx<0?1:-1);
});
carousel.addEventListener('pointercancel',()=>dragging=false);

$('resolveButton').addEventListener('click',resolveFilms);
$('refreshAllButton').addEventListener('click',refreshAllArtwork);
$('addManualButton').addEventListener('click',()=>openManualDialog());
$('shuffleButton').addEventListener('click',()=>{for(let i=films.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[films[i],films[j]]=[films[j],films[i]]}filmIndex=0;save()});
$('clearButton').addEventListener('click',()=>{if(!films.length||confirm('Remove every film from NOTFLICKS?')){films=[];filmIndex=0;save()}});
$('soundToggle').addEventListener('change',save);
$('avoidSameToggle').addEventListener('change',save);
$('previewButton').addEventListener('click',()=>showScreen(true));
$('launchButton').addEventListener('click',()=>showScreen(false));
$('backButton').addEventListener('click',()=>{v11CancelSelectorMotion();showSetup()});
$('emptyBackButton').addEventListener('click',showSetup);
$('prevButton').addEventListener('click',()=>move(-1));
$('nextButton').addEventListener('click',()=>move(1));
$('spinButton').addEventListener('click',()=>spin());
$('lockButton').addEventListener('click',toggleLock);
$('fullscreenButton').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.());
$('playNowButton').addEventListener('click',()=>{v11CancelSelectorMotion();playNow()});
$('moreInfoButton').addEventListener('click',event=>event.preventDefault());
$('playBackButton').addEventListener('click',closePlaySequence);
$('versionOptions').addEventListener('click',event=>{const option=event.target.closest('.version-option');if(option)chooseVersion(option.dataset.wikiTitle)});
$('versionCloseButton').addEventListener('click',()=>$('versionDialog').close());

$('manualForm').addEventListener('submit',event=>{if(event.submitter?.value==='cancel'){editingId=null;return}event.preventDefault();const title=$('manualTitle').value.trim();if(!title)return;const categories=$('manualCategories').value.split(',').map(x=>x.trim()).filter(Boolean);const values={title,year:$('manualYear').value.trim(),poster:$('manualPoster').value.trim(),backdrop:$('manualBackdrop').value.trim(),overview:$('manualOverview').value.trim(),categories:categories.length?categories:inferCategories($('manualOverview').value)};if(editingId){const index=films.findIndex(f=>f.id===editingId);if(index>=0)films[index]=normaliseFilm({...films[index],...values,source:values.poster||values.backdrop?'custom':films[index].source})}else films.push(normaliseFilm({id:uid(),source:values.poster||values.backdrop?'custom':'manual',...values}));editingId=null;$('manualForm').reset();manualDialog.close();save()});

function handlePlaybackInput(){if(playActive)playbackActivity()}
window.addEventListener('pointermove',handlePlaybackInput,{passive:true});
window.addEventListener('mousemove',handlePlaybackInput,{passive:true});
window.addEventListener('wheel',handlePlaybackInput,{passive:true});
window.addEventListener('touchstart',handlePlaybackInput,{passive:true});

window.addEventListener('keydown',event=>{
  if(playActive){
    playbackActivity();
    if(event.key==='Escape'||event.key==='Backspace'||event.key==='BrowserBack'){event.preventDefault();closePlaySequence();return}
  }
  if(screenView.hidden)return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();
    if(event.repeat)return;
    v11ArrowDown(event.key==='ArrowLeft'?-1:1);
    return;
  }
  if(event.code==='Space'){event.preventDefault();spin();return}
  if(event.key.toLowerCase()==='l')toggleLock();
  if(event.key.toLowerCase()==='f')document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();
  if(event.shiftKey&&event.key.toLowerCase()==='a'){v11CancelSelectorMotion();showSetup()}
});
window.addEventListener('keyup',event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();
    v11ArrowUp(event.key==='ArrowLeft'?-1:1);
  }
});
window.addEventListener('blur',()=>{if(v11ArrowDirection)v11ArrowUp(v11ArrowDirection)});
window.addEventListener('gamepadconnected',()=>{if(playActive)playbackActivity()});
window.addEventListener('resize',()=>{if(!screenView.hidden&&films.length)updateTrack(0)});

$('soundToggle').checked=settings.sound!==false;
$('avoidSameToggle').checked=settings.avoidSame!==false;
save();
if(location.hash==='#preview')showScreen(true);else if(location.hash==='#screen')showScreen(false);else showSetup();
