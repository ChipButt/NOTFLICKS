/* v18: robust clipboard artwork paste */
(function(){
  function zoneFor(kind){return document.querySelector(`.paste-art-zone[data-paste-target="${kind}"]`)}
  function resetZone(zone){
    if(!zone)return;
    zone.textContent='Click here, then paste a copied image (Ctrl/Cmd+V)';
  }
  function prepareZones(){
    document.querySelectorAll('.paste-art-zone[data-paste-target]').forEach(zone=>{
      if(zone.dataset.v18Ready==='1')return;
      zone.dataset.v18Ready='1';
      zone.setAttribute('contenteditable','true');
      zone.setAttribute('role','textbox');
      zone.setAttribute('aria-label',`Paste ${zone.dataset.pasteTarget} image`);
      zone.setAttribute('spellcheck','false');
      resetZone(zone);
      if(!zone.nextElementSibling?.matches('.paste-clipboard-button')){
        const button=document.createElement('button');
        button.type='button';
        button.className='paste-clipboard-button';
        button.dataset.clipboardTarget=zone.dataset.pasteTarget;
        button.textContent='PASTE FROM CLIPBOARD';
        zone.insertAdjacentElement('afterend',button);
      }
    });
  }

  function firstImageUrlFromHtml(html){
    if(!html)return'';
    try{
      const doc=new DOMParser().parseFromString(html,'text/html');
      const img=doc.querySelector('img[src]');
      const src=img?.getAttribute('src')?.trim()||'';
      return /^(?:https?:|data:image\/)/i.test(src)?src:'';
    }catch{return''}
  }

  async function applyBlob(kind,blob){
    if(!blob)return false;
    $('artViewStatus').textContent=`Preparing pasted ${kind} image…`;
    try{
      const dataUrl=await v16BlobToCompressedDataUrl(blob,kind);
      v16ApplyArt(kind,dataUrl,'pasted clipboard image');
      return true;
    }catch(error){
      console.warn('Clipboard image decode failed',error);
      $('artViewStatus').textContent='The clipboard contained an image, but the browser could not read it.';
      return false;
    }
  }

  function applyUrl(kind,url,label='pasted image URL'){
    const value=String(url||'').trim();
    if(!/^(?:https?:\/\/|data:image\/)/i.test(value))return false;
    const input=$(kind==='poster'?'posterUrlInput':'bannerUrlInput');
    if(input)input.value=value;
    v16ApplyArt(kind,value,label);
    return true;
  }

  async function handleClipboardData(kind,data){
    const items=[...(data?.items||[])];
    const imageItem=items.find(item=>item.kind==='file'&&String(item.type||'').startsWith('image/'));
    if(imageItem){
      const file=imageItem.getAsFile?.();
      if(file&&await applyBlob(kind,file))return true;
    }

    const html=data?.getData?.('text/html')||'';
    const htmlUrl=firstImageUrlFromHtml(html);
    if(htmlUrl&&applyUrl(kind,htmlUrl,'image copied from webpage'))return true;

    const text=(data?.getData?.('text/uri-list')||data?.getData?.('text/plain')||'').trim();
    if(text&&applyUrl(kind,text.split(/\r?\n/)[0],'pasted image URL'))return true;
    return false;
  }

  async function handlePasteEvent(event){
    const dialog=document.getElementById('artViewDialog');
    if(!dialog?.open)return;
    const direct=event.target.closest?.('.paste-art-zone[data-paste-target]');
    const focused=document.activeElement?.closest?.('.paste-art-zone[data-paste-target]');
    const zone=direct||focused;
    if(!zone)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const kind=zone.dataset.pasteTarget;
    const ok=await handleClipboardData(kind,event.clipboardData);
    resetZone(zone);
    if(!ok)$('artViewStatus').textContent='Nothing usable was found in the clipboard. Try Copy Image on the image itself, paste a direct image URL, or use PASTE FROM CLIPBOARD.';
  }

  async function readClipboard(kind){
    const zone=zoneFor(kind);
    if(!navigator.clipboard?.read){
      zone?.focus();
      $('artViewStatus').textContent='Direct clipboard reading is not supported here. The paste box is focused — press Ctrl+V or Cmd+V now.';
      return;
    }
    $('artViewStatus').textContent=`Reading ${kind} image from clipboard…`;
    try{
      const clipboardItems=await navigator.clipboard.read();
      for(const item of clipboardItems){
        const imageType=item.types.find(type=>type.startsWith('image/'));
        if(imageType){
          const blob=await item.getType(imageType);
          if(await applyBlob(kind,blob))return;
        }
        if(item.types.includes('text/html')){
          const html=await (await item.getType('text/html')).text();
          const url=firstImageUrlFromHtml(html);
          if(url&&applyUrl(kind,url,'image copied from webpage'))return;
        }
        for(const textType of ['text/uri-list','text/plain']){
          if(item.types.includes(textType)){
            const text=await (await item.getType(textType)).text();
            if(applyUrl(kind,text.split(/\r?\n/)[0],'pasted image URL'))return;
          }
        }
      }
      zone?.focus();
      $('artViewStatus').textContent='No image was exposed by the clipboard. The paste box is focused — press Ctrl+V or Cmd+V, or paste the image URL.';
    }catch(error){
      console.warn('Direct clipboard read unavailable',error);
      zone?.focus();
      $('artViewStatus').textContent='The browser blocked direct clipboard access. The paste box is focused — press Ctrl+V or Cmd+V now.';
    }
  }

  prepareZones();
  const dialog=document.getElementById('artViewDialog');
  if(dialog){
    dialog.addEventListener('paste',handlePasteEvent,true);
    dialog.addEventListener('click',event=>{
      const button=event.target.closest('.paste-clipboard-button[data-clipboard-target]');
      if(button)readClipboard(button.dataset.clipboardTarget);
    });
  }

  /* Repair controls only if a future render actually creates a new paste zone. */
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>[...m.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('.paste-art-zone[data-paste-target]')||node.querySelector?.('.paste-art-zone[data-paste-target]')))))prepareZones();
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
