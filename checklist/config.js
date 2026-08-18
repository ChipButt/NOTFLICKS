/* Shared checklist Cloudflare Worker endpoint. */
window.SHOW_CHECKLIST_API_URL = "https://show-checklist-api.goldplushighdefinition.workers.dev";

(function addPlanufHubLink(){
  function mount(){
    if(document.querySelector('.planuf-hub-link'))return;
    const style=document.createElement('style');
    style.textContent=`.planuf-hub-link{position:fixed;left:14px;top:14px;z-index:2147483647;display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #343b4b;border-radius:999px;background:rgba(17,21,29,.86);color:#eef1f7;text-decoration:none;font:800 10px/1.1 Inter,system-ui,-apple-system,sans-serif;letter-spacing:.11em;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:.72;transition:opacity .16s ease,transform .16s ease,border-color .16s ease}.planuf-hub-link:hover,.planuf-hub-link:focus-visible{opacity:1;transform:translateY(-1px);border-color:#5d6982;outline:none}@media(max-width:640px){.planuf-hub-link{left:9px;top:9px;padding:7px 9px;font-size:9px}}`;
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
