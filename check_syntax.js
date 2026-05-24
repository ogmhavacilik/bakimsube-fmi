import fs from "fs";
import esbuild from "esbuild";

try {
  const html = fs.readFileSync("index.html", "utf-8");
  const scriptRegex = /<script type="text\/babel" data-type="module">([\s\S]*?)<\/script>/;
  const match = html.match(scriptRegex);

  if (!match) {
    console.error("Could not find Baby/React script block in index.html!");
    process.exit(1);
  }

  const code = match[1];
  console.log("Found script block, length:", code.length);

  // Try compiling with esbuild as JSX
  const result = esbuild.transformSync(code, {
    loader: "jsx",
    target: "esnext",
    format: "esm",
    logLevel: "silent"
  });

  console.log("Success! No syntax errors detected by esbuild.");
} catch (err) {
  console.error("SYNTAX ERROR DETECTED:");
  console.error(err.message || err);
  process.exit(1);
}
