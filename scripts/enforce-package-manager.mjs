const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Materiales FZAC usa pnpm. Ejecuta: corepack pnpm install");
  process.exit(1);
}
