/**
 * EC2 control via a MINIMALLY-SCOPED IAM key (start/stop/describe on one
 * instance only) — never the broad AWS keys. Server-side only.
 */
import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";

function instanceId(): string {
  const id = process.env.EC2_INSTANCE_ID;
  if (!id) throw new Error("EC2_INSTANCE_ID not set");
  return id;
}

function client(): EC2Client {
  const accessKeyId = process.env.EC2_CONTROL_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EC2_CONTROL_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw new Error("EC2 control credentials not set");
  return new EC2Client({
    // custom var name — the platform may reserve/auto-set AWS_REGION
    region: process.env.EC2_AWS_REGION || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
  });
}

export interface Ec2State {
  state: string; // pending | running | stopping | stopped | shutting-down | terminated | unknown
  publicIp: string | null;
  instanceId: string;
}

export async function ec2Status(): Promise<Ec2State> {
  const out = await client().send(new DescribeInstancesCommand({ InstanceIds: [instanceId()] }));
  const inst = out.Reservations?.[0]?.Instances?.[0];
  return {
    state: inst?.State?.Name ?? "unknown",
    publicIp: inst?.PublicIpAddress ?? null,
    instanceId: instanceId(),
  };
}

export async function ec2Start(): Promise<void> {
  await client().send(new StartInstancesCommand({ InstanceIds: [instanceId()] }));
}

export async function ec2Stop(): Promise<void> {
  await client().send(new StopInstancesCommand({ InstanceIds: [instanceId()] }));
}
