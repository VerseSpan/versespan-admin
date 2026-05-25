import { NextRequest, NextResponse } from "next/server";

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY!;
const RUNPOD_POD_ID = process.env.RUNPOD_POD_ID!;
const RUNPOD_GQL = "https://api.runpod.io/graphql";

async function gql(query: string) {
  const res = await fetch(`${RUNPOD_GQL}?api_key=${RUNPOD_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export async function GET() {
  try {
    const data = await gql(`
      query {
        pod(input: { podId: "${RUNPOD_POD_ID}" }) {
          id
          desiredStatus
          lastStatusChange
          runtime {
            uptimeInSeconds
            gpus {
              id
              gpuUtilPercent
              memoryUtilPercent
            }
          }
        }
      }
    `);
    return NextResponse.json({ pod: data.pod });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get pod status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { action } = await req.json();

  try {
    if (action === "start") {
      const data = await gql(`
        mutation {
          podResume(input: { podId: "${RUNPOD_POD_ID}", gpuCount: 1 }) {
            id
            desiredStatus
          }
        }
      `);
      return NextResponse.json({ pod: data.podResume });
    }

    if (action === "stop") {
      const data = await gql(`
        mutation {
          podStop(input: { podId: "${RUNPOD_POD_ID}" }) {
            id
            desiredStatus
          }
        }
      `);
      return NextResponse.json({ pod: data.podStop });
    }

    if (action === "deploy") {
      // Stop if running, update to :latest, then start
      const statusData = await gql(`
        query { pod(input: { podId: "${RUNPOD_POD_ID}" }) { desiredStatus } }
      `);
      if (statusData.pod.desiredStatus === "RUNNING") {
        await gql(`
          mutation { podStop(input: { podId: "${RUNPOD_POD_ID}" }) { id } }
        `);
        await new Promise((r) => setTimeout(r, 20000));
      }
      const image = process.env.RUNPOD_IMAGE || "ghcr.io/versespan/versespan-backend:latest";
      await gql(`
        mutation { podEditJob(input: { podId: "${RUNPOD_POD_ID}", imageName: "${image}" }) { id } }
      `);
      const data = await gql(`
        mutation {
          podResume(input: { podId: "${RUNPOD_POD_ID}", gpuCount: 1 }) {
            id
            desiredStatus
          }
        }
      `);
      return NextResponse.json({ pod: data.podResume });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to perform action" },
      { status: 500 }
    );
  }
}
