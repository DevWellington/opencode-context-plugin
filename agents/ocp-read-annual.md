---
description: Read annual context summary
usage: '@ocp-read-annual [year] [--summary|--all]'
---

import { readAnnualSummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const year = args.find(a => /^\d{4}$/.test(a));
  const options = {
    summary: !args.includes('--all')
  };
  
  try {
    const result = await readAnnualSummary(directory, year, options);
    return result;
  } catch (error) {
    return `❌ Error reading annual summary: ${error.message}`;
  }
}
