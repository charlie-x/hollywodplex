/*
 * dom.js — lightweight dom element creation helpers.
 */

/*
 * create an html element with attributes and children.
 * attrs: object of attribute key/value pairs (e.g. { class: 'foo', id: 'bar' })
 * children: strings become text nodes, elements are appended, arrays are flattened.
 */
export function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(elem.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      elem.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null && value !== false) {
      elem.setAttribute(key, value === true ? '' : String(value));
    }
  }
  appendChildren(elem, children);
  return elem;
}

function appendChildren(elem, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      elem.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      elem.appendChild(child);
    }
  }
}

/*
 * shorthand helpers for common elements.
 */
export function div(attrs, ...children) {
  return el('div', attrs, ...children);
}

export function span(attrs, ...children) {
  return el('span', attrs, ...children);
}

export function button(attrs, ...children) {
  return el('button', attrs, ...children);
}

export function img(attrs) {
  return el('img', { loading: 'lazy', ...attrs });
}
