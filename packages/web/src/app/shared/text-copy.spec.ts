import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { TextCopy } from './text-copy';

describe('TextCopy', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        TextCopy,
        {
          provide: DOCUMENT,
          useValue: { defaultView: { navigator: { clipboard: { writeText } } } },
        },
      ],
    });

    await expect(TestBed.inject(TextCopy).copy('value')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('value');
  });

  it('uses the document copy command when the Clipboard API fails', async () => {
    const input = { value: '', style: {}, select: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        TextCopy,
        {
          provide: DOCUMENT,
          useValue: {
            defaultView: { navigator: {} },
            createElement: vi.fn().mockReturnValue(input),
            body: { appendChild },
            execCommand,
          },
        },
      ],
    });

    await expect(TestBed.inject(TextCopy).copy('fallback')).resolves.toBe(true);
    expect(input.value).toBe('fallback');
    expect(input.select).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(input.remove).toHaveBeenCalledOnce();
  });
});
