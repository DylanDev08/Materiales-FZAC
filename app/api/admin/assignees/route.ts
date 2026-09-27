import { getAdminApiContext } from "@/lib/auth/admin-api";

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-assignees-read", limit: 90 });
  if (!context.ok) return context.response;

  const { data, error } = await context.admin
    .from("profiles")
    .select("id,email,full_name,role")
    .in("role", ["ADMIN", "OPERATOR"])
    .order("full_name", { ascending: true })
    .limit(100);

  if (error) return Response.json({ rows: [] }, { status: 500 });
  return Response.json(
    {
      rows: (data ?? []).map((profile) => ({
        id: String(profile.id),
        label: String(profile.full_name || profile.email),
        role: String(profile.role ?? "USER")
      }))
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } }
  );
}
