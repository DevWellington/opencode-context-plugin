---
description: Generate monthly context summary with weekly statistics
usage: '@ocp-generate-monthly [month]'
---

import { generateMonthlySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const month = args[0] || new Date().toISOString().slice(0, 7);
  
  try {
    const result = await generateMonthlySummary(directory, month);
    return `✅ Monthly summary generated successfully!\n\n${result}`;
  } catch (error) {
    return `❌ Error generating monthly summary: ${error.message}`;
  }
}
