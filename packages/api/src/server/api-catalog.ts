export const apiCatalogContentType = 'application/linkset+json; charset=utf-8';

export const apiCatalog = (publicOrigin: string) => ({
  linkset: [
    {
      anchor: `${publicOrigin}/api`,
      'service-desc': [
        {
          href: `${publicOrigin}/api/openapi.json`,
          type: 'application/vnd.oai.openapi+json;version=3.1',
        },
      ],
      'service-doc': [{ href: `${publicOrigin}/api/docs`, type: 'text/html' }],
    },
  ],
});
