#!/usr/bin/env node

/**
 * Post-install script for opencode-context-plugin
 * 1. Installs show-hidden-files globally to ~/.obsidian/plugins/
 * 2. Copies to project's .obsidian/plugins/ for this vault
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const HOME_DIR = os.homedir();
const GLOBAL_OBSIDIAN_PLUGINS = path.join(HOME_DIR, '.obsidian', 'plugins');
const SHOW_HIDDEN_SOURCE = path.join(PROJECT_ROOT, '.obsidian', 'plugins', 'show-hidden-files');

async function installPlugin(targetDir) {
  try {
    await fs.access(SHOW_HIDDEN_SOURCE);
  } catch {
    return false;
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.mkdir(path.join(targetDir, 'show-hidden-files'), { recursive: true });

  const files = await fs.readdir(SHOW_HIDDEN_SOURCE);
  for (const file of files) {
    const src = path.join(SHOW_HIDDEN_SOURCE, file);
    const dest = path.join(targetDir, 'show-hidden-files', file);
    await fs.copyFile(src, dest);
  }

  return true;
}

const BANNER = `
▞▀▖         ▞▀▖     ▌     
▌ ▌▛▀▖▞▀▖▛▀▖▌  ▞▀▖▞▀▌▞▀▖  
▌ ▌▙▄▘▛▀ ▌ ▌▌ ▖▌ ▌▌ ▌▛▀   
▝▀ ▌  ▝▀▘▘ ▘▝▀ ▝▀ ▝▀▘▝▀▘  
   ▞▀▖      ▐        ▐    
   ▌  ▞▀▖▛▀▖▜▀ ▞▀▖▚▗▘▜▀   
   ▌ ▖▌ ▌▌ ▌▐ ▖▛▀ ▗▚ ▐ ▖  
   ▝▀ ▝▀ ▘ ▘ ▀ ▝▀▘▘ ▘ ▀   
     ▛▀▖▜       ▗         
     ▙▄▘▐ ▌ ▌▞▀▌▄ ▛▀▖     
     ▌  ▐ ▌ ▌▚▄▌▐ ▌ ▌     
     ▘   ▘▝▀▘▗▄▘▀▘▘ ▘                 
`;

async function main() {
  console.log('\n' + BANNER);
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Obsidian Integration - Show Hidden Files Plugin           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let installed = false;

  // 1. Install globally for all vaults
  const globalTarget = path.join(GLOBAL_OBSIDIAN_PLUGINS, 'show-hidden-files');
  if (await installPlugin(GLOBAL_OBSIDIAN_PLUGINS)) {
    console.log('✅  Show Hidden Files installed globally');
    installed = true;
  }

  // 2. Copy to project's .obsidian for immediate use in this vault
  if (await installPlugin(path.join(PROJECT_ROOT, '.obsidian', 'plugins'))) {
    console.log('✅  Show Hidden Files copied to project .obsidian');
  }

  if (installed) {
    console.log('\n┌────────────────────────────────────────────────────────────┐');
    console.log('│  ⚠️  ACTION REQUIRED - Activate in Obsidian                 │');
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│                                                             │');
    console.log('│  1. Open Obsidian                                            │');
    console.log('│  2. Settings → Community Plugins                           │');
    console.log('│  3. Find "Show Hidden Files" in the list                   │');
    console.log('│  4. Toggle to ENABLED                                      │');
    console.log('│                                                             │');
    console.log('│  After activation, .opencode folder will be visible!       │');
    console.log('│  This is only needed ONCE - it works for all vaults.       │');
    console.log('└─────────────────────────────────────────────────────────────┘\n');
  } else {
    console.log('⚠️  No Obsidian plugin bundled');
  }
}

main();
