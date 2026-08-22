import { parseTemplate } from "@angular/compiler";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { crossLanguageText } from "../../l10n/src/cross-language-text.ts";

const sourceRoot = new URL("../src/", import.meta.url);
const indexMetadata = JSON.parse(
  await readFile(new URL("../../l10n/src/index-metadata.json", import.meta.url), "utf8"),
);
const indexMetadataValues = new Set(Object.values(indexMetadata));
const userFacingAttributes = new Set([
  "alt",
  "aria-label",
  "label",
  "placeholder",
  "title",
  "value",
]);
const crossLanguageTextValues = new Set(crossLanguageText);
const machineValue = /^(?:[#€×+←→·.,:;!?%/()\d\s-]|[A-Z]{2}-\d{4}-\d{6})+$/u;
const machineAttribute =
  /^(?:https?:\/\/\S+|[\w.-]+@[\w.-]+|password|adresse-invalide|#[\da-f]{6}|\d{4}-(?:\d{2}-\d{2}(?:T\d{2}:\d{2})?|W\d{2})|[A-Z\d]{20,})$/iu;

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? htmlFiles(path) : extname(path) === ".html" ? [path] : [];
    }),
  );
  return nested.flat();
}

function normalized(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function isAllowed(value) {
  const text = normalized(value);
  return (
    text === "" ||
    crossLanguageTextValues.has(text) ||
    machineValue.test(text) ||
    !/\p{L}/u.test(text)
  );
}

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function inspect(nodes, source, file, failures) {
  for (const node of nodes) {
    if (
      node.constructor.name === "Text" &&
      !isAllowed(node.value) &&
      !(file.endsWith("src/index.html") && indexMetadataValues.has(normalized(node.value)))
    ) {
      failures.push(
        `${file}:${lineAt(source, node.sourceSpan.start.offset)}: literal text: ${normalized(node.value)}`,
      );
    }
    for (const attribute of node.attributes ?? []) {
      if (
        userFacingAttributes.has(attribute.name) &&
        !isAllowed(attribute.value) &&
        !machineAttribute.test(attribute.value)
      ) {
        failures.push(
          `${file}:${lineAt(source, attribute.sourceSpan.start.offset)}: literal ${attribute.name}: ${normalized(attribute.value)}`,
        );
      }
    }
    if (file.endsWith("src/index.html") && node.name === "meta") {
      const attributes = Object.fromEntries(
        (node.attributes ?? []).map(({ name, value }) => [name, value]),
      );
      const metadataName = attributes.name ?? attributes.property;
      if (
        [
          "description",
          "og:title",
          "og:description",
          "og:image:alt",
          "twitter:title",
          "twitter:description",
          "twitter:image:alt",
        ].includes(metadataName) &&
        !indexMetadataValues.has(attributes.content)
      ) {
        failures.push(
          `${file}:${lineAt(source, node.sourceSpan.start.offset)}: metadata is not sourced from index-metadata.json`,
        );
      }
    }
    inspect(node.children ?? [], source, file, failures);
  }
}

const rootPath = sourceRoot.pathname;
const failures = [];
for (const path of await htmlFiles(rootPath)) {
  const source = await readFile(path, "utf8");
  const file = relative(process.cwd(), path);
  const parsed = parseTemplate(source, file, { preserveWhitespaces: true });
  for (const error of parsed.errors ?? []) failures.push(`${file}: ${error}`);
  inspect(parsed.nodes, source, file, failures);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
