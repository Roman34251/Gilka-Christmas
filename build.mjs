import { build } from "esbuild";
import { mkdir, copyFile, writeFile, readdir } from "node:fs/promises";
import { ornament } from "./art.mjs";
import sharp from "sharp";

await mkdir("dist/assets/art", { recursive: true });
await Promise.all([
  copyFile("public/style.css", "dist/assets/style.css"),
  ...(await readdir("public"))
    .filter((name) => /\.(jpg|png)$/.test(name))
    .map((name) =>
      sharp("public/" + name)
        .resize({
          width: name === "hero.jpg" ? 1672 : 800,
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toFile("dist/assets/" + name.replace(/\.(jpg|png)$/, ".webp")),
    ),
  ...[0, 1, 2, 3].map((index) =>
    writeFile("dist/assets/art/" + index + ".svg", ornament(index)),
  ),
]);

const shared = {
  bundle: true,
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
};

await build({
  ...shared,
  entryPoints: ["client.jsx"],
  outfile: "dist/assets/shop.js",
});

await build({
  ...shared,
  entryPoints: ["server.mjs"],
  platform: "browser",
  conditions: ["workerd", "worker", "browser"],
  format: "esm",
  loader: { ".html": "text" },
  outfile: "dist/worker.js",
});
