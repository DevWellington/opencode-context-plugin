---
description: Generate weekly context summary with daily breakdown
usage: '@ocp-generate-weekly [date]'
---

import { generateWeeklySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const date = args[0] || new Date().toISOString();
  
  try {
    const result = await generateWeeklySummary(directory, date);
    return `✅ Weekly summary generated successfully!\n\n${result}`;
  } catch (error) {
    return `❌ Error generating weekly summary: ${error.message}`;
  }
}
