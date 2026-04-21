---
description: Generate annual context summary with yearly statistics
usage: '@ocp-generate-annual [year]'
---

import { generateAnnualSummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const year = args[0] || new Date().getFullYear().toString();
  
  try {
    const result = await generateAnnualSummary(directory, year);
    return `✅ Annual summary generated successfully!\n\n${result}`;
  } catch (error) {
    return `❌ Error generating annual summary: ${error.message}`;
  }
}
