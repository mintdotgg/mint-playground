import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const experiencesDirectory = new URL("../experiences/", import.meta.url);

async function getExperiences() {
  const entries = await readdir(experiencesDirectory, { withFileTypes: true });
  const experiences = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    try {
      const manifest = JSON.parse(
        await readFile(new URL(`${entry.name}/experience.json`, experiencesDirectory)),
      );
      const packageJson = JSON.parse(
        await readFile(new URL(`${entry.name}/package.json`, experiencesDirectory)),
      );

      if (packageJson.scripts?.dev) {
        experiences.push({
          order: manifest.order ?? Number.MAX_SAFE_INTEGER,
          slug: entry.name,
          title: manifest.title ?? entry.name,
        });
      }
    } catch {
      // Catalog validation reports incomplete experience directories in detail.
    }
  }

  return experiences.sort((left, right) =>
    left.order - right.order || left.title.localeCompare(right.title),
  );
}

function printExperiences(experiences) {
  const width = Math.max(...experiences.map(({ slug }) => slug.length));
  for (const { slug, title } of experiences) {
    console.log(`${slug.padEnd(width)}  ${title}`);
  }
}

async function chooseExperience(experiences) {
  console.log("Choose an experience:\n");
  experiences.forEach(({ title }, index) => {
    console.log(`${String(index + 1).padStart(2)}. ${title}`);
  });

  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question("\nNumber or slug: ");
  prompt.close();

  const number = Number.parseInt(answer, 10);
  if (String(number) === answer.trim() && number >= 1 && number <= experiences.length) {
    return experiences[number - 1];
  }

  return experiences.find(({ slug }) => slug === answer.trim());
}

const experiences = await getExperiences();
const argument = process.argv[2];

if (argument === "--list") {
  printExperiences(experiences);
  process.exit(0);
}

const selected = argument
  ? experiences.find(({ slug }) => slug === argument)
  : await chooseExperience(experiences);

if (!selected) {
  console.error(`Unknown experience: ${argument ?? "selection"}\n`);
  console.error("Run `pnpm play --list` to see every available slug.");
  process.exit(1);
}

console.log(`\nStarting ${selected.title}…\n`);

const child = spawn(
  "pnpm",
  ["--dir", `experiences/${selected.slug}`, "dev"],
  { cwd: new URL("..", import.meta.url), stdio: "inherit" },
);

child.on("error", (error) => {
  console.error(`Unable to start pnpm: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
