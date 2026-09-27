import { useEffect, useRef, useState } from 'react'
import {
  completeSignInLink,
  isSignInLink,
  sendSignInLink,
  signInWithGoogle,
  storedEmail,
} from './auth.js'
import { readableError, usingEmulators } from './firebase.js'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | confirm | finishing
  const [error, setError] = useState('')
  const started = useRef(false)

  // If we arrived here by clicking an emailed link, finish signing in.
  useEffect(() => {
    if (started.current || !isSignInLink()) return
    started.current = true
    const saved = storedEmail()
    if (saved) finish(saved)
    else setStatus('confirm') // Opened in a different browser: ask which email it was.
  }, [])

  async function finish(address) {
    setStatus('finishing')
    setError('')
    try {
      await completeSignInLink(address)
    } catch (e) {
      setError(readableError(e))
      setStatus('confirm')
    }
  }

  async function sendLink(event) {
    event.preventDefault()
    setStatus('sending')
    setError('')
    try {
      await sendSignInLink(email.trim())
      setStatus('sent')
    } catch (e) {
      setError(readableError(e))
      setStatus('idle')
    }
  }

  async function google() {
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(readableError(e))
    }
  }

  if (status === 'finishing') {
    return <section className="card"><p>Signing you in…</p></section>
  }

  if (status === 'confirm') {
    return (
      <section className="card">
        <h2>Confirm your email</h2>
        <p>You opened the sign-in link in a different browser. Type the email address you asked for the link with.</p>
        {error && <p className="error">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); finish(email.trim()) }}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button type="submit">Sign in</button>
        </form>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Sign in</h2>
      <p>Your records are private. Only you can see them once you sign in.</p>
      {error && <p className="error">{error}</p>}

      {status === 'sent' ? (
        <div className="notice">
          <p>Check your email. We sent a sign-in link to <strong>{email}</strong>.</p>
          {usingEmulators && (
            <p>
              Local test mode: no real email is sent. Open the{' '}
              <a href="http://127.0.0.1:4000/auth" target="_blank" rel="noreferrer">emulator page</a>{' '}
              or look in the terminal running <code>npm run dev</code> for the link.
            </p>
          )}
          <button className="link" onClick={() => setStatus('idle')}>Use a different email</button>
        </div>
      ) : (
        <form onSubmit={sendLink}>
          <label htmlFor="email">Email me a sign-in link</label>
          <div className="row">
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send link'}
            </button>
          </div>
        </form>
      )}

      <div className="divider"><span>or</span></div>
      <button className="google" onClick={google}>Continue with Google</button>
    </section>
  )
}
