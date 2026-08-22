import { computed, type Signal } from '@angular/core';
import Fuse, { type FuseResult, type IFuseOptions } from 'fuse.js';

export const createFuzzySearch = <Item>(
  items: Signal<ReadonlyArray<Item>>,
  query: Signal<string>,
  options: IFuseOptions<Item>,
): Signal<ReadonlyArray<FuseResult<Item>>> => {
  const index = computed(() => new Fuse(items(), options));
  return computed(() => {
    const value = query().trim();
    return value.length === 0
      ? items().map((item, refIndex) => ({ item, refIndex }))
      : index().search(value);
  });
};
