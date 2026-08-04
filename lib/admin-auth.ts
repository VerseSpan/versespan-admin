/**
 * Server-side admin gate for the /api/* control & monitoring routes.
 *
 * These routes run on Netlify (always on) and must work when EC2 is OFF, so
 * they verify the JWT signature locally with the shared secret and confirm the
 * user is the admin church by reading Neon directly — never calling the EC2
 * backend. The AWS/DB secrets live only in server env (no NEXT_PUBLIC_).
 */
import jwt from "jsonwebtoken";
import { neon } from "@neondatabase/serverless";

const ADMIN_CHURCH_ID = 1; // VerbBridge admin (users.id=1 / admin@verbbridge.io)

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface AdminAuth {
  userId: number;
  churchId: number;
}

async function verifyAdmin(request: Request): Promise<AdminAuth> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AuthError("missing token");

  const secret = process.env.JWT_SECRET_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!secret || !dbUrl) throw new AuthError("server not configured", 500);

  let userId: number;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as { sub?: string };
    userId = parseInt(payload.sub || "", 10);
    if (!Number.isInteger(userId)) throw new Error("no sub");
  } catch {
    throw new AuthError("invalid or expired token");
  }

  const sql = neon(dbUrl);
  const rows = (await sql`
    SELECT church_id FROM users WHERE id = ${userId} AND is_active = true
  `) as { church_id: number }[];
  const churchId = rows[0]?.church_id;
  if (churchId !== ADMIN_CHURCH_ID) throw new AuthError("admin access required", 403);

  return { userId, churchId };
}

/** Wrap a route handler with admin auth + uniform error handling. */
export function adminRoute(handler: (request: Request, auth: AdminAuth) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      const auth = await verifyAdmin(request);
      return await handler(request, auth);
    } catch (e) {
      if (e instanceof AuthError) {
        return Response.json({ error: e.message }, { status: e.status });
      }
      console.error("admin route error", e);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  };
}
