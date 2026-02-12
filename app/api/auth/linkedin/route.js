import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${baseUrl}/api/auth/linkedin/callback`,
    state,
    scope: "openid profile email w_member_social",
  });

  const response = NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
  response.cookies.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
  });

  return response;
}
