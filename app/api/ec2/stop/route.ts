import { adminRoute } from "@/lib/admin-auth";
import { ec2Stop, ec2Status } from "@/lib/ec2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute(async () => {
  await ec2Stop();
  return Response.json(await ec2Status());
});
