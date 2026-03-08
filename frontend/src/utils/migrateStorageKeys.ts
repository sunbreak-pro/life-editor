const OLD_PREFIX = "sonic-flow-";
const NEW_PREFIX = "life-editor-";
const FLAG = "life-editor-storage-migrated";

if (!localStorage.getItem(FLAG)) {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(OLD_PREFIX)) keys.push(k);
  }
  for (const old of keys) {
    const val = localStorage.getItem(old);
    const newKey = NEW_PREFIX + old.slice(OLD_PREFIX.length);
    if (val !== null && localStorage.getItem(newKey) === null)
      localStorage.setItem(newKey, val);
    localStorage.removeItem(old);
  }
  localStorage.setItem(FLAG, "1");
}
