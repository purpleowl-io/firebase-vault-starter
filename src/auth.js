// Signing in and out. Two ways in: an emailed link, or Google. No passwords.

import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, usingEmulators } from './firebase.js'

// Remember which email asked for a link, so the person doesn't retype it when they click it.
const EMAIL_KEY = 'emailForSignIn'

export function watchUser(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function sendSignInLink(email) {
  await sendSignInLinkToEmail(auth, email, {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true,
  })
  window.localStorage.setItem(EMAIL_KEY, email)
}

// Local test mode only: no email is really sent, so ask the Auth emulator for the
// link it would have emailed. Never runs against a real project.
export async function testModeSignInLink(email) {
  if (!usingEmulators) return null
  const res = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-vault/oobCodes')
  const { oobCodes = [] } = await res.json()
  return oobCodes.filter((c) => c.email === email && c.requestType === 'EMAIL_SIGNIN').at(-1)?.oobLink ?? null
}

export function isSignInLink() {
  return isSignInWithEmailLink(auth, window.location.href)
}

export function storedEmail() {
  return window.localStorage.getItem(EMAIL_KEY)
}

export async function completeSignInLink(email) {
  await signInWithEmailLink(auth, email, window.location.href)
  window.localStorage.removeItem(EMAIL_KEY)
  // Remove the one-time code from the address bar so it isn't bookmarked or shared.
  window.history.replaceState(null, '', window.location.pathname)
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function signOutUser() {
  await signOut(auth)
}

// Create the person's folder (users/{uid}) the first time they sign in.
export async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid)
  const existing = await getDoc(ref)
  if (existing.exists()) return
  await setDoc(ref, {
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    createdAt: serverTimestamp(),
  })
}
