/* v10: full-interface camera push + three-piece NOTFLICKS ident */
function startLogoAdsCycle(){
  if(!playActive)return;
  const seq=$('playSequence');
  seq.classList.remove('ads-phase','reload-flicker','logo-phase');
  seq.classList.add('black-phase');
  $('adLoading').hidden=true;
  void seq.offsetWidth;
  seq.classList.add('logo-phase');
  later(()=>{
    if(!playActive)return;
    seq.classList.remove('logo-phase');
    startAdCountdown();
  },2850);
}

function playNow(){
  if(!films.length)return;
  closePlaySequence();
  const seq=$('playSequence');
  const screenRoot=$('screenRoot');
  seq.hidden=false;
  seq.setAttribute('aria-hidden','false');
  seq.className='play-sequence';
  $('adLoading').hidden=true;
  playActive=true;

  // The live interface itself is what moves toward camera. The blackout is
  // layered over it and reaches full black before the 15% push completes.
  screenRoot.classList.remove('play-camera-push');
  void screenRoot.offsetWidth;
  screenRoot.classList.add('play-camera-push');
  void seq.offsetWidth;
  seq.classList.add('interface-phase');
  playbackActivity();

  later(()=>{
    if(!playActive)return;
    seq.classList.remove('interface-phase');
    seq.classList.add('black-phase');
    // Reset behind a fully opaque black frame, so Back returns to the normal UI.
    screenRoot.classList.remove('play-camera-push');
    startLogoAdsCycle();
  },1650);
  pollGamepadActivity();
}

function closePlaySequence(){
  playActive=false;
  clearPlayTimers();
  if(gamepadFrame)cancelAnimationFrame(gamepadFrame);
  gamepadFrame=0;
  lastGamepadState='';
  $('screenRoot')?.classList.remove('play-camera-push');
  const seq=$('playSequence');
  seq.hidden=true;
  seq.className='play-sequence';
  seq.setAttribute('aria-hidden','true');
  $('adLoading').hidden=true;
  $('playBackButton').classList.remove('visible');
}
