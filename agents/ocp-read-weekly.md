---
description: Read weekly context summary
usage: '@ocp-read-weekly [date] [--summary|--all]'
---

import { readWeeklySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}/.test(a));
  const options = {
    summary: !args.includes('--all')
  };
  
  try {
    const result = await readWeeklySummary(directory, date, options);
    return result;
  } catch (error) {
    return `❌ Error reading weekly summary: ${error.message}`;
  }
}
