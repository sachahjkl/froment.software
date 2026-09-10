import { lineAmount, lineSummary, validPrice, validQuantity } from './design-lines';

describe('design line calculations', () => {
  it('parses commas and dots without floating-point multiplication', () => {
    expect(lineAmount({ quantity: '1,500', unitPrice: '19.99' })).toBe(2999);
    expect(lineAmount({ quantity: '0.001', unitPrice: '5,00' })).toBe(1);
    expect(lineAmount({ quantity: '3', unitPrice: '0.10' })).toBe(30);
  });

  it('rejects invalid, negative, excessive and over-precise values', () => {
    for (const quantity of ['0', '-1', '1e3', '1.0001', '1000.001', '']) {
      expect(validQuantity(quantity)).toBe(false);
      expect(lineAmount({ quantity, unitPrice: '5' })).toBeUndefined();
    }
    for (const price of ['-1', '1e3', '0.001', '100000.01', ''])
      expect(validPrice(price)).toBe(false);
    expect(validPrice('0')).toBe(true);
  });

  it('sums rounded lines and never silently treats invalid input as zero', () => {
    const lines = [
      { id: 1, name: 'A', quantity: '1.5', unitPrice: '19.99' },
      { id: 2, name: 'B', quantity: '2', unitPrice: '0.10' },
    ];
    expect(lineSummary(lines)).toBe(3019);
    expect(
      lineSummary([...lines, { id: 3, name: 'C', quantity: '', unitPrice: '1' }]),
    ).toBeUndefined();
  });
});
