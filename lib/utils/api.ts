export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, message }, { status });
}

export function jsonOk<T>(payload: T, status = 200) {
  return Response.json({ ok: true, ...payload }, { status });
}
