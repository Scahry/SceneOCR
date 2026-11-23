import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../api'
import { deleteProject, loadProjects, updateProject } from '../db'
import { SavedProject } from '../types'

interface Props {
  onNewProject: () => void
  onOpenProject: (project: SavedProject) => void
}

interface ProviderInfo { provider: string | null; ready: boolean }

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HomePage({ onNewProject, onOpenProject }: Props) {
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    loadProjects()
      .then(data => {
        if (active) setProjects(data)
      })
      .catch(error => {
        console.error('SceneOCR: could not load saved projects:', error)
        if (active) setStorageError('Saved projects could not be loaded. Check browser storage permissions.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let active = true

    async function poll() {
      try {
        const data: ProviderInfo = await fetch(apiUrl('/api/info')).then(r => r.json())
        if (!active) return
        setProviderInfo(data)
        if (!data.ready) timer = setTimeout(poll, 2000)
      } catch {
        // Backend may not yet be reachable.
      }
    }

    void poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  function startRename(project: SavedProject, event: React.MouseEvent) {
    event.stopPropagation()
    setEditingId(project.id)
    setEditTitle(project.title)
  }

  async function commitRename() {
    if (!editingId) return
    const id = editingId
    const title = editTitle.trim() || 'Untitled Project'
    setEditingId(null)

    try {
      await updateProject(id, { title })
      setProjects(previous => previous.map(project => project.id === id ? { ...project, title } : project))
      setStorageError(null)
    } catch (error) {
      console.error('SceneOCR: could not rename project:', error)
      setStorageError('Could not save the new project title.')
    }
  }

  async function handleDelete(id: string, event: React.MouseEvent) {
    event.stopPropagation()
    if (!confirm('Delete project?')) return

    try {
      await deleteProject(id)
      setProjects(previous => previous.filter(project => project.id !== id))
      setStorageError(null)
    } catch (error) {
      console.error('SceneOCR: could not delete project:', error)
      setStorageError('Could not delete this project.')
    }
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <h1 className="app-title">SceneOCR</h1>
          <p className="app-subtitle">On-screen text recognition — local, no cloud</p>
        </div>
        {providerInfo && (
          <div
            className={`provider-badge${providerInfo.ready ? (providerInfo.provider?.includes('GPU') ? ' gpu' : '') : ' loading'}`}
            title={providerInfo.ready ? (providerInfo.provider ?? 'CPU') : 'OCR engine loading…'}
          >
            <span className="provider-badge-icon">
              {!providerInfo.ready ? '···' : providerInfo.provider?.includes('GPU') ? '⚡' : '▣'}
            </span>
            <span className="provider-badge-label">
              {!providerInfo.ready ? 'Loading' : providerInfo.provider?.includes('GPU') ? 'GPU' : 'CPU'}
            </span>
          </div>
        )}
      </header>

      {storageError && <p role="alert" className="home-empty">{storageError}</p>}

      <div className="project-grid">
        <button type="button" className="project-card new-card" onClick={onNewProject}>
          <div className="new-card-icon">+</div>
          <div className="new-card-label">New Project</div>
        </button>

        {projects.map(project => (
          <div
            key={project.id}
            className="project-card"
            onClick={() => onOpenProject(project)}
            title={project.videoFilename}
          >
            <div className="project-thumb">
              {project.thumbnail
                ? <img src={project.thumbnail} alt="" />
                : <div className="project-thumb-placeholder">🎬</div>
              }
            </div>
            <div className="project-info">
              {editingId === project.id ? (
                <input
                  ref={inputRef}
                  className="project-title-input"
                  aria-label="Project title"
                  placeholder="Project title"
                  value={editTitle}
                  onChange={event => setEditTitle(event.target.value)}
                  onBlur={() => { void commitRename() }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') void commitRename()
                    if (event.key === 'Escape') setEditingId(null)
                  }}
                  onClick={event => event.stopPropagation()}
                />
              ) : (
                <div className="project-title" onDoubleClick={event => startRename(project, event)}>
                  {project.title}
                </div>
              )}
              <div className="project-meta">
                <span>{formatDate(project.createdAt)}</span>
                <span>{project.results.length} occurrence{project.results.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="project-filename">{project.videoFilename}</div>
            </div>
            <div className="project-actions">
              <button
                type="button"
                className="project-rename-btn"
                title="Rename"
                onClick={event => startRename(project, event)}
              >
                ✎
              </button>
              <button
                type="button"
                className="project-delete-btn"
                title="Delete"
                onClick={event => { void handleDelete(project.id, event) }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && !storageError && (
        <p className="home-empty">No projects yet. Create a new one to get started.</p>
      )}
    </div>
  )
}
