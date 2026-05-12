import { useState } from 'react'

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

function validateUsername(value) {
  if (!value) return 'Username is required.'
  if (value.length < 3) return 'At least 3 characters required.'
  if (value.length > 20) return 'Maximum 20 characters.'
  if (!USERNAME_RE.test(value)) return 'Letters, numbers, and underscores only.'
  return ''
}

// Props: { onSignIn, onSignUp, authError, onClose }
export function AuthModal({ onSignIn, onSignUp, authError, onClose }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function switchMode(next) {
    setMode(next)
    setSuccessMessage('')
    setUsernameError('')
  }

  async function handleSubmit() {
    if (mode === 'signup') {
      const err = validateUsername(username)
      if (err) { setUsernameError(err); return }
      if (!email || !password) return
    } else {
      if (!email || !password) return
    }

    setLoading(true)
    setSuccessMessage('')

    if (mode === 'signin') {
      await onSignIn(email, password)
    } else {
      const ok = await onSignUp(email, password, username)
      if (ok) {
        setSuccessMessage('Check your email to confirm your account, then sign in.')
        switchMode('signin')
      }
    }

    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  const canSubmit = mode === 'signin'
    ? email && password
    : username && email && password && !usernameError

  return (
    <>
      <div className="auth-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label={mode === 'signin' ? 'Sign in' : 'Create account'}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 style={{ marginBottom: '4px' }}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="auth-sub">
          {mode === 'signin'
            ? 'Sign in to sync your collection across devices.'
            : 'Free account — your collection stays safe across devices.'}
        </p>

        {successMessage && <p className="auth-success">{successMessage}</p>}
        {authError && <p className="auth-error">{authError}</p>}

        {/* Username — sign-up only */}
        {mode === 'signup' && (
          <>
            <label className="auth-label" htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              type="text"
              className="auth-input"
              value={username}
              onChange={(e) => {
                const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                setUsername(val)
                setUsernameError(val ? validateUsername(val) : '')
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. giants_collector"
              maxLength={20}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
            {usernameError
              ? <p className="auth-error" style={{ marginTop: '-2px' }}>{usernameError}</p>
              : <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-2px' }}>
                  3–20 chars · letters, numbers, underscores
                  {username.length > 0 && <span style={{ marginLeft: '8px' }}>{username.length}/20</span>}
                </p>
            }
          </>
        )}

        <label className="auth-label" htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          className="auth-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus={mode === 'signin'}
        />

        <label className="auth-label" htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          className="auth-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />

        <button
          type="button"
          className="btn btn-dark auth-submit"
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <p className="auth-switch">
          {mode === 'signin' ? (
            <>No account?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
                Create one
              </button>
            </>
          ) : (
            <>Already have one?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </>
  )
}