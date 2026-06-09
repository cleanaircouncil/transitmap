// Properly clone a <template> element and return it's first child node, if it exists.
export const cloneTemplate = ( templateId, cloneId = "" ) => {
  const templateEl = document.querySelector(`template#${templateId}`);
  if (!templateEl || !(templateEl instanceof HTMLTemplateElement)) {
    console.log(`Couldn't find <template id="templateId"/>.`)
    return null;
  }

  const clonedNodes = templateEl.content.cloneNode(true).childNodes;
  if (clonedNodes.length == 0) {
    // console.log(`Template ${templateEl} has no children, returning null.`)
    return null;
  }

  if (clonedNodes.length > 1) {
    // console.log(`Template ${templateEl} has multiple children, only returning the first.`)
  }

  const result = clonedNodes[0];
  if( cloneId )
    result.setAttribute("data-id", cloneId);
  
  return result;
}

// Populate a DOM element with data, using [data-populate]
export const populateWithData = (el, data) => {
  const populateableNodes = [...el.querySelectorAll("[data-populate]")]

  if (el.dataset.populate) {
    populateableNodes.unshift(el);
  }

  const contextNodes = populateableNodes.filter( node => {
    const context = node.closest("[data-populate-context]");
    return !context || context == el;
  });

  for (const node of contextNodes) {
    const lines = node.dataset.populate.trim().split(/\s*,\s*/);
    const pairs = lines.map((line) => line.split(/\s*:\s*/));

    for (const [key, target] of pairs) {
      const keys = key.split(".");
      const value = keys.reduce((value, key) => value?.[key], data);
      const isUnset = value == null;
      const targets = target?.split(/\s+/) || ["innerHTML"];

      for (const target of targets) {
        if (target.startsWith(".")) {
          node.classList.toggle(target.substring(1), isUnset ? false : value);
        }
        
        if( isUnset ) 
          continue;

        if (target == "innerHTML") {
          node.innerHTML = value;
        } else if (target.startsWith("@")) {
          node.setAttribute(target.substring(1), value);
        } else if (target.startsWith("--")) {
          node.style.setProperty(target, value);
        } else if (target.startsWith("#")) {
          const template = target.substring(1);
          const values = Array.isArray(value) ? value : [value];
          const children = values.map( _ => cloneTemplate(template) )
          node.replaceChildren( ...children );
          node.childNodes.forEach( (child, i) => populateWithData(child, values[i]))
        } 
      }
    }
  }
};