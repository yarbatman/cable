import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session";
import { createOAuthHeader } from "../../../../../lib/oauth1";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.redirect(`${baseUrl}?error=x_auth_denied`);
  }

  try {
    const accessTokenUrl = "https://api.twitter.com/oauth/access_token";

    const authHeader = createOAuthHeader({
      method: "POST",
      url: accessTokenUrl,
      consumerKey: process.env.X_API_KEY,
      consumerSecret: process.env.X_API_SECRET,
      token: oauthToken,
      tokenSecret: "",
      extraParams: { oauth_verifier: oauthVerifier },
    });

    const res = await fetch(accessTokenUrl, {
      method: "POST",
      headers: { Authorization: authHeader },
    });

    const text = await res.text();
    const params = new URLSearchParams(text);
    const accessToken = params.get("oauth_token");
    const accessTokenSecret = params.get("oauth_token_secret");
    const screenName = params.get("screen_name");

    if (!accessToken) {
      return NextResponse.redirect(
        `${baseUrl}?error=x_token_exchange_failed`
      );
    }

    const session = await getSession();
    session.x = { accessToken, accessTokenSecret, screenName };
    await session.save();

    return NextResponse.redirect(`${baseUrl}?connected=x`);
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}?error=x_auth_error`);
  }
}
