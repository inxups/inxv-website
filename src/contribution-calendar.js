export function calendarLayout(days) {
  const firstWeekday = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const columns = Math.ceil((firstWeekday + days.length) / 7);
  const cells = days.map((day, index) => ({
    ...day,
    column: Math.floor((firstWeekday + index) / 7),
    row: (firstWeekday + index) % 7,
  }));
  const months = [];
  cells.forEach((day, index) => {
    if (index && !day.date.endsWith('-01')) return;
    if (months.length && day.column - months.at(-1).column < 3) months.pop();
    months.push({ column: day.column, label: `${Number(day.date.slice(5, 7))}月` });
  });
  return { cells, columns, months };
}
