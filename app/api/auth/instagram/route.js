import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: `${baseUrl}/api/auth/instagram/callback`,
    state,
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    response_type: "code",
  });

  const response = NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  );
  response.cookies.set("instagram_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
  });

  return response;
}
