const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const asarPath = path.join(__dirname, '../dist-electron/win-unpacked/resources/app.asar')
const extractDir = path.join(__dirname, '../dist-electron/app-extracted')
const distDir = path.join(__dirname, '../dist')

// Extract asar
console.log('Extracting app.asar...')
execSync(`npx asar extract "${asarPath}" "${extractDir}"`, { stdio: 'inherit' })

// Remove old dist in extracted
const extractedDist = path.join(extractDir, 'dist')
if (fs.existsSync(extractedDist)) {
  console.log('Removing old dist...')
  fs.rmSync(extractedDist, { recursive: true })
}

// Copy new dist
console.log('Copying new dist...')
fs.cpSync(distDir, extractedDist, { recursive: true })

// Pack asar
console.log('Packing app.asar...')
execSync(`npx asar pack "${extractDir}" "${asarPath}"`, { stdio: 'inherit' })

// Clean up
console.log('Cleaning up...')
fs.rmSync(extractDir, { recursive: true })

console.log('Done!')