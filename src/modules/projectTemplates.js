import fs from "fs/promises";
import path from "path";
import os from "os";
import { getGlobalIntelligencePath, queryGlobalIntelligence } from '../utils/globalIntelligence.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('project-templates');

const TEMPLATES_DIR = path.join(process.env.HOME || os.homedir(), '.opencode', 'templates');

// Built-in templates directory (in project)
const BUILT_IN_TEMPLATES_DIR = path.join(process.cwd(), 'templates');

// Project type detection patterns
const PROJECT_TYPE_PATTERNS = {
  node: {
    indicatorFiles: ['package.json', 'node_modules', 'yarn.lock', 'pnpm-lock.yaml', 'package-lock.json'],
    patterns: ['node', 'npm', 'yarn', 'pnpm']
  },
  python: {
    indicatorFiles: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile', 'venv', '.venv'],
    patterns: ['python', 'pip', 'poetry']
  },
  go: {
    indicatorFiles: ['go.mod', 'go.sum', 'Gopkg.toml'],
    patterns: ['go', 'golang']
  },
  rust: {
    indicatorFiles: ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml'],
    patterns: ['rust', 'cargo']
  },
  webapp: {
    indicatorFiles: ['index.html', 'index.htm', 'public/', 'src/index'],
    patterns: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt']
  },
  library: {
    indicatorFiles: ['README.md', 'LICENSE', 'src/index', 'lib/'],
    patterns: ['library', 'module', 'package', 'sdk']
  }
};

/**
 * Detect the type of project based on files in the directory
 * @param {string} dir - Directory to analyze
 * @returns {Promise<string>} Detected project type (node, python, go, rust, webapp, library, or generic)
 */
export async function detectProjectType(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = new Set(entries.map(e => e.name));
    const dirs = new Set(entries.filter(e => e.isDirectory()).map(e => e.name));
    
    // Check for Node.js indicators
    if (files.has('package.json') || files.has('node_modules')) {
      // Check if it's a webapp
      if (files.has('index.html') || dirs.has('public') || dirs.has('src')) {
        return 'webapp';
      }
      return 'node';
    }
    
    // Check for Python indicators
    if (files.has('requirements.txt') || files.has('pyproject.toml') || files.has('setup.py')) {
      return 'python';
    }
    
    // Check for Go indicators
    if (files.has('go.mod')) {
      return 'go';
    }

    // Check for Rust indicators (check BEFORE library since Cargo.toml is specific)
    if (files.has('Cargo.toml')) {
      return 'rust';
    }

    // Check for webapp indicators (standalone - not inside node check above)
    if (files.has('index.html') || dirs.has('public')) {
      return 'webapp';
    }

    // Check for library indicators
    if (files.has('README.md') && dirs.has('src')) {
      return 'library';
    }
    
    return 'generic';
  } catch (error) {
    logger(`[ProjectTemplates] Error detecting project type: ${error.message}`);
    return 'generic';
  }
}

/**
 * Get recommended template based on project type
 * @param {string} projectType - The detected project type
 * @returns {Promise<Object>} Template recommendation
 */
export async function getRecommendedTemplate(projectType) {
  const templateMap = {
    node: { name: 'node', description: 'Node.js/JavaScript project template', weight: 10 },
    python: { name: 'python', description: 'Python project template', weight: 10 },
    go: { name: 'go', description: 'Go project template', weight: 10 },
    rust: { name: 'rust', description: 'Rust project template', weight: 10 },
    webapp: { name: 'webapp', description: 'Web application template', weight: 10 },
    library: { name: 'library', description: 'Library/module template', weight: 10 },
    generic: { name: 'basic', description: 'Basic template for any project type', weight: 5 }
  };
  
  return templateMap[projectType] || templateMap.generic;
}

/**
 * Generate a project-specific template based on learnings
 * @param {Object} options - Template generation options
 * @param {string} [options.projectName] - Name of the project
 * @param {string} [options.projectType] - Project type hint
 * @param {boolean} [options.includePatterns=true] - Include patterns from learnings
 * @param {boolean} [options.includeHooks=true] - Include hook configurations
 * @param {string} [options.baseDir] - Base directory to read learnings from
 * @returns {Promise<Object>} Generated template data
 */
export async function generateProjectTemplate(options = {}) {
  const {
    projectName = 'my-project',
    projectType: hintedType,
    includePatterns = true,
    includeHooks = true,
    baseDir = process.cwd()
  } = options;
  
  // Detect project type if not provided
  const detectedType = hintedType || await detectProjectType(baseDir);
  
  // Query global intelligence for patterns
  let patterns = [];
  if (includePatterns) {
    try {
      const patternResults = await queryGlobalIntelligence(detectedType);
      patterns = patternResults.slice(0, 5).map(r => ({
        section: r.section,
        content: r.content.slice(0, 200)
      }));
    } catch (error) {
      logger(`[ProjectTemplates] Could not query global intelligence: ${error.message}`);
    }
  }
  
  // Build template structure
  const template = {
    name: projectName,
    type: detectedType,
    createdAt: new Date().toISOString(),
    structure: {
      folders: [
        '.opencode',
        '.opencode/context-session',
        '.opencode/context-session/reports'
      ],
      files: []
    },
    config: {
      opencode: {
        contextSession: {
          enabled: true,
          maxContexts: 5,
          autoInject: false
        }
      }
    },
    hooks: [],
    patterns: []
  };
  
  // Add type-specific folder structure
  if (detectedType === 'node' || detectedType === 'webapp') {
    template.structure.folders.push(
      'src',
      'tests',
      'docs'
    );
    template.config.opencode.contextSession.autoInject = true;
    template.config.opencode.contextSession.maxContexts = 3;
  } else if (detectedType === 'python') {
    template.structure.folders.push(
      'src',
      'tests',
      'docs',
      '.venv'
    );
  } else if (detectedType === 'library') {
    template.structure.folders.push(
      'src',
      'tests',
      'examples',
      'docs'
    );
  }
  
  // Add hooks if requested
  if (includeHooks) {
    template.hooks = [
      {
        event: 'session.compacted',
        action: 'saveContext',
        description: 'Save context after session compaction'
      },
      {
        event: 'session.end',
        action: 'generateReport',
        description: 'Generate daily report on session end'
      }
    ];
  }
  
  // Add patterns from learnings
  if (patterns.length > 0) {
    template.patterns = patterns;
  } else {
    // Add default patterns based on project type
    template.patterns = getDefaultPatterns(detectedType);
  }
  
  return template;
}

/**
 * Get default patterns based on project type
 * @param {string} projectType - Project type
 * @returns {Array} Default patterns
 */
function getDefaultPatterns(projectType) {
  const defaults = {
    node: [
      { pattern: 'Use atomic writes for config files', weight: 8 },
      { pattern: 'Queue-based serialization for concurrent writes', weight: 7 },
      { pattern: 'Promise-based async operations', weight: 6 }
    ],
    python: [
      { pattern: 'Virtual environment per project', weight: 8 },
      { pattern: 'Atomic writes using temp file rename', weight: 7 }
    ],
    webapp: [
      { pattern: 'Context injection for request scope', weight: 9 },
      { pattern: 'Session-based state management', weight: 7 }
    ],
    library: [
      { pattern: 'Public API via index exports', weight: 8 },
      { pattern: 'Version semver tagging', weight: 7 }
    ],
    generic: [
      { pattern: 'Folder hierarchy: YYYY/MM/WW/DD for temporal organization', weight: 8 },
      { pattern: 'Atomic writes prevent corruption', weight: 9 },
      { pattern: 'Queue serialization prevents concurrent write conflicts', weight: 8 }
    ]
  };
  
  return defaults[projectType] || defaults.generic;
}

/**
 * Initialize a project from a template
 * @param {string} templatePath - Path to template or template name
 * @param {string} targetDir - Target directory to initialize
 * @param {Object} [options] - Options for initialization
 * @param {string} [options.projectName] - Override project name
 * @returns {Promise<Object>} Result with success status and details
 */
export async function initializeFromTemplate(templatePath, targetDir, options = {}) {
  const nameOverride = options.projectName;
  
  try {
    // Resolve template path
    let template;
    let resolvedTemplatePath = templatePath;
    
    // Check if it's a path or a template name
    const isTemplateName = !templatePath.includes('/') && !templatePath.includes('\\');
    if (isTemplateName) {
      // It's a template name - look in default templates (check built-in first, then user templates)
      const builtInPath = path.join(BUILT_IN_TEMPLATES_DIR, templatePath);
      try {
        const stats = await fs.stat(builtInPath);
        if (stats.isDirectory()) {
          resolvedTemplatePath = path.join(builtInPath, 'template.json');
        } else {
          resolvedTemplatePath = builtInPath + '.json';
        }
      } catch {
        // Fall back to user templates directory
        resolvedTemplatePath = path.join(TEMPLATES_DIR, templatePath);
      }
    }
    
    // Try to read as file first
    let templateData;
    try {
      const content = await fs.readFile(resolvedTemplatePath, 'utf-8');
      templateData = JSON.parse(content);
    } catch {
      // Check if it's a directory
      try {
        const stats = await fs.stat(resolvedTemplatePath);
        if (stats.isDirectory()) {
          const templateFile = path.join(resolvedTemplatePath, 'template.json');
          const content = await fs.readFile(templateFile, 'utf-8');
          templateData = JSON.parse(content);
        } else {
          throw new Error('Template not found');
        }
      } catch {
        return {
          success: false,
          error: `Template not found: ${templatePath}`
        };
      }
    }
    
    template = templateData;
    
    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });
    
    // Get project name
    const projectName = nameOverride || template.name || path.basename(targetDir);
    
    // Create folder structure
    for (const folder of template.structure.folders) {
      const fullPath = path.join(targetDir, folder);
      await fs.mkdir(fullPath, { recursive: true });
      logger(`[ProjectTemplates] Created folder: ${folder}`);
    }
    
    // Create opencode.json config
    const configContent = JSON.stringify(template.config, null, 2);
    await fs.writeFile(
      path.join(targetDir, '.opencode', 'opencode.json'),
      configContent.replace(/{{PROJECT_NAME}}/g, projectName)
    );
    
    // Create hooks.example.json if hooks exist
    if (template.hooks && template.hooks.length > 0) {
      const hooksContent = JSON.stringify({ hooks: template.hooks }, null, 2);
      await fs.writeFile(
        path.join(targetDir, '.opencode', 'hooks.example.json'),
        hooksContent.replace(/{{PROJECT_NAME}}/g, projectName)
      );
    }
    
    // Create README with template info
    let readme = `# ${projectName}\n\n`;
    readme += `Generated from template: ${template.name || 'custom'}\n`;
    readme += `Type: ${template.type || 'generic'}\n`;
    readme += `Created: ${new Date().toISOString()}\n\n`;
    readme += `## Project Structure\n\n`;
    
    for (const folder of template.structure.folders) {
      readme += `- \`${folder}/\`\n`;
    }
    
    if (template.patterns && template.patterns.length > 0) {
      readme += `\n## Recommended Patterns\n\n`;
      for (const p of template.patterns.slice(0, 5)) {
        readme += `- ${typeof p === 'string' ? p : p.pattern}\n`;
      }
    }
    
    await fs.writeFile(path.join(targetDir, 'README.md'), readme);
    
    // Create initial intelligence-learning file
    let learningContent = `# Intelligence Learning - ${projectName}\n\n`;
    learningContent += `## Last Updated\n`;
    learningContent += `- **Timestamp:** ${new Date().toISOString()}\n`;
    learningContent += `- **Sessions Analyzed:** 0\n`;
    learningContent += `- **Last Session Type:** none\n\n`;
    learningContent += `## Project Structure Decisions\n\n`;
    learningContent += `### Folder Hierarchy\n`;
    learningContent += `- **Structure:** Based on template for ${template.type} projects\n\n`;
    learningContent += `## Architectural Decisions\n\n`;
    learningContent += `### Hook Configuration\n`;
    if (template.hooks) {
      for (const hook of template.hooks) {
        learningContent += `- **${hook.event}:** ${hook.action}\n`;
      }
    }
    learningContent += "\n---\n*Auto-generated by OpenCode Context Plugin*\n";
    
    await fs.writeFile(
      path.join(targetDir, '.opencode', 'context-session', 'intelligence-learning.md'),
      learningContent
    );
    
    logger(`[ProjectTemplates] Initialized project from template: ${templatePath}`);
    
    return {
      success: true,
      projectName,
      targetDir,
      template: template.name || templatePath,
      folders: template.structure.folders
    };
  } catch (error) {
    logger(`[ProjectTemplates] Error initializing from template: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List available templates
 * @returns {Promise<Array>} Array of available templates with metadata
 */
export async function listTemplates() {
  const templates = [];
  
  // First, add built-in templates
  const builtInTemplates = [
    {
      name: 'basic',
      description: 'Basic template for any project type',
      type: 'generic',
      createdAt: '2026-04-01T00:00:00Z',
      builtIn: true
    },
    {
      name: 'node',
      description: 'Node.js project with src, tests, docs folders',
      type: 'node',
      createdAt: '2026-04-01T00:00:00Z',
      builtIn: true
    },
    {
      name: 'webapp',
      description: 'Web application with context injection enabled',
      type: 'webapp',
      createdAt: '2026-04-01T00:00:00Z',
      builtIn: true
    },
    {
      name: 'library',
      description: 'Library/module project with examples folder',
      type: 'library',
      createdAt: '2026-04-01T00:00:00Z',
      builtIn: true
    },
    {
      name: 'python',
      description: 'Python project with virtual environment support',
      type: 'python',
      createdAt: '2026-04-01T00:00:00Z',
      builtIn: true
    }
  ];
  
  templates.push(...builtInTemplates);
  
  // Check for custom templates in ~/.opencode/templates/
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const templateJsonPath = path.join(TEMPLATES_DIR, entry.name, 'template.json');
        try {
          const content = await fs.readFile(templateJsonPath, 'utf-8');
          const templateData = JSON.parse(content);
          templates.push({
            name: entry.name,
            description: templateData.description || `${entry.name} template`,
            type: templateData.type || 'custom',
            createdAt: templateData.createdAt || 'unknown',
            builtIn: false
          });
        } catch {
          // template.json not found, skip
        }
      } else if (entry.name.endsWith('.json')) {
        // Single file template
        try {
          const content = await fs.readFile(path.join(TEMPLATES_DIR, entry.name), 'utf-8');
          const templateData = JSON.parse(content);
          templates.push({
            name: entry.name.replace('.json', ''),
            description: templateData.description || `${entry.name} template`,
            type: templateData.type || 'custom',
            createdAt: templateData.createdAt || 'unknown',
            builtIn: false
          });
        } catch {
          // Skip invalid templates
        }
      }
    }
  } catch (error) {
    logger(`[ProjectTemplates] Error reading custom templates: ${error.message}`);
  }
  
  return templates;
}

/**
 * Save a custom template
 * @param {string} name - Template name
 * @param {Object} templateData - Template data to save
 * @returns {Promise<Object>} Result with success status
 */
export async function saveTemplate(name, templateData) {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    const fullTemplate = {
      ...templateData,
      name,
      createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(templatePath, JSON.stringify(fullTemplate, null, 2));
    logger(`[ProjectTemplates] Saved template: ${name}`);
    
    return {
      success: true,
      path: templatePath
    };
  } catch (error) {
    logger(`[ProjectTemplates] Error saving template: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get template recommendations for a project type based on global intelligence
 * @param {string} projectType - Project type to get recommendations for
 * @returns {Promise<Array>} Array of template recommendations
 */
export async function getTemplateRecommendations(projectType) {
  const recommendations = [];
  
  // Query global intelligence for patterns related to this project type
  try {
    const patterns = await queryGlobalIntelligence(projectType);
    
    for (const pattern of patterns.slice(0, 10)) {
      recommendations.push({
        section: pattern.section,
        snippet: pattern.content.slice(0, 150),
        source: 'global-intelligence'
      });
    }
  } catch (error) {
    logger(`[ProjectTemplates] Could not get recommendations: ${error.message}`);
  }
  
  // Add built-in template suggestions
  const templateSuggestions = [
    { name: 'basic', match: 5, reason: 'Works with any project type' },
    { name: 'webapp', match: projectType === 'webapp' ? 10 : 3, reason: 'For web applications' },
    { name: 'library', match: projectType === 'library' ? 10 : 3, reason: 'For libraries/modules' }
  ];
  
  // Sort by match score
  templateSuggestions.sort((a, b) => b.match - a.match);
  
  return {
    projectType,
    recommendations,
    suggestedTemplates: templateSuggestions.filter(t => t.match >= 3)
  };
}
