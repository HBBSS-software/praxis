const formulaInjectionPattern = /^[=+\-@\t\r]/;

function escapeCsvCell(value: string | number) {
  const text = String(value);
  const guarded = formulaInjectionPattern.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function formatCsv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n') + '\n';
}
