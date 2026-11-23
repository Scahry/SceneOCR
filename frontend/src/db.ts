import { SavedProject } from './types'

const DB_NAME = 'sceneocr'
const DB_VERSION = 1
const STORE_NAME = 'projects'
const LEGACY_STORAGE_KEY = 'sceneocr_projects'

let dbPromise: Promise<IDBDatabase> | null = null
let readyPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }

    request.onerror = () => {
      dbPromise = null
      reject(request.error ?? new Error('Could not open the project database.'))
    }

    request.onblocked = () => {
      reject(new Error('The project database is blocked by another open tab. Close other SceneOCR tabs and try again.'))
    }
  })

  return dbPromise
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction was aborted.'))
  })
}

/**
 * One-time import of projects previously stored in localStorage.
 * The old key is removed only after IndexedDB confirms the import succeeded.
 */
async function initializeDatabase(): Promise<IDBDatabase> {
  const db = await openDatabase()

  const readTx = db.transaction(STORE_NAME, 'readonly')
  const existingRequest = readTx.objectStore(STORE_NAME).getAll() as IDBRequest<SavedProject[]>
  const existing = await new Promise<SavedProject[]>((resolve, reject) => {
    existingRequest.onsuccess = () => resolve(existingRequest.result ?? [])
    existingRequest.onerror = () => reject(existingRequest.error)
  })
  await transactionDone(readTx)

  if (existing.length > 0) return db

  let legacyProjects: SavedProject[] = []
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) legacyProjects = parsed as SavedProject[]
    }
  } catch (error) {
    console.warn('SceneOCR could not read its old localStorage projects:', error)
    // Leave the legacy key untouched so the user can recover it manually.
    return db
  }

  if (legacyProjects.length > 0) {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const project of legacyProjects) {
      if (project && typeof project.id === 'string') store.put(project)
    }
    await transactionDone(tx)

    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch (error) {
      console.warn('SceneOCR imported projects, but could not remove the old localStorage copy:', error)
    }
  }

  return db
}

function getReadyDatabase(): Promise<IDBDatabase> {
  if (!readyPromise) {
    readyPromise = initializeDatabase().catch(error => {
      readyPromise = null
      throw error
    })
  }
  return readyPromise
}

export async function loadProjects(): Promise<SavedProject[]> {
  const db = await getReadyDatabase()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const request = tx.objectStore(STORE_NAME).getAll() as IDBRequest<SavedProject[]>
  const projects = await new Promise<SavedProject[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? [])
    request.onerror = () => reject(request.error ?? new Error('Could not load saved projects.'))
  })
  await transactionDone(tx)
  return projects.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveProject(project: SavedProject): Promise<void> {
  const db = await getReadyDatabase()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(project)
  await transactionDone(tx)
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getReadyDatabase()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).delete(id)
  await transactionDone(tx)
}

export async function updateProject(id: string, patch: Partial<SavedProject>): Promise<void> {
  const db = await getReadyDatabase()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const request = store.get(id) as IDBRequest<SavedProject | undefined>

  const project = await new Promise<SavedProject | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not read the project to update.'))
  })

  if (project) store.put({ ...project, ...patch, id })
  await transactionDone(tx)
}
