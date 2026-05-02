---
description: Generate annual context summary by aggregating monthly reports (reads monthly-*.md)
usage: '@ocp-generate-annual [year]'

import { generateAnnualSummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const year = args[0] || new Date().getFullYear().toString();
  
  try {
    const result = await generateAnnualSummary(directory, year);
    return `✅ Annual summary generated!\n\n**Summary:**\n- Generated annual report\n[View file](${directory}/reports/annual-${year}.md)`;
  } catch (error) {
    return `❌ Error generating annual summary: ${error.message}`;
  }
}
