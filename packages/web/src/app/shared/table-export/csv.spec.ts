import { serializeCsv } from './csv';

describe('serializeCsv', () => {
  it('writes a UTF-8 BOM, Unicode text, quoted cells, and CRLF records', () => {
    expect(
      serializeCsv(
        ['Nom', 'Montant'],
        [
          ['Zoé 東京 🌾', 12.5],
          [null, -7],
        ],
      ),
    ).toBe('\uFEFF"Nom","Montant"\r\n"Zoé 東京 🌾","12.5"\r\n"","-7"\r\n');
  });

  it('escapes quotes, separators, and line breaks without changing cell boundaries', () => {
    expect(serializeCsv(['Nom, prénom', 'Note'], [['A "B"', 'Ligne 1\r\nLigne 2, suite']])).toBe(
      '\uFEFF"Nom, prénom","Note"\r\n"A ""B""","Ligne 1\r\nLigne 2, suite"\r\n',
    );
  });

  it.each([
    '=1+1',
    '+SUM(A1)',
    '-10',
    '@SUM(A1)',
    '  =1+1',
    '\u00a0+1',
    '\uFEFF=1',
    '\ttext',
    '\rtext',
    '\ntext',
    '\u0000=1',
    '＝1',
    '＋1',
    '－1',
    '＠SUM(A1)',
  ])('prevents a spreadsheet from interpreting the text %j as a formula', (text) => {
    expect(serializeCsv(['Value'], [[text]])).toBe(`\uFEFF"Value"\r\n"'${text}"\r\n`);
  });

  it('protects column labels and preserves actual numeric values', () => {
    expect(serializeCsv(['=Heading'], [[-10], ['-10'], [0]])).toBe(
      '\uFEFF"\'=Heading"\r\n"-10"\r\n"\'-10"\r\n"0"\r\n',
    );
  });

  it('uses only the supplied readonly rows without changing them', () => {
    const columns = Object.freeze(['Nom']);
    const rows = Object.freeze([Object.freeze(['Visible'])]);
    expect(serializeCsv(columns, rows)).toBe('\uFEFF"Nom"\r\n"Visible"\r\n');
    expect(rows).toEqual([['Visible']]);
    expect(serializeCsv(columns, [])).toBe('\uFEFF"Nom"\r\n');
  });

  it('rejects missing columns and rows that include unnamed cells', () => {
    expect(() => serializeCsv([], [])).toThrow('csv-columns-required');
    expect(() => serializeCsv(['Nom'], [['Visible', 'Not an exported column']])).toThrow(
      'csv-row-width',
    );
    expect(() => serializeCsv(['Nom', 'État'], [['Visible']])).toThrow('csv-row-width');
  });
});
