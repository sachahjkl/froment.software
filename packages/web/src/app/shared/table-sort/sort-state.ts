export function nextTableSort<Value extends string>(
  sort: string,
  ascending: Value,
  descending: Value,
): Value | 'none' {
  if (sort === ascending) return descending;
  if (sort === descending) return 'none';
  return ascending;
}
