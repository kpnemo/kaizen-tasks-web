#!/usr/bin/env node
// Regenerates the part of docs/product-map.md below the marker line from this checkout.
//
//   node scripts/product-map.mjs              write docs/product-map.md
//   node scripts/product-map.mjs --out FILE   write somewhere else (docs-check Rule D)
//   node scripts/product-map.mjs --sources    print the files it reads, one per line
//   node scripts/product-map.mjs --root DIR   read another tree (tests)
//
// The header above `<!-- product-map:generated -->` is hand-written prose and is never touched.
// Routes and shell controls are read with the TypeScript compiler API, never with regexes: a
// construct the scanner does not understand exits 1 with the file and line rather than dropping
// content silently. The output is deterministic (sorted, no timestamps, no absolute paths) and
// formatted with the repo's Prettier, so regenerating an unchanged tree is byte-identical.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import ts from "typescript";

const SCRIPT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const MARKER = "<!-- product-map:generated -->";
const MAP_FILE = "docs/product-map.md";
const ROUTER_FILE = "src/app/router.tsx";
const LAYOUT_FILE = "src/app/layout.tsx";
const SPEC_FILE = "src/api/openapi.json";
const CHANGELOG_FILE = "CHANGELOG.md";
const ADR_DIR = "docs/adr";
const FEATURES_DIR = "src/features";
const RELEASES_KEPT = 3;
const BULLETS_PER_RELEASE = 2;
const BULLET_CHARS = 120;
const METHODS = ["get", "post", "put", "patch", "delete"];

class MapError extends Error {}

const DEFAULT_HEADER = `# Product map

_Write the hand-written header here, then run \`npm run product-map\` again._

${MARKER}`;

// ---------------------------------------------------------------- small helpers

const exists = (root, rel) => existsSync(join(root, rel));
const read = (root, rel) => readFileSync(join(root, rel), "utf8");
const code = (value) => `\`${value}\``;

function sourceFileOf(root, rel) {
  return ts.createSourceFile(rel, read(root, rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function fail(sf, node, message) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  throw new MapError(`${sf.fileName}:${line + 1}: ${message}`);
}

/** Where an import specifier lives in this repo: a relative path, or the package name. */
function resolveImport(root, fromFile, specifier) {
  let candidate;
  if (specifier.startsWith("@/")) candidate = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) candidate = join(dirname(fromFile), specifier);
  else return specifier;
  for (const suffix of [".tsx", ".ts", "/index.tsx", "/index.ts", ""]) {
    if (exists(root, candidate + suffix)) return candidate + suffix;
  }
  return candidate;
}

/** local name -> source path, for every import in the file. */
function importMap(root, sf) {
  const map = new Map();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const from = resolveImport(root, sf.fileName, statement.moduleSpecifier.text);
    const clause = statement.importClause;
    if (clause.name) map.set(clause.name.text, from);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) map.set(element.name.text, from);
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      map.set(bindings.name.text, from);
    }
  }
  return map;
}

const openingOf = (node) => (ts.isJsxSelfClosingElement(node) ? node : node.openingElement);
const isJsx = (node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
const tagOf = (node, sf) => openingOf(node).tagName.getText(sf);

function attributesOf(node, sf) {
  const attributes = new Map();
  for (const property of openingOf(node).attributes.properties) {
    if (!ts.isJsxAttribute(property)) {
      fail(
        sf,
        property,
        `<${tagOf(node, sf)}> uses a spread attribute the product map cannot read`,
      );
    }
    attributes.set(property.name.getText(sf), property);
  }
  return attributes;
}

/** The literal text of a JSX attribute, or null when it is not a plain string. */
function stringAttribute(attribute) {
  const initializer = attribute?.initializer;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    ts.isStringLiteral(initializer.expression)
  ) {
    return initializer.expression.text;
  }
  return null;
}

/** Where a component rendered in this file comes from: an import, or the file itself. */
function componentSource(root, sf, imports, name) {
  const imported = imports.get(name);
  if (imported) return imported;
  return exists(root, sf.fileName) ? sf.fileName : null;
}

// ---------------------------------------------------------------- routes

function joinPath(parent, path) {
  if (!parent || path.startsWith("/")) return path;
  return `${parent.replace(/\/$/, "")}/${path}`;
}

function collectRoutes(root) {
  const sf = sourceFileOf(root, ROUTER_FILE);
  const imports = importMap(root, sf);
  const routes = [];

  const visit = (node, parentPath) => {
    let childPath = parentPath;
    if (isJsx(node) && tagOf(node, sf) === "Route") {
      const attributes = attributesOf(node, sf);
      const pathAttribute = attributes.get("path");
      let path = null;
      if (pathAttribute) {
        path = stringAttribute(pathAttribute);
        if (path === null) {
          fail(sf, pathAttribute, "<Route> has a path the product map cannot read as a literal");
        }
        childPath = joinPath(parentPath, path);
      }
      const isIndex = attributes.has("index");
      if (path !== null || isIndex) {
        routes.push(
          readRoute(root, sf, imports, node, attributes, isIndex ? parentPath : childPath, isIndex),
        );
      }
    }
    node.forEachChild((child) => visit(child, childPath));
  };
  visit(sf, "");

  if (routes.length === 0) throw new MapError(`${ROUTER_FILE}: no <Route> elements found`);
  return routes;
}

function readRoute(root, sf, imports, node, attributes, path, isIndex) {
  const elementAttribute = attributes.get("element");
  const initializer = elementAttribute?.initializer;
  if (
    !elementAttribute ||
    !initializer ||
    !ts.isJsxExpression(initializer) ||
    !initializer.expression
  ) {
    fail(sf, node, "<Route> has no element={<Component />} the product map can read");
  }
  const element = initializer.expression;
  if (!isJsx(element)) {
    fail(sf, node, "<Route> element is not a JSX element the product map can read");
  }
  const tag = tagOf(element, sf);
  if (!/^[A-Z]/.test(tag)) {
    fail(sf, node, `<Route> element <${tag}> is not a component the product map can read`);
  }
  if (tag === "Navigate") {
    const to = stringAttribute(attributesOf(element, sf).get("to"));
    if (to === null) fail(sf, element, "<Navigate> has no literal `to` the product map can read");
    return { path, kind: "redirect", to, index: isIndex };
  }
  const source = componentSource(root, sf, imports, tag);
  if (!source) fail(sf, element, `<${tag}> is neither imported nor declared in this file`);
  return { path, kind: "page", component: tag, source, index: isIndex };
}

// ---------------------------------------------------------------- app shell

function collectShell(root) {
  const sf = sourceFileOf(root, LAYOUT_FILE);
  const imports = importMap(root, sf);
  const controls = [];

  const visit = (node, region) => {
    let childRegion = region;
    if (isJsx(node)) {
      const tag = tagOf(node, sf);
      if (tag === "header") childRegion = "header";
      else if (tag === "footer") childRegion = "footer";
      else if (/^[A-Z]/.test(tag)) {
        const to = stringAttribute(attributesOf(node, sf).get("to"));
        const source = componentSource(root, sf, imports, tag);
        if (!source) fail(sf, node, `<${tag}> is neither imported nor declared in this file`);
        controls.push({ name: to === null ? tag : `${tag} to="${to}"`, region, source });
      }
    }
    node.forEachChild((child) => visit(child, childRegion));
  };
  visit(sf, "shell");

  if (controls.length === 0) throw new MapError(`${LAYOUT_FILE}: no components rendered`);
  return controls;
}

// ---------------------------------------------------------------- features

function directories(root, rel) {
  if (!exists(root, rel)) return [];
  return readdirSync(join(root, rel))
    .filter((name) => statSync(join(root, rel, name)).isDirectory())
    .sort();
}

function tsxFiles(root, rel) {
  if (!exists(root, rel)) return [];
  return readdirSync(join(root, rel))
    .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
    .sort();
}

function collectFeatures(root) {
  return directories(root, FEATURES_DIR).map((name) => {
    const dir = `${FEATURES_DIR}/${name}`;
    const top = tsxFiles(root, dir);
    const nested = tsxFiles(root, `${dir}/components`);
    const base = (file) => file.replace(/\.tsx$/, "");
    return {
      name,
      dir,
      pages: top.filter((file) => file.endsWith("Page.tsx")).map(base),
      components: [
        ...top.filter((file) => !file.endsWith("Page.tsx")).map(base),
        ...nested.map(base),
      ],
      hooks: exists(root, `${dir}/hooks.ts`),
    };
  });
}

// ---------------------------------------------------------------- contract

function collectEndpoints(root) {
  const spec = JSON.parse(read(root, SPEC_FILE));
  const endpoints = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation) continue;
      endpoints.push({
        method: method.toUpperCase(),
        path,
        summary: operation.summary ?? operation.operationId ?? "",
        tag: (operation.tags ?? [])[0] ?? "",
      });
    }
  }
  return endpoints.sort(
    (a, b) =>
      a.tag.localeCompare(b.tag) ||
      a.path.localeCompare(b.path) ||
      METHODS.indexOf(a.method.toLowerCase()) - METHODS.indexOf(b.method.toLowerCase()),
  );
}

// ---------------------------------------------------------------- changelog and ADRs

/** [Unreleased] in full, then the newest releases with their first bullets, each cut short. */
function collectReleases(root) {
  const sections = [];
  let section = null;
  let subsection = "";
  let bullet = null;

  const pushBullet = () => {
    if (bullet && section) section.bullets.push(bullet);
    bullet = null;
  };

  for (const line of read(root, CHANGELOG_FILE).split("\n")) {
    const heading = /^## \[?([^\]]+?)\]?(?: - (\d{4}-\d{2}-\d{2}))?\s*$/.exec(line);
    if (heading) {
      pushBullet();
      section = { title: heading[1], date: heading[2] ?? null, bullets: [] };
      subsection = "";
      sections.push(section);
      continue;
    }
    if (!section) continue;
    const sub = /^### (.+?)\s*$/.exec(line);
    if (sub) {
      pushBullet();
      subsection = sub[1];
      continue;
    }
    const item = /^[-*] (.*)$/.exec(line);
    if (item) {
      pushBullet();
      bullet = { kind: subsection, text: item[1] };
      continue;
    }
    if (bullet && line.trim() !== "") bullet.text += ` ${line.trim()}`;
    else pushBullet();
  }
  pushBullet();

  const unreleased = sections.find((s) => s.title === "Unreleased");
  const released = sections.filter((s) => s.date).slice(0, RELEASES_KEPT);
  return {
    unreleased: unreleased ? unreleased.bullets : [],
    released: released.map((release) => ({
      ...release,
      bullets: release.bullets.slice(0, BULLETS_PER_RELEASE).map((item) => ({
        ...item,
        text: cut(item.text),
      })),
    })),
  };
}

function cut(text) {
  if (text.length <= BULLET_CHARS) return text;
  return `${text.slice(0, BULLET_CHARS - 1).trimEnd()}…`;
}

function collectAdrs(root) {
  if (!exists(root, ADR_DIR)) return [];
  return readdirSync(join(root, ADR_DIR))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((file) => {
      const heading = read(root, `${ADR_DIR}/${file}`)
        .split("\n")
        .find((line) => line.startsWith("# "));
      return { file, title: (heading ?? file).replace(/^# /, "").trim() };
    });
}

// ---------------------------------------------------------------- rendering

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((cells) => `| ${cells.join(" | ")} |`),
  ].join("\n");
}

function renderSections(root) {
  const routes = collectRoutes(root);
  const shell = collectShell(root);
  const features = collectFeatures(root);
  const endpoints = collectEndpoints(root);
  const releases = collectReleases(root);
  const adrs = collectAdrs(root);
  const bullet = (item) => `- ${item.kind ? `**${item.kind}** — ` : ""}${item.text}`;

  return [
    `## Screens (${code(ROUTER_FILE)})`,
    table(
      ["Path", "Renders", "Source"],
      routes.map((route) => [
        code(route.index ? `${route.path} (index)` : route.path),
        route.kind === "redirect" ? `redirect to ${code(route.to)}` : code(route.component),
        route.kind === "redirect" ? "—" : code(route.source),
      ]),
    ),

    `## App shell (${code(LAYOUT_FILE)})`,
    table(
      ["Control", "Where", "Source"],
      shell.map((control) => [code(control.name), control.region, code(control.source)]),
    ),

    `## Features (${code(`${FEATURES_DIR}/*/`)})`,
    features
      .map((feature) => {
        const parts = [];
        if (feature.pages.length) parts.push(`pages ${feature.pages.map(code).join(", ")}`);
        if (feature.components.length)
          parts.push(`components ${feature.components.map(code).join(", ")}`);
        if (feature.hooks) parts.push("hooks `hooks.ts`");
        return `- **${feature.name}** (${code(`${feature.dir}/`)}) — ${parts.join("; ")}`;
      })
      .join("\n"),

    `## Endpoints the app may call (${code(SPEC_FILE)})`,
    table(
      ["Method", "Path", "Summary", "Tag"],
      endpoints.map((endpoint) => [
        endpoint.method,
        code(endpoint.path),
        endpoint.summary,
        endpoint.tag,
      ]),
    ),

    "## Recent releases (history, not current behavior)",
    [
      "### Unreleased",
      releases.unreleased.length ? releases.unreleased.map(bullet).join("\n") : "- nothing yet",
      ...releases.released.flatMap((release) => [
        `### ${release.title} — ${release.date}`,
        release.bullets.length ? release.bullets.map(bullet).join("\n") : "- no bullets",
      ]),
    ].join("\n\n"),

    `## Decisions (${code(`${ADR_DIR}/*.md`)})`,
    adrs.map((adr) => `- [${adr.title}](adr/${adr.file})`).join("\n"),
  ].join("\n\n");
}

// ---------------------------------------------------------------- assembly

/** Every file the generator reads, as relative paths, sorted. Used by docs-check's Rule D. */
function collectSources(root) {
  const sources = [ROUTER_FILE, LAYOUT_FILE, SPEC_FILE, CHANGELOG_FILE];
  for (const adr of collectAdrs(root)) sources.push(`${ADR_DIR}/${adr.file}`);
  for (const feature of collectFeatures(root)) {
    for (const page of feature.pages) sources.push(`${feature.dir}/${page}.tsx`);
  }
  return sources.filter((rel) => exists(root, rel)).sort();
}

async function buildMap(root) {
  const current = exists(root, MAP_FILE) ? read(root, MAP_FILE) : DEFAULT_HEADER;
  const markerAt = current.indexOf(MARKER);
  if (markerAt === -1) {
    throw new MapError(`${MAP_FILE}: the marker line ${MARKER} is missing; nothing was written`);
  }
  const header = current.slice(0, markerAt + MARKER.length).trimEnd();
  const content = `${header}\n\n${renderSections(root)}\n`;
  const config = (await prettier.resolveConfig(join(root, MAP_FILE))) ?? {};
  return prettier.format(content, { ...config, parser: "markdown" });
}

function parseArgs(argv) {
  const options = { root: SCRIPT_ROOT, out: null, sources: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") options.root = argv[(i += 1)];
    else if (arg === "--out") options.out = argv[(i += 1)];
    else if (arg === "--sources") options.sources = true;
    else throw new MapError(`unknown argument ${arg}`);
  }
  if (options.root === undefined || options.out === undefined) {
    throw new MapError("--root and --out need a value");
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.sources) {
    process.stdout.write(`${collectSources(options.root).join("\n")}\n`);
    return;
  }
  const map = await buildMap(options.root);
  const out = options.out ?? join(options.root, MAP_FILE);
  writeFileSync(out, map);
  const lines = map.split("\n").length;
  process.stdout.write(`product-map: ${out} (${lines} lines, ${Buffer.byteLength(map)} bytes)\n`);
}

main().catch((error) => {
  process.stderr.write(
    `product-map: ${error instanceof MapError ? error.message : (error.stack ?? String(error))}\n`,
  );
  process.exit(1);
});
