/**
 * @ocp-help
 * Display help for all agents and plugin functionalities
 *
 * Usage: @ocp-help [agent-name]
 *
 * Without arguments: Shows list of all available agents and commands
 * With agent name: Shows detailed help for specific agent
 */

const AGENT_HELP = {
  '@ocp-generate-today': {
    description: "Generate today's context summary with Obsidian-style linking",
    usage: '@ocp-generate-today',
    params: [],
    keywords: ['today', 'daily', 'context', 'generate']
  },
  '@ocp-read-today': {
    description: "Read today's context summary",
    usage: '@ocp-read-today [--summary|--all]',
    params: ['--summary (default): Show summary', '--all: Show full content'],
    keywords: ['today', 'read', 'daily']
  },
  '@ocp-generate-weekly': {
    description: 'Generate weekly context summary with daily breakdown',
    usage: '@ocp-generate-weekly [date]',
    params: ['date: ISO date string (optional, defaults to current week)'],
    keywords: ['weekly', 'week', 'generate']
  },
  '@ocp-read-weekly': {
    description: 'Read weekly context summary',
    usage: '@ocp-read-weekly [date] [--summary|--all]',
    params: ['date: ISO date string (optional)', '--summary/--all: Output format'],
    keywords: ['weekly', 'read']
  },
  '@ocp-generate-monthly': {
    description: 'Generate monthly context summary with weekly statistics',
    usage: '@ocp-generate-monthly [month]',
    params: ['month: YYYY-MM format (optional, defaults to current month)'],
    keywords: ['monthly', 'month', 'generate']
  },
  '@ocp-read-monthly': {
    description: 'Read monthly context summary',
    usage: '@ocp-read-monthly [month] [--summary|--all]',
    params: ['month: YYYY-MM format (optional)', '--summary/--all: Output format'],
    keywords: ['monthly', 'read']
  },
  '@ocp-generate-annual': {
    description: 'Generate annual context summary with yearly statistics',
    usage: '@ocp-generate-annual [year]',
    params: ['year: YYYY format (optional, defaults to current year)'],
    keywords: ['annual', 'year', 'generate']
  },
  '@ocp-read-annual': {
    description: 'Read annual context summary',
    usage: '@ocp-read-annual [year] [--summary|--all]',
    params: ['year: YYYY format (optional)', '--summary/--all: Output format'],
    keywords: ['annual', 'read']
  },
  '@ocp-generate-intelligence-learning': {
    description: 'Update intelligence-learning.md with new context and patterns',
    usage: '@ocp-generate-intelligence-learning',
    params: [],
    keywords: ['intelligence', 'learning', 'generate', 'bugs', 'patterns']
  },
  '@ocp-read-intelligence-learning': {
    description: 'Read intelligence-learning.md file',
    usage: '@ocp-read-intelligence-learning [--summary|--all]',
    params: ['--summary (default): Show key learnings', '--all: Full content'],
    keywords: ['intelligence', 'read']
  },
  '@ocp-help': {
    description: 'Display this help information',
    usage: '@ocp-help [agent-name]',
    params: ['agent-name: Optional specific agent to get help for'],
    keywords: ['help', 'info', 'usage']
  }
};

const PLUGIN_FUNCTIONALITIES = [
  {
    name: 'Context Saving',
    description: 'Automatically saves session context to .opencode/context-session/',
    triggers: ['session.compacted', 'session.end', 'session.idle', 'session.deleted'],
    file: 'src/modules/saveContext.js'
  },
  {
    name: 'Summaries',
    description: 'Auto-generates daily, week, and day summaries',
    locations: ['.opencode/context-session/daily-summary.md', 'YYYY/MM/WW/DD/day-summary.md'],
    file: 'src/modules/summaries.js'
  },
  {
    name: 'Intelligence Learning',
    description: 'Tracks patterns and bugs across sessions',
    location: '.opencode/context-session/intelligence-learning.md',
    file: 'src/modules/intelligence.js'
  },
  {
    name: 'Context Injection',
    description: 'Injects relevant contexts based on LLM scoring',
    config: 'injection.enabled, injection.autoInject, injection.maxTokens',
    file: 'src/modules/contextInjector.js'
  },
  {
    name: 'Search',
    description: 'Full-text search across all session files',
    usage: 'node src/cli/search.js "query" [--type exit|compact] [--from YYYY-MM-DD] [--to YYYY-MM-DD]',
    file: 'src/cli/search.js'
  },
  {
    name: 'Reports',
    description: 'Generate weekly/monthly activity reports',
    usage: 'node src/cli/report.js weekly|monthly|range [--save]',
    file: 'src/cli/report.js'
  }
];

export function showHelp(agentName = null) {
  if (agentName) {
    // Find by exact name or keyword match
    const help = AGENT_HELP[agentName] ||
      Object.values(AGENT_HELP).find(h =>
        h.keywords.includes(agentName.toLowerCase()) ||
        h.usage.toLowerCase().includes(agentName.toLowerCase())
      );

    if (!help) {
      return `Agent "${agentName}" not found. Use @ocp-help to see all available agents.`;
    }

    return formatAgentHelp(agentName, help);
  }

  return formatGeneralHelp();
}

function formatAgentHelp(name, help) {
  return `
## ${name}

**Description:** ${help.description}

**Usage:** \`${help.usage}\`

${help.params?.length ? `**Parameters:**
${help.params.map(p => `- ${p}`).join('\n')}` : ''}

**Keywords:** ${help.keywords.join(', ')}
`;
}

function formatGeneralHelp() {
  const agentList = Object.entries(AGENT_HELP).map(([name, help]) =>
    `| \`${name}\` | ${help.description} |`
  ).join('\n');

  const funcList = PLUGIN_FUNCTIONALITIES.map(f => {
    let item = `### ${f.name}\n${f.description}`;
    if (f.usage) item += `\n\`\`\`\n${f.usage}\n\`\`\``;
    if (f.triggers) item += `\n**Triggers:** ${f.triggers.join(', ')}`;
    return item;
  }).join('\n\n');

  return `
# OpenCode Context Plugin - Help

## Available Agents

| Agent | Description |
|------|-------------|
${agentList}

## Plugin Functionalities

${funcList}

## Obsidian Integration

All generated files use Obsidian-style keyword linking:
- Keywords extracted from actual session content
- [[wiki links]] for cross-referencing between files
- Frontmatter with keywords for effective graph views

## SOLID Principles

All plugin operations follow SOLID principles:
- Single Responsibility: Each module has one job
- Open/Closed: Open for extension, closed for modification
- Interface Segregation: Small, specific functions

---
Use \`@ocp-help <agent-name>\` for detailed help on a specific agent.
`;
}