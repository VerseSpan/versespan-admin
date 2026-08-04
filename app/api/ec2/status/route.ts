import { adminRoute } from "@/lib/admin-auth";
import { ec2Status } from "@/lib/ec2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  return Response.json(await ec2Status());
});
