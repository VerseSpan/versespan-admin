import { adminRoute } from "@/lib/admin-auth";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Last-service health at a glance, read straight from Neon (works with EC2 off).
 * Reuses the same telemetry the pipeline already logs — no backend call.
 */
export const GET = adminRoute(async () => {
  const sql = neon(process.env.DATABASE_URL!);

  const sess = (await sql`
    SELECT id, church_id, started_at FROM sessions ORDER BY started_at DESC LIMIT 1
  `) as { id: string; church_id: number; started_at: string }[];
  if (!sess.length) return Response.json({ session: null });
  const s = sess[0];

  const [agg, drops, gate, span] = await Promise.all([
    sql`SELECT
          count(*) FILTER (WHERE classification_stage='assembler_final') AS finals,
          count(*) FILTER (WHERE classification_scores->>'flush_trigger' IN ('age_cap','char_cap')) AS cap_hits,
          round(avg((classification_scores->>'live_revision_rate')::float)::numeric, 2) AS flicker
        FROM translation_logs WHERE session_id=${s.id}`,
    sql`SELECT count(*) AS n FROM translation_logs WHERE session_id=${s.id} AND classification_stage='decode_dropped'`,
    sql`SELECT
          count(*) FILTER (WHERE classification_stage IN ('song_shadow','passthrough_speech')) AS gate_rows,
          count(*) FILTER (WHERE classification_stage='passthrough_speech') AS acted,
          count(*) FILTER (WHERE content_label='song'
            AND (classification_scores->'passthrough_shadow'->>'would_pass')='true') AS false_pass
        FROM translation_logs WHERE session_id=${s.id}`,
    sql`SELECT max(created_at) AS last_at FROM translation_logs WHERE session_id=${s.id}`,
  ]);

  const a = agg[0] as { finals: number; cap_hits: number; flicker: number | null };
  const g = gate[0] as { gate_rows: number; acted: number; false_pass: number };
  const finals = Number(a.finals) || 0;
  const capHits = Number(a.cap_hits) || 0;
  const lastAt = (span[0] as { last_at: string | null }).last_at;
  const durationMin =
    lastAt && s.started_at ? Math.round((new Date(lastAt).getTime() - new Date(s.started_at).getTime()) / 60000) : null;

  return Response.json({
    session: { id: s.id, churchId: s.church_id, startedAt: s.started_at, durationMin },
    finals,
    capHitPct: finals ? Math.round((capHits / finals) * 100) : 0,
    flicker: a.flicker == null ? null : Number(a.flicker), // avg live_revision_rate (0=none, 1=every pass rewrote); numeric → string from driver

    decodeDrops: Number((drops[0] as { n: number }).n) || 0,
    gate: {
      rows: Number(g.gate_rows) || 0,
      acted: Number(g.acted) || 0, // passthrough finals emitted (only when act flag on)
      falsePass: Number(g.false_pass) || 0, // singing leaked as speech — must be ~0
    },
  });
});
