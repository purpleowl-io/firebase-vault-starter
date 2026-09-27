#!/usr/bin/env node
// npm run setup
//
// Sets up a real Firebase project for this app, doing every step that can be
// done from the command line. Safe to run again: steps that are already done
// are skipped. If a step can't be automated on your account, it tells you
// exactly what to click instead (with pictures in docs/SETUP.md).
//
// Uses only Node's built-in modules plus the Firebase CLI that `npm install`
// already put in node_modules.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const firebaseBin = join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js')
const PLACEHOLDER_ID = 'your-project-id'
const TOTAL = 7

const bold = (s) => `\x1b[1m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

// Answers are queued so nothing is lost if several are typed (or pasted) ahead.
const rl = createInterface({ input: process.stdin, output: process.stdout })
const lines = []
const waiting = []
rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)))
// If input ends (Ctrl+D, or a script ran out of answers), stop rather than guess.
let inputEnded = false
rl.on('close', () => {
  inputEnded = true
  if (waiting.length) {
    console.log(red('\n\nSetup stopped: no answer given. Run `npm run setup` again when ready.'))
    process.exit(1)
  }
})
const ask = async (question, fallback = '') => {
  process.stdout.write(`${question}${fallback ? dim(` [${fallback}]`) : ''} `)
  if (!lines.length && inputEnded) {
    console.log(red('\n\nSetup stopped: no answer given. Run `npm run setup` again when ready.'))
    process.exit(1)
  }
  const line = lines.length ? lines.shift() : await new Promise((resolve) => waiting.push(resolve))
  const answer = line.trim()
  if (!process.stdin.isTTY) process.stdout.write(`${answer}\n`)
  return answer || fallback
}
const yes = async (question, fallback = 'y') => (await ask(`${question} (y/n)`, fallback)).toLowerCase().startsWith('y')

function step(n, title) {
  console.log(`\n${bold(`Step ${n} of ${TOTAL}: ${title}`)}`)
}
const ok = (msg) => console.log(`  ${green('✔')} ${msg}`)
const warn = (msg) => console.log(`  ${yellow('!')} ${msg}`)
const info = (msg) => console.log(`  ${msg}`)

function manual(title, lines, doc) {
  console.log(`\n  ${yellow('Do this one by hand:')} ${bold(title)}`)
  lines.forEach((line, i) => console.log(`    ${i + 1}. ${line}`))
  if (doc) console.log(`    Pictures of each click: ${bold(`docs/SETUP.md#${doc}`)}`)
}

// Run the Firebase CLI and return its --json result.
function firebaseJson(args) {
  const run = spawnSync(process.execPath, ['--no-deprecation', firebaseBin, ...args, '--json', '--non-interactive'], {
    cwd: root,
    encoding: 'utf8',
  })
  let parsed
  try {
    parsed = JSON.parse(run.stdout)
  } catch {
    throw new Error((run.stderr || run.stdout || 'The Firebase CLI gave no answer.').trim())
  }
  if (parsed.status !== 'success') throw new Error(parsed.error || JSON.stringify(parsed))
  return parsed.result
}

// Run the Firebase CLI with its normal output shown to the person.
function firebaseLive(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--no-deprecation', firebaseBin, ...args], { cwd: root, stdio: 'inherit' })
    child.on('exit', (code) => resolve(code === 0))
  })
}

function javaMajorVersion() {
  const run = spawnSync('java', ['-version'], { encoding: 'utf8' })
  if (run.error) return null
  const match = `${run.stderr}${run.stdout}`.match(/version "(\d+)(?:\.(\d+))?/)
  if (!match) return null
  return match[1] === '1' ? Number(match[2]) : Number(match[1])
}

function readProjectId() {
  try {
    const id = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8')).projects?.default
    return id && id !== PLACEHOLDER_ID ? id : null
  } catch {
    return null
  }
}

function saveProjectId(id) {
  writeFileSync(join(root, '.firebaserc'), JSON.stringify({ projects: { default: id } }, null, 2) + '\n')
}

function makeProjectId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'my-vault'
  const suffix = Math.random().toString(36).slice(2, 7)
  const id = `${slug}-${suffix}`
  return /^[a-z]/.test(id) ? id : `app-${id}`.slice(0, 30)
}

// Use the Firebase CLI's own login to call a Google API directly.
async function googleApi(method, url, body) {
  const { requireAuth } = require('firebase-tools/lib/requireAuth')
  const { Client } = require('firebase-tools/lib/apiv2')
  await requireAuth({})
  const u = new URL(url)
  const client = new Client({ urlPrefix: u.origin, auth: true })
  const res = await client.request({
    method,
    path: u.pathname,
    queryParams: Object.fromEntries(u.searchParams),
    body,
    headers: { 'x-goog-user-project': url.match(/projects\/([^/]+)/)?.[1] },
  })
  return res.body
}

// New projects have most Google APIs switched off. Switch one on and wait until it's ready.
async function enableApi(projectId, service) {
  const base = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${service}`
  const current = await googleApi('GET', base)
  if (current.state === 'ENABLED') return
  await googleApi('POST', `${base}:enable`)
  for (let i = 0; i < 60; i++) {
    if ((await googleApi('GET', base)).state === 'ENABLED') return
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Timed out switching on ${service}`)
}

async function main() {
  console.log(bold('\nFirebase setup for your vault app'))
  console.log('This connects the app to a real Firebase project so you can put it on the internet.')
  console.log(dim('You can stop at any time with Ctrl+C and run `npm run setup` again later.'))

  // 1. The computer
  step(1, 'Checking your computer')
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (nodeMajor < 20) {
    console.log(red(`  Node.js ${process.versions.node} is too old. Install version 20 or newer from https://nodejs.org and try again.`))
    process.exit(1)
  }
  ok(`Node.js ${process.versions.node}`)
  if (!existsSync(firebaseBin)) {
    console.log(red('  The Firebase tools are missing. Run `npm install` first, then `npm run setup` again.'))
    process.exit(1)
  }
  ok('Firebase tools installed')
  const java = javaMajorVersion()
  if (java && java >= 21) ok(`Java ${java}`)
  else {
    warn(java ? `Java ${java} is too old; the local test database needs Java 21 or newer.` : 'Java is not installed; the local test database needs Java 21 or newer.')
    info('Setup can continue without it, but `npm run dev` and `npm run test:rules` need it.')
    info('How to install it: docs/SETUP.md#install-java')
  }

  // 2. Firebase login
  step(2, 'Signing in to Firebase')
  let account
  try {
    account = firebaseJson(['login:list'])?.[0]?.user?.email
  } catch {}
  if (!account) {
    info('A browser window will open. Choose your Google account and click Allow.')
    info(dim('(If no browser opens, copy the long link it prints into your browser.)'))
    await firebaseLive(['login'])
    account = firebaseJson(['login:list'])?.[0]?.user?.email
  }
  if (!account) {
    console.log(red('  Not signed in. Run `npm run setup` again to retry.'))
    process.exit(1)
  }
  ok(`Signed in as ${account}`)

  // 3. Project
  step(3, 'Your Firebase project')
  let projectId = readProjectId()
  if (projectId && !(await yes(`  This folder is already connected to ${bold(projectId)}. Keep using it?`))) projectId = null
  if (!projectId) {
    // No default here: creating a project should always be a deliberate "y".
    let createNew
    while (createNew === undefined) {
      const answer = (await ask('  Create a brand-new Firebase project for this app? Type y, or n to pick one you already have:')).toLowerCase()
      if (answer.startsWith('y')) createNew = true
      else if (answer.startsWith('n')) createNew = false
    }
    if (createNew) {
      const name = await ask('  What should the project be called?', 'My Vault')
      projectId = makeProjectId(name)
      info(`Creating ${bold(projectId)}. This takes about a minute…`)
      try {
        firebaseJson(['projects:create', projectId, '--display-name', name.slice(0, 30)])
      } catch (e) {
        console.log(red(`  Couldn't create the project: ${e.message}`))
        manual('Accept the Firebase terms, or free up a project slot', [
          'Open https://console.firebase.google.com and sign in with the same Google account.',
          'If it asks you to accept terms, accept them. If it says you have too many projects, delete one you no longer use.',
          'Come back here and run `npm run setup` again.',
        ], 'if-creating-the-project-fails')
        process.exit(1)
      }
    } else {
      const projects = firebaseJson(['projects:list'])
      if (!projects.length) {
        console.log(red('  You have no Firebase projects yet. Run setup again and answer y to create one.'))
        process.exit(1)
      }
      projects.forEach((p, i) => info(`${i + 1}. ${p.displayName} ${dim(`(${p.projectId})`)}`))
      const pick = Number(await ask('  Which number?')) - 1
      projectId = projects[pick]?.projectId
      if (!projectId) {
        console.log(red('  That number is not on the list. Run setup again.'))
        process.exit(1)
      }
    }
    saveProjectId(projectId)
  }
  ok(`Using project ${bold(projectId)}`)
  const P = ['--project', projectId]

  // 4. Web app + .env.local
  step(4, 'Registering the web app and saving its settings')
  let app = firebaseJson(['apps:list', 'WEB', ...P])[0]
  if (app) ok(`Found web app "${app.displayName}"`)
  else {
    app = firebaseJson(['apps:create', 'WEB', 'Vault web app', ...P])
    ok('Registered a web app')
  }
  const sdk = firebaseJson(['apps:sdkconfig', 'WEB', app.appId, ...P])
  const cfg = sdk.sdkConfig ?? sdk
  const env = [
    '# Written by `npm run setup`. These identify your Firebase project; they are not secrets.',
    '# See docs/SECURITY.md. This file is not committed to git.',
    `VITE_FIREBASE_API_KEY=${cfg.apiKey}`,
    `VITE_FIREBASE_AUTH_DOMAIN=${cfg.authDomain}`,
    `VITE_FIREBASE_PROJECT_ID=${cfg.projectId}`,
    `VITE_FIREBASE_STORAGE_BUCKET=${cfg.storageBucket ?? ''}`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID=${cfg.messagingSenderId}`,
    `VITE_FIREBASE_APP_ID=${cfg.appId}`,
    'VITE_USE_EMULATORS=',
    '',
  ].join('\n')
  writeFileSync(join(root, '.env.local'), env)
  ok('Saved the settings to .env.local')

  // 5. Firestore database
  step(5, 'Creating the database')
  await enableApi(projectId, 'firestore.googleapis.com')
  const databases = firebaseJson(['firestore:databases:list', ...P]) ?? []
  if (databases.some((d) => d.name?.endsWith('/(default)'))) ok('Database already exists')
  else {
    info('Where are most of your users? The database lives there. This cannot be changed later.')
    info('  1. United States   2. Europe   3. Asia (Tokyo)   4. Australia (Sydney)')
    const locations = { 1: 'nam5', 2: 'eur3', 3: 'asia-northeast1', 4: 'australia-southeast1' }
    const location = locations[await ask('  Pick a number', '1')] ?? 'nam5'
    try {
      firebaseJson(['firestore:databases:create', '(default)', '--location', location, ...P])
      ok(`Database created (${location})`)
    } catch (e) {
      warn(`Couldn't create the database: ${e.message}`)
      manual('Create the Firestore database', [
        `Open https://console.firebase.google.com/project/${projectId}/firestore`,
        'Click "Create database". Pick a location near your users. Choose "Start in production mode".',
        'Run `npm run setup` again.',
      ], 'create-the-database-by-hand')
      process.exit(1)
    }
  }

  // 6. Sign-in methods
  step(6, 'Turning on sign-in (Google and email link)')
  const authPage = `https://console.firebase.google.com/project/${projectId}/authentication/providers`
  let googleOn = false
  let emailLinkOn = false
  await enableApi(projectId, 'identitytoolkit.googleapis.com')
  try {
    // Official Firebase CLI path: `firebase deploy --only auth` with a temporary config,
    // so your firebase.json stays free of personal details.
    const dir = mkdtempSync(join(tmpdir(), 'vault-auth-'))
    const configPath = join(dir, 'firebase.json')
    const supportEmail = await ask('  Support email shown on the Google sign-in screen?', account)
    writeFileSync(configPath, JSON.stringify({
      auth: {
        providers: {
          emailPassword: true,
          googleSignIn: { oAuthBrandDisplayName: sdk.projectId ?? projectId, supportEmail },
        },
      },
    }))
    const deployed = firebaseJson(['deploy', '--only', 'auth', '--config', configPath, ...P])
    googleOn = Boolean(deployed)
    if (googleOn) ok('Google sign-in is on')
  } catch (e) {
    warn(`Couldn't turn on Google sign-in automatically: ${e.message}`)
  }
  try {
    // Email link needs the email provider on with "password required" off.
    // The app never shows a password box; see docs/SECURITY.md.
    await googleApi(
      'PATCH',
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`,
      { signIn: { email: { enabled: true, passwordRequired: false } } }
    )
    emailLinkOn = true
    ok('Email link sign-in is on')
  } catch (e) {
    warn(`Couldn't turn on email link sign-in automatically: ${e.message}`)
  }
  if (!googleOn || !emailLinkOn) {
    manual('Turn on the sign-in methods', [
      `Open ${authPage}`,
      'If you see "Get started", click it.',
      ...(emailLinkOn ? [] : ['Click "Email/Password", switch on BOTH toggles (including "Email link (passwordless sign-in)"), click Save.']),
      ...(googleOn ? [] : ['Click "Add new provider", then "Google". Switch it on, pick your email as the support email, click Save.']),
    ], 'turn-on-sign-in-by-hand')
    await ask('\n  Press Enter when that is done.')
  }

  // 7. Deploy
  step(7, 'Putting the app on the internet')
  const siteUrl = `https://${projectId}.web.app`
  if (await yes(`  Publish the app now to ${bold(siteUrl)}?`)) {
    info('Building and uploading. This takes a minute or two…\n')
    const deployedOk = await new Promise((resolve) => {
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'deploy'], {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      })
      child.on('exit', (code) => resolve(code === 0))
    })
    if (!deployedOk) {
      console.log(red('\n  Publishing failed. The message above says why. Fix it and run `npm run deploy`.'))
      process.exit(1)
    }
    ok(`Your app is live at ${bold(siteUrl)}`)
  } else {
    info('Skipped. Publish later with `npm run deploy`.')
  }

  console.log(`\n${green(bold('All set.'))}`)
  console.log(`  Your app:        ${siteUrl}`)
  console.log(`  Firebase console: https://console.firebase.google.com/project/${projectId}`)
  console.log(`  Build locally:   npm run dev   (uses test data only, never the real project)`)
  console.log(dim('\n  Heads up: on the free plan Firebase sends at most 5 sign-in emails a day.'))
  console.log(dim('  Google sign-in has no such limit. See docs/SETUP.md#the-5-emails-a-day-limit.'))
}

main()
  .catch((e) => {
    console.error(red(`\nSetup stopped: ${e.message}`))
    console.error('Run `npm run setup` again to pick up where it left off. See docs/SETUP.md for help.')
    process.exitCode = 1
  })
  .finally(() => rl.close())
