export type CsvCell = string | number | null;

function serializeCell(value: CsvCell): string {
  const text = String(value ?? '');
  const trimmed = text.trimStart();
  // Préservez les nombres fournis et neutralisez les formules contenues dans le texte.
  const unsafe =
    !Number.isFinite(value) &&
    (/^[=+\-@＝＋－＠]/u.test(trimmed) || trimmed.charCodeAt(0) < 32 || /^[\t\r\n]/u.test(text));
  const safe = unsafe ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Sérialisez uniquement les colonnes et les lignes explicitement fournies. */
export function serializeCsv(
  columns: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  if (columns.length === 0) throw new RangeError('csv-columns-required');
  if (rows.some((row) => row.length !== columns.length)) throw new RangeError('csv-row-width');
  return `\uFEFF${[columns, ...rows].map((row) => row.map(serializeCell).join(',')).join('\r\n')}\r\n`;
}
