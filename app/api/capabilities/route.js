export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serverless hosts (Vercel, Netlify, AWS Lambda) cannot run a browser, so "Run JavaScript" is not offered there.
export function isHosted() {
  return !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export async function GET() {
  return Response.json({ hosted: isHosted() });
}
