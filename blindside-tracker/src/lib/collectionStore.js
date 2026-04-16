const STORAGE_KEY = 'blindside-tracker.collection.v1'

const memoryState = {}

function readStorage() {
  if (typeof window === 'undefined') {
    return memoryState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStorage(state) {
  if (typeof window === 'undefined') {
    Object.assign(memoryState, state)
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Keep the UI usable even if the browser rejects writes.
  }
}

export const collectionStore = {
  load() {
    return readStorage()
  },
  save(state) {
    writeStorage(state)
  },
}
