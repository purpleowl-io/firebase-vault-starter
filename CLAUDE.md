# Working in this repo

This is a login-and-database starter. The security rules in `firestore.rules`
are the vault door. Everything else is decoration. Treat them that way.

## Standing rules

- **Never change `firestore.rules` without adding or updating a test that proves the change.** Tests live in `tests/firestore.rules.test.js`. Write the failing test first, then change the rules.
- **Run `npm run test:rules` before saying a rules change is done, and show the output.** If you did not see it pass, it is not done.
- **Never connect development to the production project.** `npm run dev` uses the local emulators (project `demo-vault`). Do not remove the emulator switch in `src/firebase.js` or point dev at a real project.
- **No new dependencies without saying why.** Every package is something else to trust. Explain what it does and why the existing code can't do it.
- **Commit messages say why, not just what.** "Reject titles over 200 chars so one user can't bloat storage" beats "update rules".
- **Data that isn't there can't be stolen.** Don't add fields the feature doesn't need. Every new field needs a type and size limit in the rules and a test.

## Where things are

- `firestore.rules`: who can read and write what. Deny by default.
- `tests/firestore.rules.test.js`: proof the rules do what they say. Test names are plain English and double as documentation.
- `src/firebase.js`: the only file that initializes Firebase; switches to emulators in development.
- `src/auth.js`: sign-in and sign-out. `src/items.js`: every Firestore read and write for items.
- `docs/EXTENDING.md`: the order to follow when adding a new record type (spine, rules, failing tests, passing tests, then screen).

## Out of scope

Roles, admins, teams, sharing between users, Cloud Functions, payments, file uploads, TypeScript, routers, UI libraries. If a request needs one of these, stop and say so before building it.
