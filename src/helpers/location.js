
export function updateHash(hash) {
  const url = new URL(window.location);
  url.hash = hash;
  history.pushState({}, "", url);
}

export function updateSearchParam(name, value) {
  const url = new URL(window.location);
  if( value )
    url.searchParams.set(name, value);
  else 
    url.searchParams.delete(name);
  
  history.replaceState({}, "", url);
}

export async function loadPartial(url, target) {
  history.pushState({}, '', url);
  const html = await fetch(url).then(r => r.text());
  const doc = new DOMParser().parseFromString(html, "text/html");
  
  document.querySelector(target).innerHTML = doc.querySelector(target).innerHTML;
}