import { NextResponse } from "next/server";
import { createOAuthHeader } from "../../../../lib/oauth1";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const requestTokenUrl = "https://api.twitter.com/oauth/request_token";

  const authHeader = createOAuthHeader({
    method: "POST",
    url: requestTokenUrl,
    consumerKey: process.env.X_API_KEY,
    consumerSecret: process.env.X_API_SECRET,
    extraParams: {
      oauth_callback: `${baseUrl}/api/auth/x/callback`,
    },
  });

  try {
    const res = await fetch(requestTokenUrl, {
      method: "POST",
      headers: { Authorization: authHeader },
    });
    const text = await res.text();
    const params = new URLSearchParams(text);
    const oauthToken = params.get("oauth_token");

    if (!oauthToken) {
      return NextResponse.redirect(
        `${baseUrl}?error=x_request_token_failed`
      );
    }

    return NextResponse.redirect(
      `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
    );
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}?error=x_auth_error`);
  }
}
