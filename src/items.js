// Every Firestore read and write for items lives here.
// Items are filed at users/{uid}/items/{itemId}. See docs/SPINE.md.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase.js'

// Limits match firestore.rules. The rules enforce them; these just stop the form early.
export const TITLE_MAX = 200
export const NOTES_MAX = 5000

const itemsIn = (uid) => collection(db, 'users', uid, 'items')

// Calls onChange with the person's items, newest first, and again whenever they change.
// Returns a function that stops listening.
export function watchItems(uid, onChange, onError) {
  const newestFirst = query(itemsIn(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(
    newestFirst,
    (snapshot) =>
      onChange(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
      ),
    onError
  )
}

export function addItem(uid, { title, notes }) {
  return addDoc(itemsIn(uid), {
    title: title.trim(),
    notes: notes.trim(),
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// `changes` may contain title, notes, and/or done.
export function updateItem(uid, itemId, changes) {
  return updateDoc(doc(itemsIn(uid), itemId), { ...changes, updatedAt: serverTimestamp() })
}

export function deleteItem(uid, itemId) {
  return deleteDoc(doc(itemsIn(uid), itemId))
}
