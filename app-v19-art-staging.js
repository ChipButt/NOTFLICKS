/* v19: stage pasted artwork as a candidate; only USE THIS applies it */
(function(){
  const stagedState={poster:null,banner:null};

  function zoneFor(kind){return document.querySelector(`.paste-art-zone[data-paste-target="${kind}"]`)}
  function gridFor(kind){return $(kind==='poster'?'posterCandidateGrid':'bannerCandidateGrid')}
  function confirmationFor(kind){
    const zone=zoneFor(kind);if(!zone)return null;
    let note=zone.parentElement?.querySelector(`.paste-confirmation[data-kind="${kind}"]`);
    if(!note){
      note=document.createElement('div');
      note.className='paste-confirmation';
      note.dataset.kind=kind;
      const button=zone.parentElement?.querySelector(`.paste-clipboard-button[data-clipboard-target="${kind}"]`);
      (button||zone).insertAdjacentElement('afterend',note);
    }
    return note;
  }
  function ensureConfirmations(){confirmationFor('poster');confirmationFor('banner')}

  function dimensionsFromDataUrl(dataUrl){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve({width:img.naturalWidth||0,height:img.naturalHeight||0});
      img.onerror=()=>resolve({width:0,height:0});
      img.src=dataUrl;
    });
  }

  function firstImageUrlFromHtml(html){
    if(!html)return'';
    try{
      const doc=new DOMParser().parseFromString(html,'text/html');
      const src=doc.querySelector('img[src]')?.getAttribute('src')?.trim()||'';
      return /^(?:https?:\/\/|data:image\/)/i.test(src)?src:'';
    }catch{return''}
  }

  function stageCandidate(kind,candidate){
    const film=films.find(f=>f.id===v16ArtFilmId);if(!film||!candidate?.url)return false;
    const key=candidate.original||candidate.url;
    v16ArtCandidates[kind]=[
      {...candidate,pasted:true,source:'pasted'},
      ...(v16ArtCandidates[kind]||[]).filter(c=>(c.original||c.url)!==key)
    ];
    stagedState[kind]=key;
    v16RenderCandidates(film);

    const label=kind==='poster'?'Poster':'Banner';
    const status=$('artViewStatus');
    if(status){status.textContent=`✓ ${label} image received. It has been added to the options — press USE THIS to apply it.`;status.classList.add('paste-success')}
    const confirmation=confirmationFor(kind);
    if(confirmation){confirmation.textContent='✓ Image received — added to options above. Press USE THIS to apply it.';confirmation.classList.add('visible')}

    requestAnimationFrame(()=>{
      const grid=gridFor(kind);
      const staged=grid?.querySelector('.art-candidate.pasted');
      staged?.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
    });
    return true;
  }

  async function stageBlob(kind,blob){
    if(!blob)return false;
    const status=$('artViewStatus');if(status){status.textContent=`Preparing pasted ${kind} image…`;status.classList.remove('paste-success')}
    try{
      const dataUrl=await v16BlobToCompressedDataUrl(blob,kind);
      const dims=await dimensionsFromDataUrl(dataUrl);
      return stageCandidate(kind,{title:'PASTED IMAGE',url:dataUrl,original:dataUrl,width:dims.width,height:dims.height});
    }catch(error){
      console.warn('Could not prepare pasted artwork',error);
      if(status)status.textContent='The clipboard contained an image, but the browser could not prepare it.';
      return false;
    }
  }

  function stageUrl(kind,url,label='PASTED IMAGE URL'){
    const value=String(url||'').trim();
    if(!/^(?:https?:\/\/|data:image\/)/i.test(value))return false;
    const input=$(kind==='poster'?'posterUrlInput':'bannerUrlInput');if(input)input.value=value;
    return stageCandidate(kind,{title:label,url:value,original:value,width:0,height:0});
  }

  async function stageFromDataTransfer(kind,data){
    const items=[...(data?.items||[])];
    const imageItem=items.find(item=>item.kind==='file'&&String(item.type||'').startsWith('image/'));
    if(imageItem){const file=imageItem.getAsFile?.();if(file&&await stageBlob(kind,file))return true}
    const html=data?.getData?.('text/html')||'';
    const htmlUrl=firstImageUrlFromHtml(html);if(htmlUrl&&stageUrl(kind,htmlUrl,'PASTED WEB IMAGE'))return true;
    const text=(data?.getData?.('text/uri-list')||data?.getData?.('text/plain')||'').trim();
    if(text&&stageUrl(kind,text.split(/\r?\n/)[0],'PASTED IMAGE URL'))return true;
    return false;
  }

  async function directClipboardRead(kind){
    const zone=zoneFor(kind),status=$('artViewStatus');
    if(!navigator.clipboard?.read){
      zone?.focus();if(status)status.textContent='The browser cannot read the clipboard directly here. Press Ctrl+V or Cmd+V in the focused paste box.';return;
    }
    if(status){status.textContent=`Reading ${kind} image from clipboard…`;status.classList.remove('paste-success')}
    try{
      const entries=await navigator.clipboard.read();
      for(const entry of entries){
        const imageType=entry.types.find(type=>type.startsWith('image/'));
        if(imageType&&await stageBlob(kind,await entry.getType(imageType)))return;
        if(entry.types.includes('text/html')){
          const html=await (await entry.getType('text/html')).text();
          const url=firstImageUrlFromHtml(html);if(url&&stageUrl(kind,url,'PASTED WEB IMAGE'))return;
        }
        for(const type of ['text/uri-list','text/plain'])if(entry.types.includes(type)){
          const text=await (await entry.getType(type)).text();
          if(stageUrl(kind,text.split(/\r?\n/)[0],'PASTED IMAGE URL'))return;
        }
      }
      zone?.focus();if(status)status.textContent='No usable image was found in the clipboard. Try Copy Image, then press Ctrl+V or Cmd+V in the paste box.';
    }catch(error){
      console.warn('Clipboard read blocked',error);zone?.focus();if(status)status.textContent='The browser blocked direct clipboard reading. Press Ctrl+V or Cmd+V in the focused paste box.';
    }
  }

  const previousCandidateCard=v16CandidateCard;
  v16CandidateCard=function(c,kind,index,current){
    const html=previousCandidateCard(c,kind,index,current);
    if(!c?.pasted&&c?.source!=='pasted')return html;
    return html.replace(`class="art-candidate ${kind} `,`class="art-candidate ${kind} pasted `)
      .replace('<div class="art-candidate-frame">','<div class="pasted-badge">PASTED</div><div class="art-candidate-frame">')
      .replace(/0×0 · pasted/g,'pasted alternative');
  };

  /* URL entry now stages an option too instead of applying immediately. */
  v16UseUrl=function(kind){
    const input=$(kind==='poster'?'posterUrlInput':'bannerUrlInput');
    const value=input?.value.trim()||'';
    if(!stageUrl(kind,value,'PASTED IMAGE URL')){
      const status=$('artViewStatus');if(status)status.textContent='Paste a direct http/https image URL first.';
    }
  };

  /* Intercept paste before the older v18 handler, which applied immediately. */
  window.addEventListener('paste',async event=>{
    const dialog=document.getElementById('artViewDialog');if(!dialog?.open)return;
    const zone=event.target.closest?.('.paste-art-zone[data-paste-target]')||document.activeElement?.closest?.('.paste-art-zone[data-paste-target]');
    if(!zone)return;
    event.preventDefault();event.stopImmediatePropagation();
    const kind=zone.dataset.pasteTarget;
    const ok=await stageFromDataTransfer(kind,event.clipboardData);
    if(!ok){const status=$('artViewStatus');if(status)status.textContent='Nothing usable was found in that paste. Try Copy Image on the image itself, or paste a direct image URL.'}
  },true);

  /* Intercept the v18 clipboard button before its immediate-apply handler. */
  window.addEventListener('click',event=>{
    const button=event.target.closest?.('.paste-clipboard-button[data-clipboard-target]');if(!button)return;
    const dialog=document.getElementById('artViewDialog');if(!dialog?.open)return;
    event.preventDefault();event.stopImmediatePropagation();
    directClipboardRead(button.dataset.clipboardTarget);
  },true);

  ensureConfirmations();
  const observer=new MutationObserver(()=>ensureConfirmations());
  observer.observe(document.body,{childList:true,subtree:true});
})();
