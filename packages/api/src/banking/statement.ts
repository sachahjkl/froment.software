import {
  BankImportInvalid,
  BankImportMaximumRecordLength,
  BankImportMaximumRowCount,
  CalendarDate,
  CurrencyCode,
  type BankCsvConfiguration,
  type BankImportRequestValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { parse } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';

const ParsedRow = Schema.Struct({
  reference: Schema.String,
  bookedOn: Schema.String,
  amount: Schema.String,
  currency: Schema.String,
  description: Schema.String,
});
type ParsedRow = typeof ParsedRow.Type;
const CsvRecord = Schema.Record(Schema.String, Schema.String);
const XmlObject = Schema.Record(Schema.String, Schema.Json);
type XmlValue = typeof Schema.Json.Type;

const normalizeDate = (value: string, format: BankCsvConfiguration['dateFormat']): string => {
  if (format === 'yyyy-MM-dd') return value;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match === null ? value : `${match[3]}-${match[2]}-${match[1]}`;
};

const parseCsv = (content: string, configuration: BankCsvConfiguration): ReadonlyArray<ParsedRow> =>
  Schema.decodeUnknownSync(Schema.Array(CsvRecord))(
    parse(content, {
      bom: true,
      columns: true,
      delimiter: configuration.delimiter,
      skip_empty_lines: true,
      max_record_size: BankImportMaximumRecordLength,
    }),
  ).map((row) => ({
    reference: row[configuration.referenceColumn] ?? '',
    bookedOn: normalizeDate(row[configuration.bookedOnColumn] ?? '', configuration.dateFormat),
    amount: row[configuration.amountColumn] ?? '',
    currency:
      configuration.currencyColumn === '' ? 'EUR' : (row[configuration.currencyColumn] ?? ''),
    description: row[configuration.descriptionColumn] ?? '',
  }));

const asRecord = (value: XmlValue | undefined): typeof XmlObject.Type | undefined =>
  Schema.is(XmlObject)(value) ? value : undefined;
const values = (value: XmlValue | undefined): ReadonlyArray<XmlValue> =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const child = (value: XmlValue | undefined, key: string): XmlValue | undefined =>
  asRecord(value)?.[key];
const text = (value: XmlValue | undefined): string => {
  if (Schema.is(Schema.String)(value)) return value;
  const node = asRecord(value);
  const content = node?.['#text'];
  return Schema.is(Schema.String)(content) ? content : '';
};

const parseCamt053 = (content: string): ReadonlyArray<ParsedRow> => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    removeNSPrefix: true,
    processEntities: false,
    isArray: (name) => name === 'Ntry',
  });
  const document = Schema.decodeUnknownSync(Schema.Json)(parser.parse(content));
  const statements = values(child(child(document, 'Document'), 'BkToCstmrStmt')).flatMap(
    (message) => values(child(message, 'Stmt')),
  );
  return statements.flatMap((statement) => {
    const statementCurrency = text(child(child(statement, 'Acct'), 'Ccy'));
    return values(child(statement, 'Ntry')).map((entry, index) => {
      const amountNode = child(entry, 'Amt');
      const creditDebit = text(child(entry, 'CdtDbtInd'));
      const unsignedAmount = text(amountNode);
      const signedAmount = creditDebit === 'DBIT' ? `-${unsignedAmount}` : unsignedAmount;
      const bookedDate = child(entry, 'BookgDt');
      const reference =
        text(child(entry, 'NtryRef')) ||
        text(child(entry, 'AcctSvcrRef')) ||
        `${text(child(statement, 'Id'))}-${index + 1}`;
      return {
        reference,
        bookedOn: text(child(bookedDate, 'Dt')) || text(child(bookedDate, 'DtTm')).slice(0, 10),
        amount: signedAmount,
        currency: text(child(amountNode, '@_Ccy')) || statementCurrency,
        description:
          text(child(entry, 'AddtlNtryInf')) ||
          text(child(child(child(entry, 'NtryDtls'), 'TxDtls'), 'AddtlTxInf')),
      };
    });
  });
};

const ofxField = (block: string, name: string): string => {
  const match = new RegExp(`<${name}>([^<\\r\\n]+)`, 'i').exec(block);
  return match?.[1]?.trim() ?? '';
};
const parseOfx = (content: string): ReadonlyArray<ParsedRow> => {
  const currency = ofxField(content, 'CURDEF');
  // oxlint-disable-next-line anti-slop/no-natural-language-literals -- OFX SGML transaction markup, not interface prose.
  const blocks =
    content.match(/<STMTTRN>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi) ?? [];
  return blocks.map((block) => {
    const timestamp = ofxField(block, 'DTPOSTED');
    const description = [ofxField(block, 'NAME'), ofxField(block, 'MEMO')]
      .filter((part) => part !== '')
      .join(' — ');
    return {
      reference: ofxField(block, 'FITID'),
      bookedOn: `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`,
      amount: ofxField(block, 'TRNAMT'),
      currency,
      description,
    };
  });
};

const amountCents = (value: string, decimalSeparator: '.' | ','): number => {
  const escapedSeparator = decimalSeparator === '.' ? '\\.' : ',';
  if (!new RegExp(`^-?\\d+${escapedSeparator}\\d{2}$`).test(value))
    throw new Error('bank.invalid_amount');
  const cents = BigInt(value.replace(decimalSeparator, ''));
  if (
    cents === 0n ||
    cents > BigInt(Number.MAX_SAFE_INTEGER) ||
    cents < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error('bank.invalid_amount');
  return Number(cents);
};

export const parseBankStatement = (request: BankImportRequestValue) => {
  try {
    const decimalSeparator = request.csvConfiguration?.decimalSeparator ?? '.';
    let parsed: ReadonlyArray<ParsedRow>;
    if (request.format === 'csv') {
      if (request.csvConfiguration === null) throw new Error('bank.csv_configuration_missing');
      parsed = parseCsv(request.content, request.csvConfiguration);
    } else if (request.format === 'camt.053') parsed = parseCamt053(request.content);
    else parsed = parseOfx(request.content);
    const rows = Schema.decodeUnknownSync(Schema.Array(ParsedRow))(parsed);
    if (rows.length === 0 || rows.length > BankImportMaximumRowCount)
      throw new Error('bank.row_limit');
    const references = new Set<string>();
    return rows.map((row) => {
      if (
        !Schema.is(CalendarDate)(row.bookedOn) ||
        row.reference.trim() === '' ||
        row.reference.length > 160 ||
        !Schema.is(CurrencyCode)(row.currency) ||
        row.description.length > 500 ||
        references.has(row.reference)
      )
        throw new Error('bank.invalid_row');
      references.add(row.reference);
      return {
        reference: row.reference,
        bookedOn: row.bookedOn,
        amountCents: amountCents(row.amount, decimalSeparator),
        currency: Schema.decodeUnknownSync(CurrencyCode)(row.currency),
        description: row.description,
      };
    });
  } catch {
    throw new BankImportInvalid({ code: 'bank.import_invalid' });
  }
};
