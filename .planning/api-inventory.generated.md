# API Export Inventory (Auto-Generated)

Generated: 2026-05-25T09:37:43Z
Source: src

## Exports Found

| Export | File | Line | Type |
|--------|------|------|------|
| export const TRUNCATE = { | src/constants.js | 1 |  |
| export const TIMEOUT = { | src/constants.js | 9 |  |
| export const MS = { | src/constants.js | 14 |  |
| export async function generateMonthlySummary(directory, monthDate) { | src/agents/generateMonthly.js | 184 |  |
| export function parseExistingEntries(content) { | src/agents/intelligenceDeduplicator.js | 6 |  |
| export function transformToReferenceSchema(allEntries, latestEntry, reportIntelligence = null, config = null) { | src/agents/intelligenceDeduplicator.js | 387 |  |
| export { stripFieldHeader, cleanOldLinks }; | src/agents/intelligenceDeduplicator.js | 441 |  |
| export const REFERENCE_SCHEMA = { | src/agents/intelligenceTemplate.js | 5 |  |
| export function generateReferenceContent(patternData) { | src/agents/intelligenceTemplate.js | 18 |  |
| export function generateIntelligenceContent(entries, latestEntry) { | src/agents/intelligenceTemplate.js | 126 |  |
| export async function readIntelligenceLearning(directory, options = { summary: true }) { | src/agents/readIntelligenceLearning.js | 15 |  |
| export async function generateWeeklySummary(directory, weekDate) { | src/agents/generateWeekly.js | 186 |  |
| export async function generateTodaySummary(directory) { | src/agents/generateToday.js | 22 |  |
| export { REFERENCE_SCHEMA, generateReferenceContent, generateIntelligenceContent }; | src/agents/generateIntelligenceLearning.js | 29 |  |
| export async function updateIntelligenceLearning(directory, opencodeClient = null) { | src/agents/generateIntelligenceLearning.js | 36 |  |
| export async function readAnnualSummary(directory, year, options = { summary: true }) { | src/agents/readAnnual.js | 15 |  |
| export { generateTodaySummary } from './generateToday.js'; | src/agents/index.js | 9 |  |
| export { generateWeeklySummary } from './generateWeekly.js'; | src/agents/index.js | 10 |  |
| export { generateMonthlySummary } from './generateMonthly.js'; | src/agents/index.js | 11 |  |
| export { generateAnnualSummary } from './generateAnnual.js'; | src/agents/index.js | 12 |  |
| export { updateIntelligenceLearning } from './generateIntelligenceLearning.js'; | src/agents/index.js | 13 |  |
| export { readTodaySummary } from './readToday.js'; | src/agents/index.js | 16 |  |
| export { readWeeklySummary } from './readWeekly.js'; | src/agents/index.js | 17 |  |
| export { readMonthlySummary } from './readMonthly.js'; | src/agents/index.js | 18 |  |
| export { readAnnualSummary } from './readAnnual.js'; | src/agents/index.js | 19 |  |
| export { readIntelligenceLearning } from './readIntelligenceLearning.js'; | src/agents/index.js | 20 |  |
| export { showHelp } from './ocpHelp.js'; | src/agents/index.js | 23 |  |
| export { REPORT_PATHS } from './utils/linkBuilder.js'; | src/agents/index.js | 26 |  |
| export async function generateAnnualSummary(directory, targetYear) { | src/agents/generateAnnual.js | 218 |  |
| export { CONTEXT_SESSION_DIR }; | src/agents/utils/linkBuilder.js | 7 |  |
| export const REPORT_PATHS = { | src/agents/utils/linkBuilder.js | 9 |  |
| export const KNOWN_REPORTS = { | src/agents/utils/linkBuilder.js | 20 |  |
| export function extractKeywordsFromContent(content, maxKeywords = 20) { | src/agents/utils/linkBuilder.js | 35 |  |
| export function buildKeywords(context) { | src/agents/utils/linkBuilder.js | 145 |  |
| export function formatFileHeader(title, keywords) { | src/agents/utils/linkBuilder.js | 155 |  |
| export function addRelatedLinks(relatedFiles) { | src/agents/utils/linkBuilder.js | 170 |  |
| export function generateKeywordLinks(options) { | src/agents/utils/linkBuilder.js | 181 |  |
| export function addKeywordNavigation(context) { | src/agents/utils/linkBuilder.js | 245 |  |
| export async function readFileContent(filePath, options = { summary: true }) { | src/agents/utils/fileReader.js | 10 |  |
| export function extractSummary(content) { | src/agents/utils/fileReader.js | 32 |  |
| export async function fileExists(filePath) { | src/agents/utils/fileReader.js | 61 |  |
| export async function readTodaySummary(directory, options = { summary: true }) { | src/agents/readToday.js | 15 |  |
| export async function readWeeklySummary(directory, weekDate, options = { summary: true }) { | src/agents/readWeekly.js | 16 |  |
| export function showHelp(agentName = null) { | src/agents/ocpHelp.js | 120 |  |
| export function isLowQualityPattern(pattern) { | src/agents/reportExtractor.js | 14 |  |
| export async function extractIntelligenceFromReports(directory) { | src/agents/reportExtractor.js | 39 |  |
| export function extractPendingItemsFromContent(content) { | src/agents/reportExtractor.js | 221 |  |
| export function extractAccomplishedFromContent(content) { | src/agents/reportExtractor.js | 250 |  |
| export function mergePatterns(reportPatterns, sessionPatterns) { | src/agents/reportExtractor.js | 269 |  |
| export async function readMonthlySummary(directory, monthDate, options = { summary: true }) { | src/agents/readMonthly.js | 15 |  |
| export const ISSUE_PATTERNS = [ | src/agents/intelligencePatterns.js | 6 |  |
| export const ISSUE_ANTI_PATTERNS = [ | src/agents/intelligencePatterns.js | 25 |  |
| export const FAILED_APPROACH_PATTERNS = [ | src/agents/intelligencePatterns.js | 65 |  |
| export const LOW_QUALITY_ACCOMPLISHMENT_PATTERNS = [ | src/agents/intelligencePatterns.js | 78 |  |
| export function containsIssuePattern(text) { | src/agents/intelligencePatterns.js | 92 |  |
| export function isLowQualityAccomplishment(text) { | src/agents/intelligencePatterns.js | 105 |  |
| export { createDebugLogger, CONTEXT_SESSION_DIR }; | src/utils/fileUtils.js | 8 |  |
| export async function atomicWrite(filePath, content) { | src/utils/fileUtils.js | 13 |  |
| export function getTimestamp() { | src/utils/fileUtils.js | 37 |  |
| export function withTimeout(taskOrPromise, ms, labelOrOptions = 'operation') { | src/utils/fileUtils.js | 49 |  |
| export function createAbortController() { | src/utils/fileUtils.js | 105 |  |
| export async function recoverOrphanedTempFiles(baseDir = CONTEXT_SESSION_DIR) { | src/utils/fileUtils.js | 114 |  |
| export function getHomeDir() { | src/utils/homeDir.js | 3 |  |
| export function extractSection(content, sectionHeading) { | src/utils/summaryUtils.js | 10 |  |
| export const GREETING_PATTERNS = [ | src/utils/greetingFilter.js | 6 |  |
| export const GREETING_KEYWORDS = [ | src/utils/greetingFilter.js | 12 |  |
| export function isGreeting(content) { | src/utils/greetingFilter.js | 16 |  |
| export function isGreetingTitle(title, hasStructuredContent = false) { | src/utils/greetingFilter.js | 30 |  |
| export function hasStructuredWorkContent(content) { | src/utils/greetingFilter.js | 67 |  |
| export function isGreetingContent(content, title) { | src/utils/greetingFilter.js | 81 |  |
| export function debounce(fn, delayMs) { | src/utils/debounce.js | 12 |  |
| export function getGlobalIntelligencePath() { | src/utils/globalIntelligence.js | 13 |  |
| export async function initializeGlobalIntelligence() { | src/utils/globalIntelligence.js | 30 |  |
| export async function updateGlobalIntelligence(projectName, sessionInfo) { | src/utils/globalIntelligence.js | 112 |  |
| export async function queryGlobalIntelligence(pattern) { | src/utils/globalIntelligence.js | 245 |  |
| export function resetThrottleCache() { | src/utils/errorUtils.js | 16 |  |
| export function isExpectedFsError(err, expectedCodes = ['ENOENT']) { | src/utils/errorUtils.js | 26 |  |
| export function logUnexpectedError(err, module, operation, logger, expectedCodes = ['ENOENT']) { | src/utils/errorUtils.js | 39 |  |
| export function throttledLog(err, module, operation, logger, expectedCodes = ['ENOENT']) { | src/utils/errorUtils.js | 54 |  |
| export function handleCatch(err, module, operation, logger = null, expectedCodes = ['ENOENT']) { | src/utils/errorUtils.js | 72 |  |
| export function getGlobalIntelligencePath() { | src/utils/crossProjectLinks.js | 21 |  |
| export function parseCrossProjectLink(link) { | src/utils/crossProjectLinks.js | 38 |  |
| export function formatCrossProjectLink(projectName, sessionPath) { | src/utils/crossProjectLinks.js | 73 |  |
| export async function resolveCrossProjectLink(link, currentProjectDir = null, options = {}) { | src/utils/crossProjectLinks.js | 337 |  |
| export async function findRelatedSessions(currentSession, options = {}) { | src/utils/crossProjectLinks.js | 469 |  |
| export async function resolveLinksInContent(content, currentProjectDir = null) { | src/utils/crossProjectLinks.js | 691 |  |
| export function matchesAnyPattern(content, patterns) { | src/utils/patternMatcher.js | 14 |  |
| export function matchesPattern(content, pattern) { | src/utils/patternMatcher.js | 34 |  |
| export function isProtectedSession(sessionInfo) { | src/utils/patternMatcher.js | 100 |  |
| export function isProtectedContent(content) { | src/utils/patternMatcher.js | 133 |  |
| export function getProtectionStatus(sessionInfo, content = null) { | src/utils/patternMatcher.js | 164 |  |
| export function isProtected(item) { | src/utils/patternMatcher.js | 182 |  |
| export function isProtectedPath(filePath, fileName) { | src/utils/patternMatcher.js | 201 |  |
| export { normalizePattern, dedupePatterns } from '../modules/contentExtractor.js'; | src/utils/patternMatcher.js | 219 |  |
| export const DEBUG_KEY = 'debug'; | src/utils/debug.js | 6 |  |
| export function createDebugLogger(namespace) { | src/utils/debug.js | 124 |  |
| export function debugLog(message) { | src/utils/debug.js | 155 |  |
| export const defaultConfig = { | src/config.js | 9 |  |
| export async function loadConfig(directory) { | src/config.js | 116 |  |
| export function getConfig() { | src/config.js | 167 |  |
| export function hasProtectedPatterns() { | src/config.js | 175 |  |
| export { LOG_FILE, CONTEXT_SESSION_DIR }; | src/config.js | 182 |  |
| export function validateSessionContent(content, sessionPath = 'unknown') { | src/modules/contextValidator.js | 26 |  |
| export async function logFailedValidation(baseDir, result, sessionPath) { | src/modules/contextValidator.js | 80 |  |
| export async function validateAfterSave(baseDir, content, sessionPath) { | src/modules/contextValidator.js | 138 |  |
| export function getSuggestions(result) { | src/modules/contextValidator.js | 153 |  |
| export { readDaySessions, isDayFullyProtected, groupBy, formatTypeName, synthesizeByTheme, extractTheme, computeWeekHighlights, dedupePatternsByKey, getDebounceDelay, getPinnedPatternsSection }; | src/modules/daySummaryAggregator.js | 302 |  |
| export async function getCachedContexts(baseDir) { | src/modules/contextCache.js | 27 |  |
| export async function getCachedContext(contextId, baseDir) { | src/modules/contextCache.js | 44 |  |
| export async function isCacheValid(contextId, baseDir) { | src/modules/contextCache.js | 52 |  |
| export async function saveToCache(contexts, baseDir) { | src/modules/contextCache.js | 69 |  |
| export async function invalidateCache(baseDir) { | src/modules/contextCache.js | 83 |  |
| export async function getCacheStats(baseDir) { | src/modules/contextCache.js | 98 |  |
| export function estimateTokens(content) { | src/modules/tokenLimit.js | 12 |  |
| export function isCodeContent(content) { | src/modules/tokenLimit.js | 45 |  |
| export function countTokens(content, type = null) { | src/modules/tokenLimit.js | 58 |  |
| export function countSessionTokens(messages) { | src/modules/tokenLimit.js | 73 |  |
| export function truncateToTokenLimit(content, maxTokens) { | src/modules/tokenLimit.js | 103 |  |
| export function truncateToBudget(content, maxChars) { | src/modules/tokenLimit.js | 122 |  |
| export function distributeTokenBudget(contexts, maxTokens) { | src/modules/tokenLimit.js | 158 |  |
| export async function wasGuidanceShown(baseDir, sessionId) { | src/modules/sessionGuidance.js | 12 |  |
| export async function markGuidanceShown(baseDir, sessionId) { | src/modules/sessionGuidance.js | 20 |  |
| export async function generateSessionGuidance(baseDir, session) { | src/modules/sessionGuidance.js | 31 |  |
| export async function getSessionGuidance(baseDir, session) { | src/modules/sessionGuidance.js | 102 |  |
| export const updateDailySummary = debounce(updateDailySummaryImpl, getDebounceDelay); | src/modules/summaryUpdater.js | 317 |  |
| export const updateWeekSummary = debounce(updateWeekSummaryImpl, getDebounceDelay); | src/modules/summaryUpdater.js | 318 |  |
| export { updateDaySummary }; | src/modules/summaryUpdater.js | 319 |  |
| export function isHighPriority(sessionData) { | src/modules/intelligence.js | 15 |  |
| export async function initializeIntelligenceLearning(baseDir) { | src/modules/intelligence.js | 19 |  |
| export function preservePersistentPatterns(existingContent, newPatterns) { | src/modules/intelligence.js | 78 |  |
| export function generateIntelligenceLearning(sessions) { | src/modules/intelligence.js | 267 |  |
| export function parseSearchQuery(rawQuery) { | src/modules/searchQuery.js | 11 |  |
| export async function executeSearch(directory, query, options = {}) { | src/modules/searchQuery.js | 71 |  |
| export function formatSearchResults(results, options = {}) { | src/modules/searchQuery.js | 128 |  |
| export async function loadSyncState() { | src/modules/syncState.js | 18 |  |
| export async function saveSyncState(state) { | src/modules/syncState.js | 27 |  |
| export function getDefaultSyncState() { | src/modules/syncState.js | 38 |  |
| export async function scoreContextRelevance(contextPath, currentSession) { | src/modules/relevanceScoring.js | 14 |  |
| export { | src/modules/remoteSync.js | 4 |  |
| export { | src/modules/remoteSync.js | 13 |  |
| export async function scanSessionsInRange(directory, startDate, endDate, opencodeClient = null) { | src/modules/reportGenerator.js | 149 |  |
| export async function generateMonthlyReport(directory, monthYear, opencodeClient = null) { | src/modules/reportGenerator.js | 368 |  |
| export async function generateAnnualReport(directory, year, opencodeClient = null) { | src/modules/reportGenerator.js | 565 |  |
| export async function generateActivityReport(directory, options = {}, opencodeClient = null) { | src/modules/reportGenerator.js | 776 |  |
| export async function generateWeeklyReport(directory, weekStart, opencodeClient = null) { | src/modules/reportGenerator.js | 824 |  |
| export async function saveReport(directory, report, filename) { | src/modules/reportGenerator.js | 867 |  |
| export function parseSessionToMessages(sessionContent) { | src/modules/daySummaryFormatter.js | 13 |  |
| export function groupDiscoveriesByType(discoveries) { | src/modules/daySummaryFormatter.js | 56 |  |
| export function groupFilesByProject(files) { | src/modules/daySummaryFormatter.js | 104 |  |
| export function extractKeyDecisions(sessionsData) { | src/modules/daySummaryFormatter.js | 133 |  |
| export function formatDayContent(dateStr, sessionsData, year, month, week, allContent = '') { | src/modules/daySummaryFormatter.js | 467 |  |
| export async function listAvailableContexts(currentSession, options = {}) { | src/modules/injectPrompt.js | 22 |  |
| export function formatContextPreview(contexts) { | src/modules/injectPrompt.js | 54 |  |
| export async function interactiveInject(currentSession, selectedIndices = null, baseDir = process.cwd()) { | src/modules/injectPrompt.js | 81 |  |
| export async function loadState(baseDir) { | src/modules/state.js | 57 |  |
| export async function saveState(baseDir, state, expectedVersion = null) { | src/modules/state.js | 78 |  |
| export async function getLastSummarized(baseDir, key) { | src/modules/state.js | 117 |  |
| export async function setLastSummarized(baseDir, key, info) { | src/modules/state.js | 128 |  |
| export async function getPendingQueue(baseDir) { | src/modules/state.js | 148 |  |
| export async function addToPendingQueue(baseDir, item) { | src/modules/state.js | 158 |  |
| export async function clearPendingQueue(baseDir, type = null) { | src/modules/state.js | 181 |  |
| export async function markSummaryComplete(baseDir, key, info) { | src/modules/state.js | 203 |  |
| export { createDebugLogger }; | src/modules/saveContext.js | 19 |  |
| export { atomicWrite, getTimestamp }; | src/modules/saveContext.js | 25 |  |
| export async function ensureHierarchicalDir(baseDir) { | src/modules/saveContext.js | 131 |  |
| export function extractSessionSummary(session) { | src/modules/saveContext.js | 150 |  |
| export async function saveContext(directory, session, type = 'compact', opencodeClient = null) { | src/modules/saveContext.js | 177 |  |
| export class RemoteSyncProvider { | src/modules/syncProviders.js | 8 |  |
| export class S3SyncProvider extends RemoteSyncProvider { | src/modules/syncProviders.js | 40 |  |
| export class GCSyncProvider extends RemoteSyncProvider { | src/modules/syncProviders.js | 130 |  |
| export class CustomSyncProvider extends RemoteSyncProvider { | src/modules/syncProviders.js | 218 |  |
| export function shouldRegenerate(oldContent, newContent, threshold = 0.05) { | src/modules/summaries.js | 21 |  |
| export function hasNewSessions(existingSummary, newSessions) { | src/modules/summaries.js | 50 |  |
| export { updateDailySummary, updateWeekSummary, updateDaySummary } from './summaryUpdater.js'; | src/modules/summaries.js | 108 |  |
| export async function configureRemoteSync(provider, config) { | src/modules/syncOperations.js | 41 |  |
| export async function getSyncStatus() { | src/modules/syncOperations.js | 128 |  |
| export async function syncToRemote(directory) { | src/modules/syncOperations.js | 145 |  |
| export async function syncGlobalIntelligence() { | src/modules/syncOperations.js | 229 |  |
| export async function markPendingChanges() { | src/modules/syncOperations.js | 236 |  |
| export async function initializeRemoteSync() { | src/modules/syncOperations.js | 247 |  |
| export { | src/modules/contentExtractor.js | 8 |  |
| export { | src/modules/contentExtractor.js | 15 |  |
| export { | src/modules/contentExtractor.js | 20 |  |
| export { | src/modules/contentExtractor.js | 24 |  |
| export async function buildSearchIndex(directory = process.cwd()) { | src/modules/searchIndexer.js | 48 |  |
| export async function loadSearchIndex(directory = process.cwd()) { | src/modules/searchIndexer.js | 141 |  |
| export async function searchSessions(directory, query, options = {}) { | src/modules/searchIndexer.js | 158 |  |
| export async function getIndexStats(directory = process.cwd()) { | src/modules/searchIndexer.js | 245 |  |
| export async function updateSearchIndex(directory, sessionFilePath) { | src/modules/searchIndexer.js | 268 |  |
| export function findPatterns(sessions, existingPatterns = []) { | src/modules/extractors/patternDetector.js | 316 |  |
| export function extractPersistentPatterns(intelligenceContent) { | src/modules/extractors/patternDetector.js | 395 |  |
| export function normalizePattern(pattern) { | src/modules/extractors/patternDetector.js | 520 |  |
| export function dedupePatterns(patterns) { | src/modules/extractors/patternDetector.js | 535 |  |
| export function filterPinnedFromRecent(recentPatterns, pinnedPatterns) { | src/modules/extractors/patternDetector.js | 575 |  |
| export async function inferMissingFields(sessionContent, opencodeClient = null) { | src/modules/extractors/llmEnricher.js | 85 |  |
| export function extractSessionContent(sessionContent) { | src/modules/extractors/sectionExtractor.js | 139 |  |
| export async function enrichWithRelatedSessions(extractedContent, sessionContent, options = {}) { | src/modules/extractors/sectionExtractor.js | 245 |  |
| export function extractCrossProjectLinks(sessionContent) { | src/modules/extractors/sectionExtractor.js | 307 |  |
| export function classifySessionPriority(sessionContent) { | src/modules/extractors/sectionExtractor.js | 334 |  |
| export function isValidBugSymptom(symptom) { | src/modules/extractors/bugExtractor.js | 87 |  |
| export function extractBugs(sessionContent) { | src/modules/extractors/bugExtractor.js | 125 |  |
| export async function getRelevantContexts(currentSession, options = {}) { | src/modules/contextInjector.js | 82 |  |
| export async function selectContextsInteractively(contexts) { | src/modules/contextInjector.js | 154 |  |
| export async function injectContextPrompt(currentSession, baseDir = process.cwd()) { | src/modules/contextInjector.js | 166 |  |
| export function formatForInjection(scoredContexts) { | src/modules/contextInjector.js | 181 |  |
| export async function detectProjectType(dir) { | src/modules/projectTemplates.js | 48 |  |
| export async function getRecommendedTemplate(projectType) { | src/modules/projectTemplates.js | 100 |  |
| export async function generateProjectTemplate(options = {}) { | src/modules/projectTemplates.js | 124 |  |
| export async function initializeFromTemplate(templatePath, targetDir, options = {}) { | src/modules/projectTemplates.js | 270 |  |
| export async function listTemplates() { | src/modules/projectTemplates.js | 423 |  |
| export async function handleMessageUpdatedOrCreated(event) { | src/handlers/messageHandlers.js | 9 |  |
| export async function handleMessagePartDelta(event) { | src/handlers/messageHandlers.js | 25 |  |
| export async function handleMessagePartUpdated(event) { | src/handlers/messageHandlers.js | 42 |  |
| export function handleCommandExecuteBefore(event) { | src/handlers/commandHandlers.js | 5 |  |
| export function getCurrentSessionId() { return sessionState.getCurrentSessionId(); } | src/handlers/sessionHandlers.js | 11 |  |
| export function setCurrentSessionId(v) { sessionState.setCurrentSessionId(v); } | src/handlers/sessionHandlers.js | 12 |  |
| export function getHasInjectedContext() { return sessionState.getHasInjectedContext(); } | src/handlers/sessionHandlers.js | 13 |  |
| export function setHasInjectedContext(v) { sessionState.setHasInjectedContext(v); } | src/handlers/sessionHandlers.js | 14 |  |
| export function getLastSession() { return sessionState.getLastSession(); } | src/handlers/sessionHandlers.js | 15 |  |
| export function setLastSession(v) { sessionState.setLastSession(v); } | src/handlers/sessionHandlers.js | 16 |  |
| export async function resetSessionState() { | src/handlers/sessionHandlers.js | 18 |  |
| export async function handleSessionCreated(event, directory) { | src/handlers/sessionHandlers.js | 22 |  |
| export async function handleSessionUpdated(event) { | src/handlers/sessionHandlers.js | 31 |  |
| export async function handleSessionEnd(directory, client, config) { | src/handlers/sessionHandlers.js | 40 |  |
| export async function handleSessionIdle(directory, client, sessionId) { | src/handlers/sessionHandlers.js | 62 |  |
| export async function handleSessionCompacted(directory, client) { | src/handlers/sessionHandlers.js | 107 |  |
| export class SessionState { | src/handlers/sessionState.js | 1 |  |
| export const sessionState = new SessionState(); | src/handlers/sessionState.js | 123 |  |
| export function isDestroyed() { | src/handlers/lifecycle.js | 3 |  |
| export function setDestroyed(value) { | src/handlers/lifecycle.js | 7 |  |
| export async function destroy() { | src/handlers/lifecycle.js | 11 |  |
| export async function init() { | src/handlers/lifecycle.js | 15 |  |

## Export Usage Analysis


## Summary

- **Total exports:** 232
- **Potentially unused:** 0
0
