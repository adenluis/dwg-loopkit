export type TokenCheck =
  | { status: "ok" }
  | { status: "rejected"; httpStatus: number }
  | { status: "unknown"; reason: string };

/**
 * Validate a DWG MCP token against the DWG server with a tools/list call.
 * - "ok"       → server accepted the token
 * - "rejected" → server answered 401/403 (token wrong or revoked)
 * - "unknown"  → network failure or unexpected status (can't tell either way)
 */
export async function checkTokenWithDwg(
  mcpUrl: string,
  token: string,
  timeoutMs = 8000
): Promise<TokenCheck> {
  try {
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) return { status: "ok" };
    if (response.status === 401 || response.status === 403) {
      return { status: "rejected", httpStatus: response.status };
    }
    return { status: "unknown", reason: `DWG server returned ${response.status}` };
  } catch (e) {
    return { status: "unknown", reason: e instanceof Error ? e.message : String(e) };
  }
}
