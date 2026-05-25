let _isDestroyed = false;

export function isDestroyed() {
  return _isDestroyed;
}

export function setDestroyed(value) {
  _isDestroyed = value;
}

export async function destroy() {
  _isDestroyed = true;
}

export async function init() {
  _isDestroyed = false;
}