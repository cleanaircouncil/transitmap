
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