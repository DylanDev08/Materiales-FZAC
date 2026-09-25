import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const projectId = "gooxgjzetziwnxhuymmx";
const result = spawnSync(
  "corepack",
  ["pnpm", "dlx", "supabase", "gen", "types", "typescript", "--project-id", projectId],
  { cwd: process.cwd(), encoding: "utf8", shell: process.platform === "win32", maxBuffer: 8 * 1024 * 1024 }
);

if (result.status !== 0 || !result.stdout?.includes("export type Database")) {
  process.stderr.write(result.stderr || "No se pudieron generar los tipos de Supabase.\n");
  process.exit(result.status || 1);
}

const target = path.join(process.cwd(), "types", "supabase.ts");
await writeFile(target, result.stdout, "utf8");
console.log(`Tipos de Supabase actualizados: ${target}`);
