let singleLock = Promise.resolve();

const keyedLocks = new Map();

export function withSerialQueue(fn) {
  const prev = singleLock;
  let nextResolve;
  singleLock = new Promise(r => { nextResolve = r; });
  return (async () => {
    await prev;
    try {
      return await fn();
    } finally {
      nextResolve();
    }
  })();
}

export function withKeyedQueue(key, fn) {
  if (!keyedLocks.has(key)) {
    keyedLocks.set(key, Promise.resolve());
  }
  const prev = keyedLocks.get(key);
  let nextResolve;
  keyedLocks.set(key, new Promise(r => { nextResolve = r; }));
  return (async () => {
    await prev;
    try {
      return await fn();
    } finally {
      nextResolve();
    }
  })();
}

export function clearKeyedQueues() {
  keyedLocks.clear();
}
