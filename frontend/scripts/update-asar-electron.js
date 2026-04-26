const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const asarPath = path.join(__dirname, '../dist-electron/win-unpacked/resources/app.asar')
const extractDir = path.join(__dirname, '../dist-electron/app-extracted')
const mainJsSrc = path.join(__dirname, '../electron/dist/main.js')
const mainJsDest = path.join(extractDir, 'electron/dist/main.js')

// Extract asar
console.log('Extracting app.asar...')
execSync(`npx asar extract "${asarPath}" "${extractDir}"`, { stdio: 'inherit' })

// Copy new main.js
console.log('Copying new main.js...')
fs.copyFileSync(mainJsSrc, mainJsDest)

// Pack asar
console.log('Packing app.asar...')
execSync(`npx asar pack "${extractDir}" "${asarPath}"`, { stdio: 'inherit' })

// Clean up
console.log('Cleaning up...')
fs.rmSync(extractDir, { recursive: true })

console.log('Done!')