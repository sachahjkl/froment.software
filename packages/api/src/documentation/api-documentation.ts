import { Api } from '@froment/contracts';
import {
  apiDocumentation,
  apiSchemaDocumentation,
  apiRequestExamples,
  type Language,
} from '@froment/l10n';
import { OpenApi } from 'effect/unstable/httpapi';
import { describeContent, describeSchema } from './schema-documentation.js';

type ApiDocumentation = (typeof apiDocumentation)[Language];
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

const applyApiDocumentation = (
  specification: LocalizableOpenApi,
  documentation: ApiDocumentation,
  language: Language,
) => {
  const groups: Readonly<Record<string, GroupEntry>> = documentation.groups;
  const operations: Readonly<Record<string, DocumentationEntry>> = documentation.operations;
  const examples = new Map(Object.entries(apiRequestExamples));
  const paths = Object.fromEntries(
    Object.entries(specification.paths ?? {}).map(([pathName, path]) => [
      pathName,
      Object.fromEntries(
        Object.entries(path).map(([method, operation]) => {
          if (operation === undefined) return [method, operation];
          const documentedOperation: DocumentedOperation = operation;
          const documentationEntry = operations[operation.operationId];
          if (documentationEntry === undefined) return [method, operation];
          const permissions = documentedOperation['x-required-permissions'];
          let description = documentationEntry.description;
          if (permissions !== undefined) {
            description += `\n\n> [!note]\n> ${apiSchemaDocumentation[language].permissions}\n>\n${permissions.map((permission) => `> - ${documentation.requiredPermission.replace('{permission}', permission)}`).join('\n')}`;
          }
          const parameters = operation.parameters.map((parameter) => ({
            ...parameter,
            schema: describeSchema({ ...parameter.schema }, language, parameter.name),
          }));
          const responses = Object.fromEntries(
            Object.entries(operation.responses).map(([status, response]) => {
              if (response.content === undefined) return [status, response];
              return [
                status,
                { ...response, content: describeContent(response.content, language) },
              ];
            }),
          );
          let requestBody = operation.requestBody;
          if (requestBody !== undefined)
            requestBody = {
              ...requestBody,
              content: describeContent(requestBody.content, language),
            };
          const example = examples.get(operation.operationId);
          const json = requestBody?.content['application/json'];
          if (example !== undefined && json !== undefined && requestBody !== undefined) {
            const media = { ...json, examples: { sample: { value: example } } };
            requestBody = {
              ...requestBody,
              content: { ...requestBody.content, 'application/json': media },
            };
          }
          return [
            method,
            {
              ...operation,
              parameters,
              responses,
              requestBody,
              summary: documentationEntry.summary,
              description,
              tags: operation.tags.map((tag) => groups[tag]?.title ?? tag),
            },
          ];
        }),
      ),
    ]),
  );
  const sourceTags = new Map((specification.tags ?? []).map((tag) => [tag.name, tag]));
  const tagNames = new Set([
    ...sourceTags.keys(),
    ...Object.values(specification.paths ?? {}).flatMap((path) =>
      Object.values(path).flatMap((operation) => operation?.tags ?? []),
    ),
  ]);
  const tags = [...tagNames].map((name) => {
    const tag = sourceTags.get(name) ?? { name };
    const group = groups[name];
    return group === undefined
      ? tag
      : { ...tag, name: group.title, description: group.description };
  });
  const components = specification.components ?? { schemas: {}, securitySchemes: {} };
  const securitySchemes = { ...components.securitySchemes };
  const bearer = securitySchemes['bearer'];
  if (bearer !== undefined) {
    securitySchemes['bearer'] = { ...bearer, description: documentation.security.bearer };
  }

  return {
    ...specification,
    info: {
      ...(specification.info ?? { title: '', version: '' }),
      title: documentation.title,
      description: documentation.description,
    },
    paths,
    tags,
    components: {
      ...components,
      securitySchemes,
      schemas: Object.fromEntries(
        Object.entries(components.schemas).map(([name, schema]) => [
          name,
          describeSchema(schema, language),
        ]),
      ),
    },
  };
};

export const apiForLanguage = (language: Language) =>
  Api.annotateMerge(
    OpenApi.annotations({
      transform: (specification) =>
        applyApiDocumentation(specification, apiDocumentation[language], language),
    }),
  );
