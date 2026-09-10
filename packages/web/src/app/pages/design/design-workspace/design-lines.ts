import { parseFixedDecimal } from '@backoffice/quote-input';

export interface DesignLine {
  readonly id: number;
  readonly name: string;
  readonly quantity: string;
  readonly unitPrice: string;
}

export function validQuantity(value: string): boolean {
  const quantity = parseFixedDecimal(value, 3);
  return quantity !== undefined && quantity > 0 && quantity <= 1_000_000;
}

export function validPrice(value: string): boolean {
  const price = parseFixedDecimal(value, 2);
  return price !== undefined && price <= 10_000_000;
}

export function lineAmount(line: Pick<DesignLine, 'quantity' | 'unitPrice'>): number | undefined {
  if (!validQuantity(line.quantity) || !validPrice(line.unitPrice)) return undefined;
  const quantity = parseFixedDecimal(line.quantity, 3);
  const price = parseFixedDecimal(line.unitPrice, 2);
  if (quantity === undefined || price === undefined) return undefined;
  return Number((BigInt(quantity) * BigInt(price) + 500n) / 1_000n);
}

export function lineSummary(lines: readonly DesignLine[]): number | undefined {
  let total = 0;
  for (const line of lines) {
    const amount = lineAmount(line);
    if (amount === undefined) return undefined;
    total += amount;
  }
  return Number.isSafeInteger(total) ? total : undefined;
}
