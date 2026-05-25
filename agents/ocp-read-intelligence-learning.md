---
description: Read intelligence-learning.md file
usage: '@ocp-read-intelligence-learning [--summary|--all]'
---

import { readIntelligenceLearning } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const options = {
    summary: !args.includes('--all')
  };
  
  try {
    const result = await readIntelligenceLearning(directory, options);
    return result;
  } catch (error) {
    return `❌ Error reading intelligence learning: ${error.message}`;
  }
}
