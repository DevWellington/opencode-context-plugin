#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { 
  generateProjectTemplate, 
  initializeFromTemplate, 
  listTemplates,
  detectProjectType,
  getRecommendedTemplate
} from "../modules/projectTemplates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Print help message
 */
function printHelp() {
  console.log(`
OpenCode Context Plugin - Project Template CLI

Usage:
  opencode template:generate <name> [options]  Generate a template from learnings
  opencode template:init <template> <targetDir> [options]  Initialize project from template
  opencode template:list [options]            List available templates
  opencode template:detect [dir]              Detect project type
  opencode template:help                      Show this help

Commands:
  template:generate <name>
    --project-type <type>    Project type hint (node, python, webapp, library, generic)
    --output-dir <path>      Output directory for template file
    --no-patterns           Exclude patterns from learnings
    --no-hooks              Exclude hook configurations
  
  template:init <template> <targetDir>
    --project-name <name>    Override project name
  
  template:list
    --json                   Output as JSON
  
  template:detect [dir]
    Detect the project type for a directory (defaults to current directory)

Examples:
  opencode template:generate my-template --project-type node
  opencode template:init basic ./new-project
  opencode template:list --json
  opencode template:detect ./my-project
`);
}

/**
 * Generate template command
 */
async function generateCommand(args) {
  const templateName = args[0];
  
  if (!templateName) {
    console.error('Error: Template name required');
    console.error('Usage: opencode template:generate <name> [--project-type type] [--output-dir path]');
    process.exit(1);
  }
  
  // Parse options
  const options = {
    projectName: templateName
  };
  
  let outputPath = null;
  let projectType = null;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--project-type' && args[i + 1]) {
      projectType = args[i + 1];
      i++;
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    } else if (args[i] === '--no-patterns') {
      options.includePatterns = false;
    } else if (args[i] === '--no-hooks') {
      options.includeHooks = false;
    }
  }
  
  if (projectType) {
    options.projectType = projectType;
  }
  
  try {
    console.log(`Generating template "${templateName}"...`);
    
    const template = await generateProjectTemplate(options);
    
    // If no output path specified, use home templates dir
    if (!outputPath) {
      outputPath = path.join(process.env.HOME || '', '.opencode', 'templates', `${templateName}.json`);
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Write template file
    await fs.writeFile(outputPath, JSON.stringify(template, null, 2));
    
    console.log(`Template generated successfully!`);
    console.log(`  Path: ${outputPath}`);
    console.log(`  Type: ${template.type}`);
    console.log(`  Folders: ${template.structure.folders.length}`);
    console.log(`  Patterns: ${template.patterns.length}`);
    
    // Show preview
    console.log(`\nPreview:`);
    console.log(JSON.stringify(template, null, 2).slice(0, 500) + '...');
    
  } catch (error) {
    console.error(`Error generating template: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Initialize project from template command
 */
async function initCommand(args) {
  const templateName = args[0];
  const targetDir = args[1];
  
  if (!templateName || !targetDir) {
    console.error('Error: Template name and target directory required');
    console.error('Usage: opencode template:init <template> <targetDir> [--project-name name]');
    process.exit(1);
  }
  
  const options = {};
  
  // Parse options
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--project-name' && args[i + 1]) {
      options.projectName = args[i + 1];
      i++;
    }
  }
  
  try {
    console.log(`Initializing project from template "${templateName}"...`);
    console.log(`Target directory: ${targetDir}`);
    
    const result = await initializeFromTemplate(templateName, targetDir, options);
    
    if (result.success) {
      console.log(`\nProject initialized successfully!`);
      console.log(`  Project: ${result.projectName}`);
      console.log(`  Template: ${result.template}`);
      console.log(`  Folders created:`);
      for (const folder of result.folders) {
        console.log(`    - ${folder}/`);
      }
    } else {
      console.error(`\nError: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error initializing project: ${error.message}`);
    process.exit(1);
  }
}

/**
 * List templates command
 */
async function listCommand(args) {
  const asJson = args.includes('--json');
  
  try {
    const templates = await listTemplates();
    
    if (asJson) {
      console.log(JSON.stringify(templates, null, 2));
    } else {
      console.log(`Available templates:\n`);
      
      for (const template of templates) {
        const badge = template.builtIn ? '(built-in)' : '(custom)';
        console.log(`  ${template.name} ${badge}`);
        console.log(`    ${template.description}`);
        console.log(`    Type: ${template.type} | Created: ${template.createdAt}`);
        console.log();
      }
    }
  } catch (error) {
    console.error(`Error listing templates: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Detect project type command
 */
async function detectCommand(args) {
  const targetDir = args[0] || process.cwd();
  
  try {
    console.log(`Detecting project type for: ${targetDir}`);
    
    const projectType = await detectProjectType(targetDir);
    const recommended = await getRecommendedTemplate(projectType);
    
    console.log(`\nDetected type: ${projectType}`);
    console.log(`Recommended template: ${recommended.name}`);
    console.log(`  ${recommended.description}`);
    
  } catch (error) {
    console.error(`Error detecting project type: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  switch (command) {
    case 'template:generate':
      await generateCommand(args);
      break;
      
    case 'template:init':
      await initCommand(args);
      break;
      
    case 'template:list':
      await listCommand(args);
      break;
      
    case 'template:detect':
      await detectCommand(args);
      break;
      
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      break;
  }
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
