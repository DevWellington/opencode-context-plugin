export function getWeek(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return NaN;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

export function getWeekRange(year, week) {
  if (typeof year !== 'number' || typeof week !== 'number' || !Number.isFinite(year) || !Number.isFinite(week)) {
    return { start: '', end: '' };
  }
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const isoWeekStart = simple;
  if (dow <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setDate(isoWeekEnd.getDate() + 6);
  return {
    start: isoWeekStart.toISOString().split('T')[0],
    end: isoWeekEnd.toISOString().split('T')[0]
  };
}
