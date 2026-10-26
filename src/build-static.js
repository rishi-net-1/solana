// Static build for hosts that can't run src/server.js (e.g. Netlify). Produces the same layout the
// dev server serves from static/: clean page routes, vendor files at their dev paths, no obfuscation.
// The proxy still needs a Wisp server; set WISP_URL (wss://...) to make it the default.
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import chalk from "chalk";
import { injectVersionInfo, resolveVersionInfo } from "./version.js";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const require = createRequire(import.meta.url);

const { epoxyPath } = require("@mercuryworkshop/epoxy-transport");
const { baremuxPath } = require("@mercuryworkshop/bare-mux/node");
const { libcurlPath } = require("@mercuryworkshop/libcurl-transport");
const { uvPath } = require("@titaniumnetwork-dev/ultraviolet");
const { scramjetPath } = require("@mercuryworkshop/scramjet/path");

async function build() {
  console.log("Cleaning dist/...");
  await rm(DIST_DIR, { recursive: true, force: true });

  console.log("Copying static/, vendor packages and assets/ -> dist/...");
  await cp(path.join(ROOT, "static"), DIST_DIR, { recursive: true });
  await cp(epoxyPath, path.join(DIST_DIR, "epoxy"), { recursive: true });
  await cp(baremuxPath, path.join(DIST_DIR, "baremux"), { recursive: true });
  await cp(libcurlPath, path.join(DIST_DIR, "libcurl"), { recursive: true });
  await cp(uvPath, path.join(DIST_DIR, "assets", "ultraviolet"), { recursive: true });
  await cp(scramjetPath, path.join(DIST_DIR, "assets", "scramjet"), { recursive: true });
  // Project assets go last so our uv.config.js / scramjet.config.js win over the package defaults.
  await cp(path.join(ROOT, "assets"), path.join(DIST_DIR, "assets"), { recursive: true });
  await cp(path.join(ROOT, "index.html"), path.join(DIST_DIR, "index.html"));

  const wispUrl = process.env.WISP_URL?.trim();
  if (wispUrl) {
    const vendorFile = path.join(DIST_DIR, "assets", "js", "vendor.js");
    const source = await readFile(vendorFile, "utf8");
    await writeFile(vendorFile, source.replace("self.__deps = {", `self.__deps = {\n  wisp: ${JSON.stringify(wispUrl)},`), "utf8");
    console.log(`Default Wisp server: ${wispUrl}`);
  } else {
    console.log(chalk.yellow("WISP_URL not set: the proxy needs a Wisp server set in Settings to load pages."));
  }

  try {
    const settingsFile = path.join(DIST_DIR, "settings.html");
    const info = await resolveVersionInfo();
    await writeFile(settingsFile, injectVersionInfo(await readFile(settingsFile, "utf8"), info).html, "utf8");
  } catch (err) {
    console.warn(chalk.yellow(`Settings version injection skipped: ${err.message}`));
  }

  console.log(chalk.green("\nStatic build complete -> dist/"));
}

build().catch(err => {
  console.error(chalk.red("\nBuild failed:"), err);
  process.exit(1);
});
