#!/usr/bin/env node
/**
 * Start script for Next.js with output: 'standalone'.
 * Use "node .next/standalone/server.js" when standalone build exists;
 * otherwise fall back to "next start" (e.g. after dev build).
 * Copies public and .next/static into standalone when needed.
 */

const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const standaloneDir = path.join(projectRoot, '.next', 'standalone')
const serverPath = path.join(standaloneDir, 'server.js')

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src)
  if (!exists) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    fs.readdirSync(src).forEach((item) => {
      copyRecursiveSync(path.join(src, item), path.join(dest, item))
    })
  } else {
    const destDir = path.dirname(dest)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

if (fs.existsSync(serverPath)) {
  // Standalone build: copy static assets then run standalone server
  const publicDir = path.join(projectRoot, 'public')
  const staticDir = path.join(projectRoot, '.next', 'static')
  const standaloneStatic = path.join(standaloneDir, '.next', 'static')
  const standalonePublic = path.join(standaloneDir, 'public')

  if (fs.existsSync(publicDir)) {
    copyRecursiveSync(publicDir, standalonePublic)
  }
  if (fs.existsSync(staticDir)) {
    copyRecursiveSync(staticDir, standaloneStatic)
  }

  const child = spawn(process.execPath, ['server.js'], {
    cwd: standaloneDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  child.on('error', (err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
  child.on('exit', (code) => process.exit(code ?? 0))
} else {
  // No standalone build: use next start (e.g. dev or non-standalone build)
  const child = spawn('npx', ['next', 'start'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('error', (err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}
