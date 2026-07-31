export type HealthQuery = { query: (sql: string) => Promise<unknown> };

export function livenessPayload() {
  return { status: "ok" } as const;
}

export async function checkReadiness(database: HealthQuery) {
  try {
    await database.query("SELECT 1");
    return { status: 200, body: { status: "ready" } as const };
  } catch {
    return { status: 503, body: { status: "unavailable" } as const };
  }
}
