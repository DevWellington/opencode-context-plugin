import { generateTodaySummary } from '../src/agents/generateToday.js';
import { generateWeeklySummary } from '../src/agents/generateWeekly.js';
import { generateMonthlySummary } from '../src/agents/generateMonthly.js';
import { generateAnnualSummary } from '../src/agents/generateAnnual.js';
import { updateIntelligenceLearning } from '../src/agents/generateIntelligenceLearning.js';

const dir = process.argv[2] || '.';
const now = new Date();
const year = now.getFullYear();
const month = `${year}-${String(now.getMonth()+1).padStart(2,'0')}`;

await generateTodaySummary(dir);
await generateWeeklySummary(dir);
await generateMonthlySummary(dir, month);
await generateAnnualSummary(dir, year);
await updateIntelligenceLearning(dir);
console.log('Regeneration complete');
