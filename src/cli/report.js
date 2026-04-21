#!/usr/bin/env node
/**
 * CLI report command
 * Usage: node src/cli/report.js [command] [options]
 *
 * Commands:
 *   weekly [date]      Generate weekly report (default: this week)
 *   monthly [month]    Generate monthly report (default: this month)
 *   range <start> <end> Generate report for date range
 *
 * Options:
 *   --save              Save report to file (default: stdout)
 *   --view              Open report in editor (if $EDITOR set)
 *   --force             Regenerate even if up-to-date
 */

import { generateWeeklyReport, generateMonthlyReport, generateActivityReport, saveReport } from '../modules/reportGenerator.js';
import { loadConfig } from '../config.js';

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
CLI Report Generator

Usage: node src/cli/report.js [command] [options]

Commands:
  weekly [date]      Generate weekly report (default: this week)
                     Date format: YYYY-MM-DD or 'last'
  monthly [month]   Generate monthly report (default: this month)
                     Month format: YYYY-MM
  range <start> <end> Generate report for date range
                     Dates: YYYY-MM-DD

Options:
  --save    Save report to file (default: stdout)
  --view    Open report in editor (if $EDITOR set)
  --force   Regenerate even if up-to-date

Examples:
  node src/cli/report.js weekly
  node src/cli/report.js weekly --date 2026-04-13
  node src/cli/report.js monthly
  node src/cli/report.js monthly --month 2026-04
  node src/cli/report.js range 2026-04-01 2026-04-21
  node src/cli/report.js weekly --save
`);
}

// Parse arguments
const command = args[0];
const options = {
  save: args.includes('--save'),
  view: args.includes('--view'),
  force: args.includes('--force')
};

// Extract date argument
const dateIndex = args.indexOf('--date');
const dateArg = dateIndex !== -1 ? args[dateIndex + 1] : null;

// Extract month argument
const monthIndex = args.indexOf('--month');
const monthArg = monthIndex !== -1 ? args[monthIndex + 1] : null;

async function main() {
  // Load config
  const directory = process.cwd();
  await loadConfig(directory);

  let report;
  let filename;

  try {
    switch (command) {
      case 'weekly': {
        const weekStart = dateArg || null;
        report = await generateWeeklyReport(directory, weekStart);

        // Determine filename
        const now = new Date();
        const year = now.getFullYear();
        const week = getWeekNumber(now);
        filename = `weekly-${year}-${String(week).padStart(2, '0')}.md`;
        break;
      }

      case 'monthly': {
        const monthYear = monthArg || null;
        report = await generateMonthlyReport(directory, monthYear);

        // Determine filename
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        filename = `monthly-${year}-${String(month).padStart(2, '0')}.md`;
        break;
      }

      case 'range': {
        const rangeIndex = 1;
        const startDate = args[rangeIndex];
        const endDate = args[rangeIndex + 1];

        if (!startDate || !endDate) {
          console.error('Error: range command requires <start> and <end> dates');
          process.exit(1);
        }

        report = await generateActivityReport(directory, { startDate, endDate });
        filename = `range-${startDate}-${endDate}.md`;
        break;
      }

      case '--help':
      case '-h':
      case 'help':
        showHelp();
        return;

      default:
        if (!command) {
          // Default to weekly if no command
          report = await generateWeeklyReport(directory, null);
          const now = new Date();
          const year = now.getFullYear();
          const week = getWeekNumber(now);
          filename = `weekly-${year}-${String(week).padStart(2, '0')}.md`;
        } else {
          console.error(`Unknown command: ${command}`);
          showHelp();
          process.exit(1);
        }
    }

    // Output report
    if (options.save) {
      const reportPath = await saveReport(directory, report, filename);
      console.log(`Report saved to: ${reportPath}`);
    } else {
      console.log(report);
    }

    // Open in editor if requested
    if (options.view && process.env.EDITOR) {
      const reportPath = await saveReport(directory, report, filename);
      const { exec } = await import('child_process');
      exec(`${process.env.EDITOR} "${reportPath}"`, (err) => {
        if (err) {
          console.error('Error opening editor:', err.message);
        }
      });
    }

  } catch (error) {
    console.error('Error generating report:', error.message);
    if (options.force) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

main().catch(console.error);
