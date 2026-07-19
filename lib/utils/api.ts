export function jsonError(message: string, status = 400, headers?: HeadersInit) {
  return Response.json({ ok: false, message }, { status, headers });
}

export function jsonOk<T>(payload: T, status = 200) {
  return Response.json({ ok: true, ...payload }, { status });
}
