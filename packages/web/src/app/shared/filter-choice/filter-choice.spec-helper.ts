import { vi } from 'vitest';

export function installScrollIntoView() {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  });
  return {
    scroll,
    restore: () => {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    },
  };
}

export function pressKey(element: HTMLElement, key: string, keyCode = 0): void {
  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      keyCode,
      bubbles: true,
      cancelable: true,
    }),
  );
}
