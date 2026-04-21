#!/usr/bin/env node

/**
 * Post-install script for opencode-context-plugin
 * Automatically installs agent files to ~/.config/opencode/agents/
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOME_DIR = os.homedir();
const OPENCODE_CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode');
const AGENTS_DIR = path.join(OPENCODE_CONFIG_DIR, 'agents');
const PLUGIN_AGENTS_DIR = path.join(__dirname, '..', 'agents');

async function installAgents() {
  try {
    console.log('[ocp-agents] Starting agent installation...');
    
    // Check if agents directory exists in plugin
    try {
      await fs.access(PLUGIN_AGENTS_DIR);
    } catch {
      console.log('[ocp-agents] No agents found in plugin, skipping installation');
      return;
    }
    
    // Create opencode config directory if it doesn't exist
    try {
      await fs.access(OPENCODE_CONFIG_DIR);
    } catch {
      console.log('[ocp-agents] Creating opencode config directory...');
      await fs.mkdir(OPENCODE_CONFIG_DIR, { recursive: true });
    }
    
    // Create agents directory if it doesn't exist
    try {
      await fs.access(AGENTS_DIR);
    } catch {
      console.log('[ocp-agents] Creating agents directory...');
      await fs.mkdir(AGENTS_DIR, { recursive: true });
    }
    
    // Read agent files from plugin
    const agentFiles = await fs.readdir(PLUGIN_AGENTS_DIR);
    const mdFiles = agentFiles.filter(f => f.endsWith('.md'));
    
    if (mdFiles.length === 0) {
      console.log('[ocp-agents] No agent files found');
      return;
    }
    
    // Copy each agent file
    let installedCount = 0;
    for (const file of mdFiles) {
      const srcPath = path.join(PLUGIN_AGENTS_DIR, file);
      const destPath = path.join(AGENTS_DIR, file);
      
      try {
        await fs.copyFile(srcPath, destPath);
        console.log(`[ocp-agents] Installed: ${file}`);
        installedCount++;
      } catch (error) {
        console.error(`[ocp-agents] Failed to install ${file}: ${error.message}`);
      }
    }
    
    console.log(`[ocp-agents] Installation complete: ${installedCount}/${mdFiles.length} agents installed`);
    console.log(`[ocp-agents] Agents location: ${AGENTS_DIR}`);
  } catch (error) {
    console.error(`[ocp-agents] Installation error: ${error.message}`);
    // Don't fail the installation, just warn
    console.warn('[ocp-agents] Agent installation failed, but plugin will still work');
    console.warn('[ocp-agents] You can manually install agents later with: npx ocp-agents install');
  }
}

// Run installation
installAgents();
