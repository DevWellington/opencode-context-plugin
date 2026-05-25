---
description: Update intelligence-learning.md by reading all 4 report levels (daily, weekly, monthly, annual) and updating the project's intelligence base
usage: '@ocp-generate-intelligence-learning'

import { updateIntelligenceLearning } from '@devwellington/opencode-context-plugin';

export default async function({ session }) {
  const directory = session.directory;
  
  try {
    const result = await updateIntelligenceLearning(directory);
    const isSkipped = result.skipped;
    const summary = isSkipped
      ? `Skipped: ${result.reason || 'No new sessions to process'}`
      : `Updated with ${result.newSessions || 0} new sessions across ${result.entries || 0} entries`;
    return `✅ Intelligence learning updated!\n\n**Summary:**\n- ${summary}\n[View file](${directory}/intelligence-learning.md)`;
  } catch (error) {
    return `❌ Error updating intelligence learning: ${error.message}`;
  }
}
