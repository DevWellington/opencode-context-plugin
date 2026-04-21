/**
 * Agent Registry
 * Exports all available agents for external use
 *
 * SOLID: Each agent is a thin wrapper with single responsibility
 */

// Generate agents
export { generateTodaySummary } from './generateToday.js';
export { generateWeeklySummary } from './generateWeekly.js';
export { generateMonthlySummary } from './generateMonthly.js';
export { generateAnnualSummary } from './generateAnnual.js';
export { updateIntelligenceLearning } from './generateIntelligenceLearning.js';

// Read agents
export { readTodaySummary } from './readToday.js';
export { readWeeklySummary } from './readWeekly.js';
export { readMonthlySummary } from './readMonthly.js';
export { readAnnualSummary } from './readAnnual.js';
export { readIntelligenceLearning } from './readIntelligenceLearning.js';

// Utilities
export { showHelp } from './ocpHelp.js';

// Re-export constants for consistency
export { REPORTS_DIR, REPORT_PATHS } from './utils/linkBuilder.js';
