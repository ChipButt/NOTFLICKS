(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  const wanted=params.get('show');
  if(!wanted)return;
  const names={
    'show-tin-files':'The Tin Files',
    'show-movie-name-change':'The Movie Name Change Game Show',
    'show-check-in':'The Check-In',
    'show-658f5ad3-0721-4009-a11a-206b6efa7396':'Literally Delicious'
  };
  const showName=names[wanted]||'Show';
  document.body.classList.add('scoped-checklist');
  const link=document.querySelector('.planuf-hub-link');
  const returnPath=params.get('return');
  if(link){link.href=returnPath||'../';link.textContent=`← ${showName.toUpperCase()}`;link.setAttribute('aria-label',`Back to ${showName}`)}
  const topTitle=document.querySelector('.top h1');if(topTitle)topTitle.textContent='Production Checklist';
  const eyebrow=document.querySelector('.top .eyebrow');if(eyebrow)eyebrow.textContent=`PLANUF · ${showName.toUpperCase()}`;
  document.title=`${showName} — Production Checklist`;
  let settling=false;
  function enforce(){
    if(settling)return false;
    const select=document.getElementById('shows');
    if(!select)return false;
    const exists=[...select.options].some(option=>option.value===wanted);
    if(!exists)return false;
    if(select.value!==wanted){
      settling=true;
      select.value=wanted;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      settling=false;
    }
    document.body.classList.add('scope-ready');
    return true;
  }
  const select=document.getElementById('shows');
  if(select){new MutationObserver(()=>enforce()).observe(select,{childList:true,subtree:true});}
  enforce();
  const timer=setInterval(()=>{if(enforce())clearInterval(timer)},120);
  setTimeout(()=>clearInterval(timer),10000);
})();
