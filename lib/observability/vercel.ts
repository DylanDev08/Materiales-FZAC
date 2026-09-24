import "server-only";

const VERCEL_TEAM_SLUG = "dylans-projects-554f3008";
const VERCEL_PROJECT_SLUG = "materiales-fzac-391o";

export type VercelAnalyticsStatus = {
  instrumented: boolean;
  environment: string;
  deploymentUrl: string | null;
  gitCommitSha: string | null;
  analyticsUrl: string;
  deploymentsUrl: string;
};

function safeDeploymentUrl(value: string | undefined) {
  const normalized = value?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return normalized ? `https://${normalized}` : null;
}

export function getVercelAnalyticsStatus(): VercelAnalyticsStatus {
  return {
    instrumented: true,
    environment: process.env.VERCEL_ENV?.trim() || "local",
    deploymentUrl: safeDeploymentUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL),
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.RENDER_GIT_COMMIT?.trim() || null,
    analyticsUrl: `https://vercel.com/${VERCEL_TEAM_SLUG}/${VERCEL_PROJECT_SLUG}/analytics`,
    deploymentsUrl: `https://vercel.com/${VERCEL_TEAM_SLUG}/${VERCEL_PROJECT_SLUG}/deployments`
  };
}
