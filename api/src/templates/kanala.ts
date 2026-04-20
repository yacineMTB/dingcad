import { readFileSync } from "fs";
import { join } from "path";

export const kanalaSceneJs = readFileSync(
  join(__dirname, "kanala-scene.js"),
  "utf-8"
);
