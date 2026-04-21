---
description: Generate today's context summary with Obsidian-style linking
usage: '@ocp-generate-today'
---

import { generateTodaySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session }) {
  const directory = session.directory;
  
  try {
    const result = await generateTodaySummary(directory);
    return `✅ Today's summary generated successfully!\n\n${result}`;
  } catch (error) {
    return `❌ Error generating today's summary: ${error.message}`;
  }
}
