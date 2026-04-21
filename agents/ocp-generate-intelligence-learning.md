---
description: Update intelligence-learning.md with new context and patterns
usage: '@ocp-generate-intelligence-learning'
---

import { updateIntelligenceLearning } from '@devwellington/opencode-context-plugin';

export default async function({ session }) {
  const directory = session.directory;
  
  try {
    const result = await updateIntelligenceLearning(directory);
    return `✅ Intelligence learning updated successfully!\n\n${result}`;
  } catch (error) {
    return `❌ Error updating intelligence learning: ${error.message}`;
  }
}
