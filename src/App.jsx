import { useMemo, useState, useEffect } from 'react'
import './App.css'

const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
const defaultTopK = Number(import.meta.env.VITE_DEFAULT_TOP_K ?? 6) || 6

const endpoint = (path) => `${apiBase}${path}`

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('theme')
      if (stored) return stored
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(defaultTopK)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summarizingUrl, setSummarizingUrl] = useState('')
  const [summaryModal, setSummaryModal] = useState({ open: false, text: '', title: '', url: '' })

  const hasResults = useMemo(() => results.length > 0, [results])

  const handleSearch = async (event) => {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      setError('Type something to search')
      return
    }

    setLoading(true)
    setError('')
    setResults([])

    try {
      const resp = await fetch(endpoint('/api/search/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, top_k: Number(topK) || defaultTopK }),
      })
      if (!resp.ok) {
        throw new Error('Search failed')
      }
      const data = await resp.json()
      setResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSummarize = async (item, identifier) => {
    setSummarizingUrl(identifier)
    setError('')

    try {
      const payload = {
        text: item.snippet?.trim() || (item.url ? `Please summarize content from ${item.url}` : 'Please summarize this content'),
        max_tokens: Number(import.meta.env.VITE_SUMMARY_MAX_TOKENS ?? 400) || 400,
      }
      const resp = await fetch(endpoint('/api/search/summarize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        throw new Error('Summarize failed')
      }
      const json = await resp.json()
      const summaryText = typeof json === 'string' ? json : json.summary
      setSummaryModal({ open: true, text: summaryText ?? 'No summary available yet.', title: item.title || item.url, url: item.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summarize failed')
    } finally {
      setSummarizingUrl('')
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setError('')
  }

  const closeModal = () => setSummaryModal({ open: false, text: '', title: '', url: '' })

  return (
    <div className="app-shell">
      <header>
        <div className="theme-toggle-container">
          <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle theme">
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </button>
        </div>
        <p className="eyebrow">Web + AI</p>
        <h1>AI Search Engine</h1>
        <p className="subhead">Run Tavily-powered searches and summarize any result via Groq.</p>
      </header>

      <form className="search-panel" onSubmit={handleSearch}>
        <label htmlFor="query" className="sr-only">Search query</label>
        <input
          id="query"
          value={query}
          placeholder="Search the web..."
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="search-actions">
          <select value={topK} onChange={(event) => setTopK(event.target.value)}>
            {[3, 5, 6, 8, 10].map((value) => (
              <option key={value} value={value}>
                Top {value}
              </option>
            ))}
          </select>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button type="button" onClick={handleClear} className="ghost">
            Clear
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <section className="results">
        {!loading && !hasResults && !error && <p className="muted">Try searching for anything you are curious about.</p>}
        {loading && <p className="muted">Searching Tavily…</p>}
        {hasResults && (
          <ul>
            {results.map((item, index) => {
              const resultKey = item.url || `${item.title || 'result'}-${index}`
              return (
                <li key={resultKey} className="result-card">
                  <div style={{ flex: 1 }}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="result-title">
                        {item.title || item.url}
                      </a>
                    ) : (
                      <p className="result-title">{item.title || 'Untitled result'}</p>
                    )}
                    <p className="result-snippet">{item.snippet || 'No snippet provided yet.'}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleSummarize(item, resultKey)}
                    disabled={summarizingUrl === resultKey}
                    style={{ marginLeft: '16px' }}
                  >
                    {summarizingUrl === resultKey ? 'Summarizing…' : 'Summarize'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <SummaryModal
        open={summaryModal.open}
        summary={summaryModal.text}
        title={summaryModal.title}
        url={summaryModal.url}
        onClose={closeModal}
      />
    </div>
  )
}

function SummaryModal({ open, summary, title, url, onClose }) {
  if (!open) return null

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Summary</p>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="modal-title">
                {title || url}
              </a>
            ) : (
              <p className="modal-title">{title || 'Summary'}</p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close summary" className="ghost">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>{summary || 'No summary available.'}</p>
        </div>
      </div>
    </div>
  )
}

export default App
