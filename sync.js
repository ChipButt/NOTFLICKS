const NOTFLICKS_FILM_KEY = 'notflicks.films.v1';
const NOTFLICKS_LIBRARY_AT_LOAD = localStorage.getItem(NOTFLICKS_FILM_KEY) || '[]';

function syncNotflicksLibrary() {
  const current = localStorage.getItem(NOTFLICKS_FILM_KEY) || '[]';
  if (current !== NOTFLICKS_LIBRARY_AT_LOAD) location.reload();
}

window.addEventListener('storage', event => {
  if (event.key === NOTFLICKS_FILM_KEY) location.reload();
});
window.addEventListener('focus', syncNotflicksLibrary);
window.addEventListener('pageshow', syncNotflicksLibrary);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncNotflicksLibrary();
});
