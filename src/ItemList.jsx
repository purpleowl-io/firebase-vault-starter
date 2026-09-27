import { useEffect, useState } from 'react'
import { readableError } from './firebase.js'
import { NOTES_MAX, TITLE_MAX, addItem, deleteItem, updateItem, watchItems } from './items.js'

export default function ItemList({ user }) {
  const [items, setItems] = useState(null) // null = still loading
  const [error, setError] = useState('')

  useEffect(
    () => watchItems(user.uid, setItems, (e) => setError(readableError(e))),
    [user.uid]
  )

  // Run a save/delete and show any error instead of hiding it.
  async function attempt(action) {
    setError('')
    try {
      await action()
      return true
    } catch (e) {
      setError(readableError(e))
      return false
    }
  }

  return (
    <>
      <AddItem onAdd={(fields) => attempt(() => addItem(user.uid, fields))} />
      {error && <p className="error">{error}</p>}
      {items === null && <p>Loading your items…</p>}
      {items?.length === 0 && <p className="empty">Nothing here yet. Add your first item above.</p>}
      <ul className="items">
        {items?.map((item) => (
          <Item
            key={item.id}
            item={item}
            onSave={(changes) => attempt(() => updateItem(user.uid, item.id, changes))}
            onDelete={() => attempt(() => deleteItem(user.uid, item.id))}
          />
        ))}
      </ul>
    </>
  )
}

function AddItem({ onAdd }) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    const ok = await onAdd({ title, notes })
    setSaving(false)
    if (ok) {
      setTitle('')
      setNotes('')
    }
  }

  return (
    <form className="card add" onSubmit={submit}>
      <label htmlFor="new-title">Add an item</label>
      <input id="new-title" type="text" required maxLength={TITLE_MAX} value={title}
        onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
      <textarea aria-label="Notes" maxLength={NOTES_MAX} value={notes}
        onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
      <div className="actions">
        <button type="submit" disabled={saving || !title.trim()}>{saving ? 'Adding…' : 'Add'}</button>
      </div>
    </form>
  )
}

function Item({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [notes, setNotes] = useState(item.notes)

  function startEditing() {
    setTitle(item.title)
    setNotes(item.notes)
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    if (await onSave({ title: title.trim(), notes: notes.trim() })) setEditing(false)
  }

  function confirmDelete() {
    if (window.confirm(`Delete “${item.title}”? This can’t be undone.`)) onDelete()
  }

  if (editing) {
    return (
      <li className="item">
        <form className="add" onSubmit={save}>
          <input type="text" aria-label="Title" required maxLength={TITLE_MAX} value={title}
            onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea aria-label="Notes" maxLength={NOTES_MAX} value={notes}
            onChange={(e) => setNotes(e.target.value)} />
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" disabled={!title.trim()}>Save</button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={item.done ? 'item done' : 'item'}>
      <div className="item-main">
        <input type="checkbox" checked={item.done} aria-label={`Mark “${item.title}” done`}
          onChange={() => onSave({ done: !item.done })} />
        <div className="item-text">
          <div className="item-title">{item.title}</div>
          {item.notes && <div className="item-notes">{item.notes}</div>}
        </div>
      </div>
      <div className="actions">
        <button className="secondary" onClick={startEditing}>Edit</button>
        <button className="danger" onClick={confirmDelete}>Delete</button>
      </div>
    </li>
  )
}
