export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "materiales-fzac",
      git_sha: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null,
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store",
        ...(process.env.RENDER_GIT_COMMIT ? { "X-FZAC-Commit": process.env.RENDER_GIT_COMMIT } : {})
      }
    }
  );
}
