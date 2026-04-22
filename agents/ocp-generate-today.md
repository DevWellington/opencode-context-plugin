---
description: Generate today's context summary by reading all session files (compact-*.md, exit-*.md) from today
usage: '@ocp-generate-today'

import { generateTodaySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session }) {
  const directory = session.directory;
  
  try {
    const result = await generateTodaySummary(directory);
    return `✅ Today's summary generated to daily-summary.md!\n\n${result}`;
  } catch (error) {
    return `❌ Error generating today's summary: ${error.message}`;
  }
}
