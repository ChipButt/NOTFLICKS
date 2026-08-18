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

(function addPlanufHubLink(){
  function mount(){
    if(document.querySelector('.planuf-hub-link'))return;
    const style=document.createElement('style');
    style.textContent=`.planuf-hub-link{position:fixed;left:14px;top:14px;z-index:2147483647;display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(2,7,19,.72);color:#dbe7ff;text-decoration:none;font:800 10px/1.1 Inter,system-ui,-apple-system,sans-serif;letter-spacing:.11em;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:.62;transition:opacity .16s ease,transform .16s ease,border-color .16s ease}.planuf-hub-link:hover,.planuf-hub-link:focus-visible{opacity:1;transform:translateY(-1px);border-color:rgba(255,255,255,.32);outline:none}@media(max-width:640px){.planuf-hub-link{left:9px;top:9px;padding:7px 9px;font-size:9px}}`;
    document.head.appendChild(style);
    const link=document.createElement('a');
    link.className='planuf-hub-link';
    link.href='../';
    link.textContent='← PLANUF APPS';
    link.setAttribute('aria-label','Back to Planuf Apps');
    document.body.appendChild(link);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
