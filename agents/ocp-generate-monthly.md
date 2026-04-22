---
description: Generate monthly context summary by aggregating weekly reports (reads week-summary.md)
usage: '@ocp-generate-monthly [month]'

import { generateMonthlySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const month = args[0] || new Date().toISOString().slice(0, 7);
  
  try {
    const result = await generateMonthlySummary(directory, month);
    return `✅ Monthly summary generated to reports/monthly-*.md!\n\n${result}`;
  } catch (error) {
    return `❌ Error generating monthly summary: ${error.message}`;
  }
}
