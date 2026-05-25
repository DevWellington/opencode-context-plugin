---
description: Read monthly context summary
usage: '@ocp-read-monthly [month] [--summary|--all]'
---

import { readMonthlySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const month = args.find(a => /^\d{4}-\d{2}$/.test(a));
  const options = {
    summary: !args.includes('--all')
  };
  
  try {
    const result = await readMonthlySummary(directory, month, options);
    return result;
  } catch (error) {
    return `❌ Error reading monthly summary: ${error.message}`;
  }
}
