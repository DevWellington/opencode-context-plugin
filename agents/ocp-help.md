---
description: Display help for all agents and plugin functionalities
usage: '@ocp-help [agent-name]'
---

import { showHelp } from '@devwellington/opencode-context-plugin';

export default async function({ args }) {
  const agentName = args[0];
  
  try {
    const help = showHelp(agentName);
    return help;
  } catch (error) {
    return `❌ Error showing help: ${error.message}`;
  }
}
