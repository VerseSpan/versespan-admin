# Admin Control page — setup

The `/admin/control` page starts/stops the EC2 backend and shows its status from
your phone. It runs as Next.js API routes on Netlify (always on) that talk
directly to AWS and Neon — so it works even when EC2 is **off**. No secret ever
reaches the browser.

## 1. Create a minimally-scoped IAM user

Do **not** reuse the broad AWS keys. Create a new IAM user (e.g. `ec2-toggle`)
with programmatic access and *only* this policy — Start/Stop are locked to the
one instance, so a leaked key can do nothing but toggle that box:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DescribeAll",
      "Effect": "Allow",
      "Action": "ec2:DescribeInstances",
      "Resource": "*"
    },
    {
      "Sid": "StartStopOneInstance",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances"],
      "Resource": "arn:aws:ec2:us-east-1:<ACCOUNT_ID>:instance/i-085bd00df675a4a35"
    }
  ]
}
```

(`ec2:DescribeInstances` can't be resource-scoped by AWS, but it's read-only.)
Copy the new access key ID + secret.

## 2. Set env vars in Netlify

Netlify → Site settings → Environment variables. **Server-only — never prefix
with `NEXT_PUBLIC_`:**

| Var | Value |
|---|---|
| `EC2_CONTROL_ACCESS_KEY_ID` | the new IAM user's key id |
| `EC2_CONTROL_SECRET_ACCESS_KEY` | the new IAM user's secret |
| `EC2_INSTANCE_ID` | `i-085bd00df675a4a35` |
| `EC2_AWS_REGION` | `us-east-1` |
| `JWT_SECRET_KEY` | **same** secret the backend signs tokens with |
| `DATABASE_URL` | the Neon connection string (same DB the backend uses) |

`JWT_SECRET_KEY` lets the route verify your login locally; `DATABASE_URL` lets
it confirm you're the admin church — both without calling EC2.

## 3. Local dev (`.env.local`)

Same six vars, plus the existing `NEXT_PUBLIC_API_URL`. Then `npm run dev` and
open `/admin/control`.

## How auth works

The page sends your existing admin login token. The route verifies its
signature (HS256, `JWT_SECRET_KEY`), reads `users.church_id` from Neon, and only
proceeds if you're church 1 (admin). Non-admins get 403; anyone unauthenticated
gets 401.

## Extending (Phase 2/3)

The same `adminRoute()` wrapper + direct Neon access powers future read-only
monitoring (recent-service stats) and the labeling UI — all EC2-independent.
