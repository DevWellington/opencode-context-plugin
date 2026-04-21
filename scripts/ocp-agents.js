#!/usr/bin/env node

/**
 * CLI tool for managing opencode-context-plugin agents
 * 
 * Usage:
 *   npx ocp-agents install    - Install agents to ~/.config/opencode/agents/
 *   npx ocp-agents list       - List available agents
 *   npx ocp-agents status     - Check which agents are installed
 *   npx ocp-agents update     - Update installed agents
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

const commands = {
  async install() {
    try {
      console.log('[ocp-agents] Starting agent installation...\n');
      
      // Check if agents directory exists in plugin
      try {
        await fs.access(PLUGIN_AGENTS_DIR);
      } catch {
        console.log('[ocp-agents] No agents found in plugin');
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
          console.log(`  ✓ Installed: ${file}`);
          installedCount++;
        } catch (error) {
          console.error(`  ✗ Failed to install ${file}: ${error.message}`);
        }
      }
      
      console.log(`\n[ocp-agents] Installation complete: ${installedCount}/${mdFiles.length} agents installed`);
      console.log(`[ocp-agents] Agents location: ${AGENTS_DIR}`);
    } catch (error) {
      console.error(`[ocp-agents] Installation error: ${error.message}`);
      process.exit(1);
    }
  },
  
  async list() {
    try {
      console.log('[ocp-agents] Available agents:\n');
      
      try {
        await fs.access(PLUGIN_AGENTS_DIR);
      } catch {
        console.log('  No agents found in plugin');
        return;
      }
      
      const agentFiles = await fs.readdir(PLUGIN_AGENTS_DIR);
      const mdFiles = agentFiles.filter(f => f.endsWith('.md'));
      
      if (mdFiles.length === 0) {
        console.log('  No agent files found');
        return;
      }
      
      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(PLUGIN_AGENTS_DIR, file), 'utf-8');
        const descMatch = content.match(/description:\s*(.+)/);
        const desc = descMatch ? descMatch[1].trim() : 'No description';
        console.log(`  • ${file.replace('.md', '')} - ${desc}`);
      }
    } catch (error) {
      console.error(`[ocp-agents] Error: ${error.message}`);
      process.exit(1);
    }
  },
  
  async status() {
    try {
      console.log('[ocp-agents] Agent status:\n');
      
      // Check plugin agents
      let pluginAgents = [];
      try {
        await fs.access(PLUGIN_AGENTS_DIR);
        const agentFiles = await fs.readdir(PLUGIN_AGENTS_DIR);
        pluginAgents = agentFiles.filter(f => f.endsWith('.md'));
      } catch {
        console.log('  Plugin agents: Not found');
      }
      
      // Check installed agents
      let installedAgents = [];
      try {
        await fs.access(AGENTS_DIR);
        const agentFiles = await fs.readdir(AGENTS_DIR);
        installedAgents = agentFiles.filter(f => f.endsWith('.md'));
      } catch {
        console.log('  Installed agents: Not found');
      }
      
      console.log(`  Plugin agents: ${pluginAgents.length} available`);
      console.log(`  Installed agents: ${installedAgents.length} installed\n`);
      
      if (installedAgents.length > 0) {
        console.log('  Installed:');
        for (const file of installedAgents) {
          const isUpToDate = pluginAgents.includes(file);
          console.log(`    ${isUpToDate ? '✓' : '⚠'} ${file}`);
        }
      }
    } catch (error) {
      console.error(`[ocp-agents] Error: ${error.message}`);
      process.exit(1);
    }
  },
  
  async update() {
    console.log('[ocp-agents] Updating agents...\n');
    await this.install();
  },
  
  help() {
    console.log(`
[ocp-agents] Manage opencode-context-plugin agents

Usage: ocp-agents <command>

Commands:
  install   - Install agents to ~/.config/opencode/agents/
  list      - List available agents
  status    - Check which agents are installed
  update    - Update installed agents
  help      - Show this help message

Examples:
  npx ocp-agents install    # Install all agents
  npx ocp-agents list       # List available agents
  npx ocp-agents status     # Check installation status
`);
  }
};

// Main execution
const command = process.argv[2] || 'help';

if (commands[command]) {
  commands[command]();
} else {
  console.error(`[ocp-agents] Unknown command: ${command}`);
  console.error('Run "npx ocp-agents help" for usage information');
  process.exit(1);
}
