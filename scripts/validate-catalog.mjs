import { readdir, readFile } from "node:fs/promises";

const repositoryRoot = new URL("../", import.meta.url);
const experiencesDirectory = new URL("experiences/", repositoryRoot);
const readme = await readFile(new URL("README.md", repositoryRoot), "utf8");
const entries = await readdir(experiencesDirectory, { withFileTypes: true });
const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const errors = [];
const records = [];

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(new URL(path, repositoryRoot), "utf8"));
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return null;
  }
}

for (const directory of directories) {
  const prefix = `experiences/${directory}`;
  const manifest = await readJson(`${prefix}/experience.json`, `${directory}/experience.json`);
  const packageJson = await readJson(`${prefix}/package.json`, `${directory}/package.json`);

  try {
    await readFile(new URL(`${prefix}/README.md`, repositoryRoot));
  } catch {
    errors.push(`${directory}: missing README.md`);
  }

  if (!manifest || !packageJson) continue;

  if (manifest.slug !== directory) {
    errors.push(`${directory}: manifest slug is ${JSON.stringify(manifest.slug)}`);
  }
  if (!Number.isFinite(manifest.order)) {
    errors.push(`${directory}: order must be a number`);
  }
  if (!manifest.title?.trim()) {
    errors.push(`${directory}: title is required`);
  }
  if (!manifest.description?.trim()) {
    errors.push(`${directory}: description is required`);
  }
  if (!Array.isArray(manifest.tags) || manifest.tags.length === 0) {
    errors.push(`${directory}: at least one tag is required`);
  }
  if (!packageJson.scripts?.dev) {
    errors.push(`${directory}: package.json must define a dev script`);
  }
  if (!packageJson.scripts?.build) {
    errors.push(`${directory}: package.json must define a build script`);
  }
  if (!readme.includes(`experiences/${directory}`)) {
    errors.push(`${directory}: root README is missing a source link`);
  }
  if (!readme.includes(`https://play.mint.gg/${directory}`)) {
    errors.push(`${directory}: root README is missing a live demo link`);
  }

  records.push({ directory, order: manifest.order, title: manifest.title });
}

for (const field of ["title"]) {
  const grouped = new Map();
  for (const record of records) {
    const value = record[field];
    grouped.set(value, [...(grouped.get(value) ?? []), record]);
  }
  for (const [value, matches] of grouped.entries()) {
    if (matches.length > 1) {
      errors.push(
        `duplicate ${field} ${JSON.stringify(value)}: ${matches.map(({ directory }) => directory).join(", ")}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`Catalog validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}:\n`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Catalog valid: ${records.length} experiences.`);
