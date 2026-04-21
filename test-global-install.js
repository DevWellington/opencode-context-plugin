#!/usr/bin/env node

/**
 * Teste de Instalação Global do Plugin
 * 
 * Este script testa se o plugin está sendo carregado corretamente
 * em diferentes projetos quando instalado globalmente.
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const HOME = process.env.HOME;
const GLOBAL_CONFIG = path.join(HOME, '.config/opencode/opencode.json');
const GLOBAL_PLUGIN_DIR = path.join(HOME, '.config/opencode/plugins/opencode-context-plugin');
const TEST_PROJECTS = [
  path.join(HOME, 'projects/devocional-palavras-chave'),
  path.join(HOME, 'projects/opencode-context-plugin'),
  '/tmp/opencode-test-' + Date.now()
];

const LOG_FILE = path.join(HOME, '.opencode-context-plugin-test.log');

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line);
}

async function clearLog() {
  try {
    await fs.unlink(LOG_FILE);
  } catch {}
  await log('=== INÍCIO DO TESTE DE INSTALAÇÃO GLOBAL ===');
}

async function checkGlobalConfig() {
  await log('\n📋 1. Verificando configuração global...');
  try {
    const config = JSON.parse(await fs.readFile(GLOBAL_CONFIG, 'utf-8'));
    await log(`   Config: ${JSON.stringify(config.plugin, null, 2)}`);
    return config.plugin || [];
  } catch (error) {
    await log(`   ❌ Erro ao ler config: ${error.message}`);
    return [];
  }
}

async function checkPluginInstalled() {
  await log('\n📦 2. Verificando plugin instalado...');
  try {
    await fs.access(GLOBAL_PLUGIN_DIR);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(GLOBAL_PLUGIN_DIR, 'package.json'), 'utf-8')
    );
    await log(`   ✅ Plugin instalado: ${packageJson.name}@${packageJson.version}`);
    return true;
  } catch (error) {
    await log(`   ❌ Plugin não instalado: ${error.message}`);
    return false;
  }
}

async function testProject(projectPath) {
  await log(`\n🧪 3. Testando projeto: ${projectPath}`);
  
  // Check if project exists
  try {
    await fs.access(projectPath);
  } catch {
    await log(`   ⏭️  Pulando (não existe)`);
    return;
  }
  
  // Check local config
  const localConfig = path.join(projectPath, '.opencode/opencode.json');
  try {
    const config = JSON.parse(await fs.readFile(localConfig, 'utf-8'));
    await log(`   Config local: ${JSON.stringify(config.plugin || 'herda global', null, 2)}`);
  } catch {
    await log(`   Sem config local (usa global)`);
  }
  
  // Run opencode command
  await log(`   Executando opencode run...`);
  try {
    execSync(`cd "${projectPath}" && opencode run "teste-global-plugin" 2>&1 | head -5`, {
      stdio: 'pipe',
      timeout: 15000
    });
    await log(`   ✅ Comando executado`);
  } catch (error) {
    await log(`   ⚠️  Erro: ${error.message}`);
  }
  
  // Check if plugin loaded (via log file)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const pluginLog = await fs.readFile(path.join(HOME, '.opencode-context-plugin.log'), 'utf-8');
    const lines = pluginLog.split('\n').filter(l => l.includes(projectPath));
    if (lines.length > 0) {
      await log(`   ✅ Plugin CARREGOU (${lines.length} logs)`);
      lines.slice(-2).forEach(l => log(`      ${l}`));
    } else {
      await log(`   ❌ plugin NÃO carregou`);
    }
  } catch {
    await log(`   ❌ Sem log do plugin`);
  }
  
  // Check if context-session was created
  const contextDir = path.join(projectPath, '.opencode/context-session');
  try {
    await fs.access(contextDir);
    await log(`   ✅ context-session criado`);
  } catch {
    await log(`   ❌ context-session NÃO criado`);
  }
}

async function cleanup() {
  await log('\n🧹 4. Limpando...');
  // Remove temp test project
  const tempProject = TEST_PROJECTS[2];
  try {
    await fs.rm(tempProject, { recursive: true, force: true });
    await log(`   ✅ Temp project removido`);
  } catch {}
}

async function main() {
  await clearLog();
  
  await checkGlobalConfig();
  await checkPluginInstalled();
  
  for (const project of TEST_PROJECTS) {
    await testProject(project);
  }
  
  await cleanup();
  
  await log('\n=== FIM DO TESTE ===');
  console.log(`\n📄 Log completo: ${LOG_FILE}`);
}

main().catch(console.error);
