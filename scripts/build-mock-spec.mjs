#!/usr/bin/env node
// Merges mock/examples.json into a copy of src/api/openapi.json so Prism serves curated, realistic
// bodies. Writes .mock/openapi.json (git-ignored). The committed contract is never modified.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const CONTRACT = "src/api/openapi.json";
const EXAMPLES = process.env.MOCK_EXAMPLES || "mock/examples.json";
const OUT = process.env.MOCK_OUT || ".mock/openapi.json";

const doc = JSON.parse(readFileSync(CONTRACT, "utf8"));
const examples = JSON.parse(readFileSync(EXAMPLES, "utf8"));

/** Follows a local $ref ("#/components/...") to its target; returns other nodes unchanged. */
function resolve(node) {
  if (node && typeof node === "object" && typeof node.$ref === "string") {
    const parts = node.$ref.replace(/^#\//, "").split("/");
    return resolve(parts.reduce((acc, key) => (acc ? acc[key] : undefined), doc));
  }
  return node;
}

const problems = [];
for (const [key, byStatus] of Object.entries(examples)) {
  const [method, path] = key.split(" ");
  const operation = doc.paths?.[path]?.[method.toLowerCase()];
  if (!operation) {
    problems.push(`${key}: no such operation in ${CONTRACT}`);
    continue;
  }
  for (const [status, example] of Object.entries(byStatus)) {
    const response = resolve(operation.responses?.[status]);
    if (!response) {
      problems.push(`${key} ${status}: no such response`);
      continue;
    }
    // Inline a copy so shared $ref'd responses keep serving every other operation unchanged.
    const copy = structuredClone(response);
    copy.content = copy.content ?? {};
    copy.content["application/json"] = { ...(copy.content["application/json"] ?? {}), example };
    operation.responses[status] = copy;
  }
}

if (problems.length > 0) {
  console.error(`build-mock-spec: examples do not match the contract:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);
console.log(
  `build-mock-spec: wrote ${OUT} with ${Object.keys(examples).length} curated operations`,
);
