---
description: Update intelligence-learning.md by reading all 4 report levels (daily, weekly, monthly, annual) and updating the project's intelligence base
usage: '@ocp-generate-intelligence-learning'

import { updateIntelligenceLearning } from '@devwellington/opencode-context-plugin';

export default async function({ session }) {
  const directory = session.directory;
  
  try {
    const result = await updateIntelligenceLearning(directory);
    return `✅ Intelligence learning updated to intelligence.md!\n\n${JSON.stringify(result, null, 2)}`;
  } catch (error) {
    return `❌ Error updating intelligence learning: ${error.message}`;
  }
}
