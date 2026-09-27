import { useEffect, useState } from 'react'
import { ensureProfile, signOutUser, watchUser } from './auth.js'
import { readableError, usingEmulators } from './firebase.js'
import SignIn from './SignIn.jsx'

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking, null = signed out
  const [error, setError] = useState('')

  useEffect(() => watchUser(setUser), [])

  useEffect(() => {
    if (user) ensureProfile(user).catch((e) => setError(readableError(e)))
  }, [user])

  async function signOut() {
    try {
      await signOutUser()
    } catch (e) {
      setError(readableError(e))
    }
  }

  return (
    <>
      {usingEmulators && <div className="banner">Local test mode: data is not real</div>}
      <header className="top">
        <h1>My Vault</h1>
        {user && (
          <div className="who">
            <span>{user.email}</span>
            <button className="secondary" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      <main className="page">
        {error && <p className="error">{error}</p>}
        {user === undefined && <p>Loading…</p>}
        {user === null && <SignIn />}
        {user && <p>Signed in.</p>}
      </main>
    </>
  )
}
