import { apiDocumentation, type Language } from '@froment/l10n';
import type { OpenApi } from 'effect/unstable/httpapi';

type DocumentationEntry = { readonly summary: string; readonly description: string };
type GroupEntry = { readonly title: string; readonly description: string };
type DocumentedOperation = OpenApi.OpenAPISpecOperation & {
  readonly 'x-required-permissions'?: ReadonlyArray<string>;
};
type DocumentedPath = Partial<Record<OpenApi.OpenAPISpecMethodName, DocumentedOperation>>;
interface LocalizableOpenApi {
  readonly info?: OpenApi.OpenAPISpecInfo;
  readonly paths?: Readonly<Record<string, DocumentedPath>>;
  readonly tags?: ReadonlyArray<OpenApi.OpenAPISpecTag>;
  readonly components?: OpenApi.OpenAPIComponents;
}

export const localizeOpenApi = (specification: LocalizableOpenApi, language: Language) => {
  const documentation = apiDocumentation[language];
  const groups: Readonly<Record<string, GroupEntry>> = documentation.groups;
  const operations: Readonly<Record<string, DocumentationEntry>> = documentation.operations;
  const info = specification.info ?? { title: '', version: '' };
  const paths = Object.fromEntries(
    Object.entries(specification.paths ?? {}).map(([pathName, path]) => [
      pathName,
      Object.fromEntries(
        Object.entries(path).map(([method, operation]) => {
          if (operation === undefined) return [method, operation];
          const documentationEntry = operations[operation.operationId];
          if (documentationEntry === undefined) return [method, operation];
          const permissions = operation['x-required-permissions'];
          const description =
            permissions !== undefined
              ? `${documentationEntry.description}\n\n${permissions
                  .map((permission) =>
                    documentation.requiredPermission.replace('{permission}', permission),
                  )
                  .join('\n')}`
              : documentationEntry.description;
          return [
            method,
            {
              ...operation,
              summary: documentationEntry.summary,
              description,
              tags: operation.tags.map((tag) => groups[tag]?.title ?? tag),
            },
          ];
        }),
      ),
    ]),
  );
  const tags = (specification.tags ?? []).map((tag) => {
    const group = groups[tag.name];
    return group === undefined
      ? tag
      : { ...tag, name: group.title, description: group.description };
  });
  const components = specification.components ?? { schemas: {}, securitySchemes: {} };
  const sessionCookie = components.securitySchemes['sessionCookie'];
  const bearer = components.securitySchemes['bearer'];
  const securitySchemes = { ...components.securitySchemes };
  if (sessionCookie !== undefined) {
    securitySchemes['sessionCookie'] = {
      ...sessionCookie,
      description: documentation.security.sessionCookie,
    };
  }
  if (bearer !== undefined) {
    securitySchemes['bearer'] = { ...bearer, description: documentation.security.bearer };
  }

  return {
    ...specification,
    info: { ...info, title: documentation.title, description: documentation.description },
    paths,
    tags,
    components: {
      ...components,
      securitySchemes,
    },
  };
};
