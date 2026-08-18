const STORAGE={films:'notflicks.films.v1',settings:'notflicks.settings.v1',selected:'notflicks.selected.v1'};
const $=id=>document.getElementById(id);
const setupView=$('setupView'),screenView=$('screenView'),library=$('library'),titleInput=$('titleInput'),resolveStatus=$('resolveStatus'),manualDialog=$('manualDialog'),carousel=$('carousel'),track=$('track'),categoryRows=$('categoryRows');
let films=loadJSON(STORAGE.films,[]).map(normaliseFilm),settings={sound:true,avoidSame:true,...loadJSON(STORAGE.settings,{})},editingId=null,previewMode=true,locked=false,spinning=false,dragging=false,dragStartX=0,dragStartTime=0,wheelBurst=0,wheelDirection=1,wheelTimer=0,audioCtx=null,filmIndex=0,virtualIndex=0;
const REPEATS=13,MIDDLE_REPEAT=Math.floor(REPEATS/2);
filmIndex=clampIndex(Number(localStorage.getItem(STORAGE.selected))||0);

function loadJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function normaliseFilm(film){const poster=film.poster||'';const backdrop=film.backdrop&&film.backdrop!==poster?film.backdrop:'';return{...film,id:film.id||uid(),title:film.title||'Untitled',year:film.year||'',poster,backdrop,overview:film.overview||'',categories:Array.isArray(film.categories)&&film.categories.length?film.categories:inferCategories(film.overview||'')}}
function clampIndex(v){if(!films.length)return 0;return Math.max(0,Math.min(films.length-1,Number(v)||0))}
function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
function escapeHtml(value=''){const n=document.createElement('span');n.textContent=String(value);return n.innerHTML}
function save(){films=films.map(normaliseFilm);localStorage.setItem(STORAGE.films,JSON.stringify(films));settings.sound=$('soundToggle').checked;settings.avoidSame=$('avoidSameToggle').checked;localStorage.setItem(STORAGE.settings,JSON.stringify(settings));filmIndex=clampIndex(filmIndex);renderLibrary()}
function parseLine(raw){const text=raw.trim(),m=text.match(/^(.*?)(?:\s*\((\d{4})\)|\s+(\d{4}))?$/);return{title:(m?.[1]||text).trim(),year:m?.[2]||m?.[3]||''}}
function cleanTitle(v=''){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function inferredYear(text=''){const m=String(text).match(/\b(?:18|19|20)\d{2}\b/);return m?m[0]:''}
function filenameWords(title=''){return cleanTitle(title.replace(/^File:/i,'').replace(/\.[a-z0-9]+$/i,''))}

function inferCategories(text=''){
  const t=cleanTitle(text);const categories=[];
  const tests=[
    ['Comedy',/\b(comedy|comic|satire|farce|humor|humour)\b/],
    ['Action & Adventure',/\b(action|adventure|martial arts|superhero|swashbuckler)\b/],
    ['Horror',/\b(horror|slasher|supernatural horror|zombie|vampire|monster)\b/],
    ['Sci-Fi & Fantasy',/\b(science fiction|sci fi|fantasy|space opera|dystopian|time travel)\b/],
    ['Crime & Mystery',/\b(crime|mystery|detective|heist|gangster|police procedural)\b/],
    ['Thrillers',/\b(thriller|suspense|spy film|psychological thriller)\b/],
    ['Family & Animation',/\b(animated|animation|family film|children s|children film|pixar)\b/],
    ['Romance',/\b(romance|romantic|love story)\b/],
    ['Documentaries',/\b(documentary|docudrama)\b/],
    ['Drama',/\b(drama|dramatic|biographical film|biopic)\b/]
  ];
  tests.forEach(([name,re])=>{if(re.test(t))categories.push(name)});
  if(!categories.length)categories.push('Drama');
  return [...new Set(categories)].slice(0,3);
}

function articleScore(page,item){const title=cleanTitle(page.title||''),wanted=cleanTitle(item.title),extract=cleanTitle(page.extract||'');let score=0;if(title===wanted)score+=50;if(title.startsWith(wanted))score+=28;if(title.includes(wanted))score+=16;if(title.includes('film'))score+=22;if(extract.includes(' film'))score+=18;if(item.year&&(title.includes(item.year)||extract.includes(item.year)))score+=28;if(title.includes('disambiguation'))score-=80;return score}
