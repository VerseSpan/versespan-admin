/**
 * EC2-independent admin login. Authenticates email/password against Neon
 * directly and mints a JWT identical to the backend's ({sub}, HS256, 30d) —
 * so you can cold-start EC2 from the Control page even when the backend is off.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_CHURCH_ID = 1;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: Request): Promise<Response> {
  try {
    const secret = process.env.JWT_SECRET_KEY;
    const dbUrl = process.env.DATABASE_URL;
    if (!secret || !dbUrl) return Response.json({ error: "server not configured" }, { status: 500 });

    const { email, password } = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    if (!email || !password) return Response.json({ error: "email and password required" }, { status: 400 });

    const sql = neon(dbUrl);
    const rows = (await sql`
      SELECT id, hashed_password, church_id, is_active
      FROM users WHERE email = ${email.trim().toLowerCase()}
    `) as { id: number; hashed_password: string; church_id: number; is_active: boolean }[];
    const user = rows[0];

    // Same generic 401 whether the email is unknown or the password is wrong
    const ok = user && user.is_active && (await bcrypt.compare(password, user.hashed_password));
    if (!ok) return Response.json({ error: "invalid credentials" }, { status: 401 });
    if (user.church_id !== ADMIN_CHURCH_ID) return Response.json({ error: "admin access required" }, { status: 403 });

    const token = jwt.sign({ sub: String(user.id) }, secret, { algorithm: "HS256", expiresIn: THIRTY_DAYS });
    return Response.json({ token, churchId: user.church_id });
  } catch (e) {
    console.error("admin login error", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
