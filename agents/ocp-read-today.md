---
description: Read today's context summary
usage: '@ocp-read-today [--summary|--all]'
---

import { readTodaySummary } from '@devwellington/opencode-context-plugin';

export default async function({ session, args }) {
  const directory = session.directory;
  const options = {
    summary: !args.includes('--all')
  };
  
  try {
    const result = await readTodaySummary(directory, options);
    return result;
  } catch (error) {
    return `❌ Error reading today's summary: ${error.message}`;
  }
}
