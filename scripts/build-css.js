const { compile } = require("@tailwindcss/node");
const { Scanner } = require("@tailwindcss/oxide");
const fs = require("fs");
const path = require("path");

async function buildCss() {
  const rootDir = process.cwd();
  const inputFile = path.join(rootDir, "app", "globals.source.css");
  const outputFile = path.join(rootDir, "app", "globals.css");

  let baseCss = `@import "tailwindcss";

@layer base {
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #020617;
    color: #f8fafc;
  }
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-message-in {
  animation: messageIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

  if (fs.existsSync(inputFile)) {
    baseCss = fs.readFileSync(inputFile, "utf-8");
  }

  const compiler = await compile(baseCss, {
    from: inputFile,
    base: rootDir,
    onDependency: () => {},
  });

  const scanner = new Scanner({
    sources: [
      { base: path.join(rootDir, "app"), pattern: "**/*", negated: false },
      { base: path.join(rootDir, "components"), pattern: "**/*", negated: false },
      { base: path.join(rootDir, "lib"), pattern: "**/*", negated: false },
      { base: path.join(rootDir, "data"), pattern: "**/*", negated: false },
    ],
  });

  const candidates = scanner.scan();
  const compiled = compiler.build(candidates);

  fs.writeFileSync(outputFile, compiled, "utf-8");
  console.log(
    `[build-css] Compiled Tailwind CSS (${compiled.length} bytes, ${candidates.length} candidates)`
  );
}

if (process.argv.includes("--watch")) {
  buildCss().catch(console.error);
  console.log("[build-css] Watching app/ and components/ for class candidate changes...");
  let timeout;
  const triggerRebuild = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      buildCss().catch(console.error);
    }, 200);
  };

  const watchDirs = ["app", "components"];
  for (const dir of watchDirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      fs.watch(fullPath, { recursive: true }, (event, filename) => {
        if (filename && !filename.includes("globals.css")) {
          triggerRebuild();
        }
      });
    }
  }
} else {
  buildCss().catch((err) => {
    console.error("[build-css] Error compiling CSS:", err);
    process.exit(1);
  });
}
