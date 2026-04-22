---
description: Generate weekly context summary by aggregating daily summaries (week-summary.md reads from day-summary.md)
usage: '@ocp-generate-weekly [date]'

import { generateWeeklySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const date = args[0] || new Date().toISOString();
  
  try {
    const result = await generateWeeklySummary(directory, date);
    return `✅ Weekly summary generated to week-summary.md!\n\n${result}`;
  } catch (error) {
    return `❌ Error generating weekly summary: ${error.message}`;
  }
}
