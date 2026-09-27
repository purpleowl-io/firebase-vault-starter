# Adding your own record type

"Items" is a placeholder. Replace it with whatever your business tracks: jobs, quotes, clients, inspections, orders.

Do it in this order. The order is the point: the lock goes on before the door does.

1. **Draw the spine.** Write down, in plain words, what one record holds, where it's filed, and who may see it. Fields, types, size limits. Leave out anything the feature doesn't need; data that isn't there can't be stolen. Update [SPINE.md](SPINE.md).
2. **Write the rules.** Add the new collection to `firestore.rules`, with a `valid...()` helper that allows exactly your fields.
3. **Write the failing tests.** Add tests to `tests/firestore.rules.test.js` that say, in plain English, what must and must not be allowed. Run `npm run test:rules` *before* the rules are finished and watch the new tests fail. A test you've never seen fail proves nothing.
4. **Make them pass.** Finish the rules until `npm run test:rules` is all green.
5. **Build the screen.** Only now change the app: a new file like `src/items.js` for the reads and writes, and a screen like `src/ItemList.jsx`.

Then publish with `npm run deploy`.

## Keep it simple

The easiest safe change is a new record type filed inside each person's folder, exactly like items: `users/{uid}/jobs/{jobId}`. Ownership is the path, so you can copy the `items` rules and tests and change the fields.

Anything where two people see the same record (sharing, teams, a manager who sees everyone's jobs) is a different kind of problem. Stop and plan it properly first; see "Not included" in the [README](../README.md).

## A prompt for Claude

Copy this into Claude Code, fill in the first paragraph, and let it work. It tells Claude to follow the order above and to show you the proof.

```
I want to replace the example "items" in this app with my own record type.

What I want to track: <describe it in plain words, e.g. "jobs for my
cleaning business: the client's name, the address, the date, the price,
and whether it's been paid">. Each person should only see their own.

Follow this order and stop after each step to show me what you did:

1. Spine: propose the fields, types, and size limits, filed under
   users/{uid}/<name>/{id}. Only fields I actually need. Update
   docs/SPINE.md. Wait for me to agree before going on.
2. Rules: add the collection to firestore.rules with a valid...() helper
   that allows exactly those fields, server timestamps, and the same
   owner check as items. Keep hasProvenEmail() in isOwner.
3. Failing tests: add plain-English tests to
   tests/firestore.rules.test.js covering the same ground as the items
   tests (owner can create/read/list/update/delete; a stranger can't;
   wrong shape, extra fields, and made-up timestamps are rejected).
   Run npm run test:rules and show me the new tests failing before the
   rules are complete.
4. Pass: finish the rules, run npm run test:rules, and show me the
   full output with everything passing.
5. Screen: only now change the app. Put every Firestore read and write
   for the new type in one file like src/items.js, and the screen in
   one component like src/ItemList.jsx. Remove the old items code,
   rules, and tests once the new ones pass.

Follow CLAUDE.md. Don't add new packages without asking. Don't touch
the emulator switch in src/firebase.js.
```

## Checking Claude's work

You don't need to read the code to check the important part:

- Ask Claude to show the output of `npm run test:rules`. Every line should have a green tick, and the new test names should read like promises you agree with.
- Ask Claude to loosen one of the new rules on purpose and show a test failing, then put it back. If nothing fails, the tests aren't protecting anything.
- Try it: `npm run dev`, sign in as two different people (one in a private window), and check that neither sees the other's records.
