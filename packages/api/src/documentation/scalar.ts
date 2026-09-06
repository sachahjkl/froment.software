import type { Language } from '@froment/l10n';

// oxlint-disable-next-line anti-slop/no-natural-language-literals -- Static HTML and JavaScript, not interface prose.
export const scalarDocumentation = (language: Language): string => `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API — froment.software</title>
</head>
<body>
  <div id="scalar-reference-container"></div>
  <script src="/scalar/standalone.js"></script>
  <script>
    window.Scalar.createApiReference('#scalar-reference-container', {
      url: '/api/openapi.${language}.json',
      localization: { locale: '${language}' },
      showOperationId: true,
      withDefaultFonts: false,
      telemetry: false,
      agent: { disabled: true }
    });
  </script>
</body>
</html>`;
