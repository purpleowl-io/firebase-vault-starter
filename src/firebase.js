// The only file that starts Firebase. Everything else imports `auth` and `db` from here.
//
// In development (npm run dev) the app talks to the local emulators, never to
// your real project, and the page shows a "Local test mode" banner.
// In a production build it uses the settings from .env.local.

import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

export const usingEmulators =
  import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === 'true'

// In test mode we use a made-up "demo-" project so nothing can reach real data,
// even if .env.local points at your real project.
const config = usingEmulators
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-vault', appId: 'demo-app' }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

const app = initializeApp(config)
export const auth = getAuth(app)
export const db = getFirestore(app)

if (usingEmulators) {
  // Ports match firebase.json.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8181)
}

// Plain-English versions of the Firebase errors people actually hit.
// Anything not listed still shows Firebase's own message, so nothing is hidden.
const messages = {
  'auth/invalid-email': 'That doesn’t look like an email address.',
  'auth/invalid-action-code': 'This sign-in link has expired or was already used. Ask for a new one.',
  'auth/expired-action-code': 'This sign-in link has expired. Ask for a new one.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain':
    'This website’s address isn’t on the approved list in Firebase. Add it under Authentication → Settings → Authorized domains.',
  'auth/unauthorized-continue-uri':
    'This website’s address isn’t on the approved list in Firebase. Add it under Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed':
    'This sign-in method is turned off in Firebase. Turn it on under Authentication → Sign-in method.',
  'auth/network-request-failed': 'Couldn’t reach Firebase. Check your internet connection.',
  'permission-denied': 'The security rules refused this. You can only see and change your own records.',
  unavailable: 'Couldn’t reach the database. Check your internet connection.',
}

export function readableError(error) {
  const code = error?.code ?? ''
  const text = messages[code] ?? error?.message ?? String(error)
  return code ? `${text} (${code})` : text
}
