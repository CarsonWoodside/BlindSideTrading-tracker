import { useState } from 'react'

export function AuthModal({ onSignIn, onSignUp, authError, onClose }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit() {
    if (!email || !password) return
    setLoading(true)
    setSuccessMessage('')

    if (mode === 'signin') {
      await onSignIn(email, password)
    } else {
      const ok = await onSignUp(email, password)
      if (ok) {
        setSuccessMessage('Check your email to confirm your account, then sign in.')
        setMode('signin')
      }
    }

    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  return (
    <>
      <div className="auth-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Sign in">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 style={{ marginBottom: '4px' }}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="auth-sub">
          {mode === 'signin'
            ? 'Sign in to sync your collection across devices.'
            : 'Free account — your collection stays safe across devices.'}
        </p>

        {successMessage && (
          <p className="auth-success">{successMessage}</p>
        )}

        {authError && (
          <p className="auth-error">{authError}</p>
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
          autoFocus
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
          disabled={loading || !email || !password}
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <p className="auth-switch">
          {mode === 'signin' ? (
            <>No account?{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('signup'); setSuccessMessage('') }}>
                Create one
              </button>
            </>
          ) : (
            <>Already have one?{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('signin'); setSuccessMessage('') }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </>
  )
}