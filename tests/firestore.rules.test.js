// Proof that the security rules in firestore.rules do what they promise.
// Run with: npm run test:rules
//
// Each test name is a plain-English sentence about what the rules guarantee.
// docs/SECURITY.md mirrors these names. If you change a rule, change or add
// the test that proves it, and watch it fail before you make it pass.

import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

let env

// Alice and Bob are two ordinary signed-in users.
const alice = () => env.authenticatedContext('alice').firestore()
const bob = () => env.authenticatedContext('bob').firestore()
const stranger = () => env.unauthenticatedContext().firestore()

// A valid new item, stamped with the server clock as the rules require.
const newItem = (overrides = {}) => ({
  title: 'Call the supplier',
  notes: 'Ask about the March invoice',
  done: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
})

const newProfile = (overrides = {}) => ({
  displayName: 'Alice',
  email: 'alice@example.com',
  createdAt: serverTimestamp(),
  ...overrides,
})

// Put data in place without going through the rules, to set up a scenario.
async function seed(path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data)
  })
}

const seededItem = () => ({
  title: 'Existing item',
  notes: '',
  done: false,
  createdAt: Timestamp.fromDate(new Date('2025-01-01')),
  updatedAt: Timestamp.fromDate(new Date('2025-01-01')),
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-vault',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed('users/alice', { displayName: 'Alice', email: 'alice@example.com', createdAt: Timestamp.now() })
  await seed('users/alice/items/a1', seededItem())
  await seed('users/bob', { displayName: 'Bob', email: 'bob@example.com', createdAt: Timestamp.now() })
  await seed('users/bob/items/b1', seededItem())
})

afterAll(async () => {
  await env?.cleanup()
})

describe('1. Signed-out visitors', () => {
  test('a signed-out visitor cannot read anyone’s profile', async () => {
    await assertFails(getDoc(doc(stranger(), 'users/alice')))
  })

  test('a signed-out visitor cannot read or list anyone’s items', async () => {
    await assertFails(getDoc(doc(stranger(), 'users/alice/items/a1')))
    await assertFails(getDocs(collection(stranger(), 'users/alice/items')))
  })

  test('a signed-out visitor cannot create, change, or delete anything', async () => {
    await assertFails(setDoc(doc(stranger(), 'users/alice/items/new'), newItem()))
    await assertFails(updateDoc(doc(stranger(), 'users/alice/items/a1'), { done: true, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(stranger(), 'users/alice/items/a1')))
    await assertFails(setDoc(doc(stranger(), 'users/nobody'), newProfile()))
  })
})

describe('2. Your own items', () => {
  test('you can add an item to your own folder', async () => {
    await assertSucceeds(addDoc(collection(alice(), 'users/alice/items'), newItem()))
  })

  test('you can open one of your own items', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/items/a1')))
  })

  test('you can list all of your own items', async () => {
    await assertSucceeds(getDocs(collection(alice(), 'users/alice/items')))
  })

  test('you can edit your own item', async () => {
    await assertSucceeds(
      updateDoc(doc(alice(), 'users/alice/items/a1'), {
        title: 'Renamed',
        done: true,
        updatedAt: serverTimestamp(),
      })
    )
  })

  test('you can delete your own item', async () => {
    await assertSucceeds(deleteDoc(doc(alice(), 'users/alice/items/a1')))
  })
})

describe('3. Someone else’s items', () => {
  test('a stranger cannot read your items', async () => {
    await assertFails(getDoc(doc(bob(), 'users/alice/items/a1')))
  })

  test('a stranger cannot list your items', async () => {
    await assertFails(getDocs(collection(bob(), 'users/alice/items')))
  })

  test('a stranger cannot change your items', async () => {
    await assertFails(
      updateDoc(doc(bob(), 'users/alice/items/a1'), { title: 'Hacked', updatedAt: serverTimestamp() })
    )
  })

  test('a stranger cannot delete your items', async () => {
    await assertFails(deleteDoc(doc(bob(), 'users/alice/items/a1')))
  })

  test('nobody can search everyone’s items at once', async () => {
    await assertFails(getDocs(collectionGroup(alice(), 'items')))
  })
})

describe('4. Filing into someone else’s folder', () => {
  test('a stranger cannot add an item to your folder', async () => {
    await assertFails(addDoc(collection(bob(), 'users/alice/items'), newItem()))
  })

  test('a stranger cannot create a profile in your name', async () => {
    await env.clearFirestore()
    await assertFails(setDoc(doc(bob(), 'users/alice'), newProfile()))
  })
})

describe('5. Items must have the right shape', () => {
  const create = (data) => addDoc(collection(alice(), 'users/alice/items'), data)

  test('an item with an extra field is rejected', async () => {
    await assertFails(create(newItem({ secretNote: 'extra' })))
  })

  test('an item missing a field is rejected', async () => {
    const { notes, ...withoutNotes } = newItem()
    await assertFails(create(withoutNotes))
  })

  test('an item with the wrong type of value is rejected', async () => {
    await assertFails(create(newItem({ done: 'yes' })))
    await assertFails(create(newItem({ title: 42 })))
  })

  test('an item with an empty title is rejected', async () => {
    await assertFails(create(newItem({ title: '' })))
  })

  test('an item with a title over 200 characters is rejected', async () => {
    await assertSucceeds(create(newItem({ title: 'x'.repeat(200) })))
    await assertFails(create(newItem({ title: 'x'.repeat(201) })))
  })

  test('an item with notes over 5000 characters is rejected', async () => {
    await assertSucceeds(create(newItem({ notes: 'x'.repeat(5000) })))
    await assertFails(create(newItem({ notes: 'x'.repeat(5001) })))
  })

  test('an edit that adds an extra field is rejected', async () => {
    await assertFails(
      updateDoc(doc(alice(), 'users/alice/items/a1'), { secretNote: 'extra', updatedAt: serverTimestamp() })
    )
  })
})

describe('6. Timestamps come from the server', () => {
  const create = (data) => addDoc(collection(alice(), 'users/alice/items'), data)

  test('an item cannot be backdated with a made-up creation time', async () => {
    await assertFails(create(newItem({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })))
  })

  test('an item cannot be created with a made-up update time', async () => {
    await assertFails(create(newItem({ updatedAt: Timestamp.fromDate(new Date('2020-01-01')) })))
  })

  test('an edit must stamp the update time from the server', async () => {
    await assertFails(
      updateDoc(doc(alice(), 'users/alice/items/a1'), {
        title: 'Renamed',
        updatedAt: Timestamp.fromDate(new Date('2020-01-01')),
      })
    )
    await assertFails(updateDoc(doc(alice(), 'users/alice/items/a1'), { title: 'Renamed without a stamp' }))
  })

  test('a profile cannot be backdated with a made-up creation time', async () => {
    await env.clearFirestore()
    await assertFails(
      setDoc(doc(alice(), 'users/alice'), newProfile({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) }))
    )
  })
})

describe('7. Creation time is permanent', () => {
  test('an edit cannot change when an item was created', async () => {
    await assertFails(
      updateDoc(doc(alice(), 'users/alice/items/a1'), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    )
  })

  test('an edit cannot change when a profile was created', async () => {
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { createdAt: serverTimestamp() }))
  })
})

describe('8. Profiles are private', () => {
  test('you can create and read your own profile', async () => {
    await env.clearFirestore()
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), newProfile()))
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')))
  })

  test('you can update your own display name', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { displayName: 'Alice B.' }))
  })

  test('a stranger cannot read your profile', async () => {
    await assertFails(getDoc(doc(bob(), 'users/alice')))
  })

  test('a stranger cannot change your profile', async () => {
    await assertFails(updateDoc(doc(bob(), 'users/alice'), { displayName: 'Hacked' }))
  })

  test('nobody can list all the users', async () => {
    await assertFails(getDocs(collection(alice(), 'users')))
  })

  test('a profile with an extra field is rejected', async () => {
    await env.clearFirestore()
    await assertFails(setDoc(doc(alice(), 'users/alice'), newProfile({ role: 'admin' })))
  })
})

describe('9. Everything else is locked', () => {
  test('a collection the rules don’t mention cannot be read or written, even by a signed-in user', async () => {
    await seed('invoices/inv1', { amount: 100 })
    await assertFails(getDoc(doc(alice(), 'invoices/inv1')))
    await assertFails(getDocs(collection(alice(), 'invoices')))
    await assertFails(setDoc(doc(alice(), 'invoices/inv2'), { amount: 5 }))
  })

  test('an unknown folder inside your own profile is still locked', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/secrets/s1'), { anything: true }))
    await assertFails(getDocs(collection(alice(), 'users/alice/secrets')))
  })
})
