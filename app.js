const grid=document.getElementById('showGrid');
const count=document.getElementById('showCount');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
  try{
    const response=await fetch(`./apps.json?_=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error('Could not load shows.');
    const shows=await response.json();
    count.textContent=`${shows.length} SHOW${shows.length===1?'':'S'}`;
    grid.innerHTML=shows.map(show=>`<a class="show-card" href="${escapeHtml(show.path)}" style="--accent:${escapeHtml(show.accent||'#8c7cf3')}"><div class="show-art-wrap"><img class="show-art" src="${escapeHtml(show.image)}" alt="${escapeHtml(show.name)} logo"></div><div class="show-copy"><div><h3>${escapeHtml(show.name)}</h3><p>${escapeHtml(show.description||'Open production tools')}</p></div><span class="open-bubble" aria-hidden="true">→</span></div></a>`).join('');
  }catch(error){grid.innerHTML=`<div class="load-error">${escapeHtml(error.message||'Could not load shows.')}</div>`}
})();
