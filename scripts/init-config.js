#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

const EXAMPLE_CONFIG = {
  maxContexts: 5,
  debug: false,
  debounceMs: 2000,
  injection: {
    enabled: false,
    autoInject: true,
    maxContexts: 5,
    maxTokens: 8000,
    cache: {
      enabled: true,
      ttlMs: 300000
    }
  },
  relevanceScoring: {
    enabled: true,
    weights: {
      recency: 0.4,
      keywords: 0.35,
      affinity: 0.25
    }
  },
  search: {
    enabled: true,
    maxResults: 10
  },
  report: {
    enabled: true,
    autoGenerate: true
  },
  remoteSync: {
    enabled: false,
    provider: "s3",
    options: {
      endpoint: "",
      bucket: "",
      credentials: {}
    }
  },
  protected: {
    enabled: true,
    maxDays: -1
  },
  globalIntelligence: {
    enabled: true,
    path: "~/.opencode/global-intelligence.md"
  },
  logRotation: {
    enabled: true,
    maxFiles: 10,
    maxSizeBytes: 10485760
  }
};

const HELP_TEXT = `
Usage: ocp-agents init-config [options]

Generate a context-plugin.json config file for the OpenCode Context Plugin.

Options:
  --target <path>   Set target directory (default: current directory)
  --overwrite       Overwrite existing config file
  --dry-run         Show config without writing
  -h, --help        Show this help message

Examples:
  ocp-agents init-config                    # Create in current dir
  ocp-agents init-config --target /my/project
  ocp-agents init-config --dry-run          # Preview without writing
`.trim();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('-h') || args.includes('--help')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  let targetDir = process.cwd();
  let overwrite = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      targetDir = args[i + 1];
      i++;
    } else if (args[i] === '--overwrite') {
      overwrite = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  const configPath = path.join(targetDir, 'context-plugin.json');

  if (dryRun) {
    console.log('## Dry-run: would create config file at:');
    console.log(configPath);
    console.log('\n## Config content:');
    console.log(JSON.stringify(EXAMPLE_CONFIG, null, 2));
    return;
  }

  try {
    await fs.access(configPath);
    if (!overwrite) {
      console.log(`[context-plugin] Config already exists: ${configPath}`);
      console.log('Use --overwrite to replace it.');
      process.exit(0);
    }
  } catch {
    // File doesn't exist, proceed
  }

  await fs.writeFile(configPath, JSON.stringify(EXAMPLE_CONFIG, null, 2) + '\n', 'utf-8');
  console.log(`[context-plugin] Config created: ${configPath}`);
}

main().catch(err => {
  console.error(`[context-plugin] Failed to init config: ${err.message}`);
  process.exit(1);
});
