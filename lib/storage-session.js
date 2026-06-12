function getArea() {
  if (chrome.storage?.session) {
    return chrome.storage.session;
  }
  if (chrome.storage?.local) {
    return chrome.storage.local;
  }
  return null;
}

export function hasSessionStorage() {
  return getArea() != null;
}

export async function sessionGet(keys) {
  const area = getArea();
  if (!area) {
    return {};
  }
  return area.get(keys);
}

export async function sessionSet(values) {
  const area = getArea();
  if (!area) {
    return;
  }
  return area.set(values);
}

export async function sessionRemove(keys) {
  const area = getArea();
  if (!area) {
    return;
  }
  return area.remove(keys);
}
