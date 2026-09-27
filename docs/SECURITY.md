# Security: what this protects, and what it doesn't

The security rules in [`firestore.rules`](../firestore.rules) decide who can read and write what. Firebase enforces them on its servers, so they hold no matter what code runs in someone's browser. Every promise below is checked by an automated test in [`tests/firestore.rules.test.js`](../tests/firestore.rules.test.js). The headings and sentences below are the test names. Run `npm run test:rules` to watch them pass.

## What the rules guarantee

**1. Signed-out visitors**
- A signed-out visitor cannot read anyone's profile.
- A signed-out visitor cannot read or list anyone's items.
- A signed-out visitor cannot create, change, or delete anything.

**2. Your own items**
- You can add an item to your own folder.
- You can open one of your own items.
- You can list all of your own items.
- You can edit your own item.
- You can delete your own item.

**3. Someone else's items**
- A stranger cannot read your items.
- A stranger cannot list your items.
- A stranger cannot change your items.
- A stranger cannot delete your items.
- Nobody can search everyone's items at once.

**4. Filing into someone else's folder**
- A stranger cannot add an item to your folder.
- A stranger cannot create a profile in your name.

**5. Items must have the right shape**
- An item with an extra field is rejected.
- An item missing a field is rejected.
- An item with the wrong type of value is rejected.
- An item with an empty title is rejected.
- An item with a title over 200 characters is rejected.
- An item with notes over 5000 characters is rejected.
- An edit that adds an extra field is rejected.

**6. Timestamps come from the server**
- An item cannot be backdated with a made-up creation time.
- An item cannot be created with a made-up update time.
- An edit must stamp the update time from the server.
- A profile cannot be backdated with a made-up creation time.

**7. Creation time is permanent**
- An edit cannot change when an item was created.
- An edit cannot change when a profile was created.

**8. Profiles are private**
- You can create and read your own profile.
- You can update your own display name.
- A stranger cannot read your profile.
- A stranger cannot change your profile.
- Nobody can list all the users.
- A profile with an extra field is rejected.

**9. Everything else is locked**
- A collection the rules don't mention cannot be read or written, even by a signed-in user.
- An unknown folder inside your own profile is still locked.

**10. An unproven email opens nothing**
- Someone who hasn't proven they own the email address cannot read the items in that folder.
- Someone who hasn't proven they own the email address cannot add, change, or delete anything.

The tests have also been checked the other way round: loosening any of these rules on purpose makes at least one test fail. A test that can't fail proves nothing.

### Why promise 10 exists

Firebase only allows email-link sign-in when its "Email/Password" option is switched on. That means someone could, in principle, use Firebase's public sign-up address to create a *password* account for an email that isn't theirs, even though this app never shows a password box. We tested this on a real project: when the real owner later signs in by email link, Firebase wipes that password. But anyone who planned ahead could still have slipped in records beforehand, or kept access for up to an hour.

Signing in by email link or with Google proves you own the address; a planted password account never has. So the rules only open a folder for someone whose email is proven. That closes the gap completely.

## "Isn't my Firebase config a secret?"

No. The values in `.env.local` (the "API key", project ID and so on) end up in the website that every visitor downloads. They only tell the browser *which* Firebase project to talk to, like the address on an envelope. They don't grant access to anything.

What protects the data is the security rules. That's why this repo spends its effort on the rules and their tests rather than on hiding the config. (`.env.local` is still kept out of git so that each copy of the app points at its owner's own project.)

## If the worst happens: what would an attacker have?

Assume something is compromised. What does the attacker get?

- **One person's login (their Google account or email inbox):** that person's folder. Their profile and their items, nothing else. Every other folder stays locked.
- **The website itself (someone tampers with the published app):** the site can't grant itself more access than the rules allow. But tampered code runs *as* whoever is signed in, so it could read or change the folder of each person who uses it while it's tampered with. Only people you trust should be able to run `npm run deploy`, which means only people you add to the Firebase project.
- **The Google account that owns the Firebase project:** everything. That account can open the database in the console, change the rules, and export all the data. **Protect it like a bank account:** turn on 2-Step Verification (or a passkey) at [myaccount.google.com/security](https://myaccount.google.com/security), and don't share it; add colleagues as separate project members instead.
- **The config values in `.env.local`:** nothing. See above.

## What this starter does not protect against

- **A person's own email or Google account being taken over.** Whoever controls the inbox can sign in as that person. That's true of any passwordless or Google sign-in.
- **Anything you add without rules and tests.** New collections are locked by default ("everything else is locked"). The moment you open one up, only the rules you write protect it. Follow [EXTENDING.md](EXTENDING.md): write the rules and the failing tests *before* the screen.
- **Automated abuse of sign-up.** Firebase limits new accounts to 100 per hour per internet address, and only 5 sign-in emails a day on the free plan. Firebase App Check can add bot protection; it's not included here (see the README).
- **Mistakes in the Firebase console.** Rules changed by hand in the console aren't tested. Change `firestore.rules` in the code, run the tests, then `npm run deploy`, which overwrites anything changed in the console.
