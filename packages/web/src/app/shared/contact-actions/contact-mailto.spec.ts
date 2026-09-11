import { translate } from '@froment/l10n';
import { describe, expect, it } from 'vitest';
import { contactMailto } from './contact-mailto';

describe('contactMailto', () => {
  it.each([
    ['', '', 'mailto:contact@froment.software'],
    ['Un sujet', '', 'mailto:contact@froment.software?subject=Un%20sujet'],
    ['', 'Un message', 'mailto:contact@froment.software?body=Un%20message'],
  ])('omits empty fields for subject %j and body %j', (subject, body, expected) => {
    expect(contactMailto(subject, body)).toBe(expected);
  });

  it('encodes spaces, literal plus signs, Unicode and reserved delimiters once', () => {
    expect(contactMailto('C++ & café?', 'a+b = 100% #1')).toBe(
      'mailto:contact@froment.software?subject=C%2B%2B%20%26%20caf%C3%A9%3F&body=a%2Bb%20%3D%20100%25%20%231',
    );
  });

  it('normalizes body line breaks to CRLF without doubling existing CRLF', () => {
    expect(contactMailto('', 'Un\nDeux\r\nTrois\rQuatre')).toBe(
      'mailto:contact@froment.software?body=Un%0D%0ADeux%0D%0ATrois%0D%0AQuatre',
    );
  });

  it('keeps the subject on one line and encodes header-like text as a value', () => {
    expect(contactMailto('Sujet\r\nBcc: autre@example.com\nSuite\rFin', '')).toBe(
      'mailto:contact@froment.software?subject=Sujet%20Bcc%3A%20autre%40example.com%20Suite%20Fin',
    );
  });

  it.each(['fr', 'en'] as const)(
    'preserves the %s contact translations after URI decoding',
    (language) => {
      for (const prefix of ['home.engage', 'services.quote'] as const) {
        const subject = translate(language, `${prefix}.subject`);
        const body = translate(language, `${prefix}.body`);
        const uri = contactMailto(subject, body);
        const fields = new Map(
          uri
            .split('?')[1]
            .split('&')
            .map((field) => {
              const [name, value] = field.split('=');
              return [name, decodeURIComponent(value)];
            }),
        );

        expect(fields).toEqual(
          new Map([
            ['subject', subject],
            ['body', body.replace(/\r\n|\r|\n/g, '\r\n')],
          ]),
        );
        expect(uri).not.toContain('+');
      }
    },
  );
});
