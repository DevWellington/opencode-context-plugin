# Requirements: Phase 09 Enhanced Summary Files

## SUMM-01: Day Summary Content Extraction
Day summary (day-summary.md in YYYY/MM/WW/DD/) must extract and display:
- Goals from session content (## Goal sections)
- Accomplishments from session content (## Accomplished sections)
- Discoveries from session content (## Discoveries sections)
- Bugs Fixed with symptom/solution pairs
- Relevant Files with file paths

**Success Condition:** day-summary.md contains sections for Goals, Accomplishments, Discoveries, Bugs Fixed, Relevant Files with extracted content, not just file counts.

## SUMM-02: Week Summary Content Aggregation
Week summary (week-summary.md in YYYY/MM/WW/) must aggregate:
- Goals from all sessions in the week
- Accomplishments from all days (deduplicated)
- Discoveries from all sessions
- Bugs Fixed with symptom/solution
- Relevant Files (unique file paths)
- Day-by-Day breakdown with top accomplishment per day

**Success Condition:** week-summary.md shows aggregated content across all days, not just counts.

## SUMM-03: Monthly Report Content Focus
Monthly report (monthly-YYYY-MM.md) must have:
- Executive Summary (2-3 sentence overview)
- Major Accomplishments (aggregated, deduplicated)
- Issues Resolved (bugs with symptom/solution/cause)
- Decisions Made (detected from session content)
- Week-by-Week Breakdown (session count + top accomplishments per week)
- Relevant Files (unique file paths)

**Success Condition:** monthly report follows content-focused structure similar to reportGenerator's generateMonthlyReport().

## SUMM-04: Annual Report Content Focus
Annual report (annual-YYYY.md) must have:
- Annual Theme (top 5 accomplishments with dates)
- Quarterly Themes (Q1-Q4 breakdown with session counts and top accomplishments)
- Project Evolution (month-by-month milestones with session count and top work)
- Bug History (table with symptom/solution/date)
- Summary Statistics (total sessions, bugs, files, per-quarter breakdown)

**Success Condition:** annual report follows content-focused structure similar to reportGenerator's generateAnnualReport().

## SUMM-05: Use Content Extractor Module
All summary generators must use contentExtractor.js:
- extractSessionContent() for goal, accomplished, discoveries, relevantFiles
- extractBugs() for bug tracking with symptom/cause/solution/prevention
- findPatterns() for cross-session pattern detection

**Success Condition:** No manual parsing of session content in summary generators; all use contentExtractor functions.