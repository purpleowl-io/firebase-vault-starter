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
import { auth, db } from './firebase.js'

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
