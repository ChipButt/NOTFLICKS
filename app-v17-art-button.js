/* v17: make VIEW ART permanently visible after every library render */
(function(){
  function ensureViewArtButtons(){
    document.querySelectorAll('.film-row .row-actions').forEach(actions=>{
      if(actions.querySelector('[data-action="view-art"]'))return;
      const button=document.createElement('button');
      button.type='button';
      button.dataset.action='view-art';
      button.textContent='VIEW ART';
      const refind=actions.querySelector('[data-action="refind"]');
      if(refind)refind.insertAdjacentElement('afterend',button);
      else actions.prepend(button);
    });
  }

  ensureViewArtButtons();

  const observer=new MutationObserver(()=>ensureViewArtButtons());
  observer.observe(library,{childList:true,subtree:true});

  /* v16's handler opens the dialog first. Stop the older generic library
     handler from subsequently treating this as an ordinary row action/save. */
  library.addEventListener('click',event=>{
    if(event.target.closest('button[data-action="view-art"]'))event.stopImmediatePropagation();
  });
})();
