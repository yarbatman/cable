import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "../../../../../lib/session";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}?error=linkedin_auth_denied`);
  }

  // Verify state (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get("linkedin_oauth_state")?.value;
  if (state !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}?error=linkedin_state_mismatch`
    );
  }

  try {
    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${baseUrl}/api/auth/linkedin/callback`,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        }),
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(
        `${baseUrl}?error=linkedin_token_failed`
      );
    }

    const profileRes = await fetch(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );
    const profileData = await profileRes.json();
    const personUrn = `urn:li:person:${profileData.sub}`;

    const session = await getSession();
    session.linkedin = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      personUrn,
      name: profileData.name,
    };
    await session.save();

    const response = NextResponse.redirect(
      `${baseUrl}?connected=linkedin`
    );
    response.cookies.delete("linkedin_oauth_state");
    return response;
  } catch (err) {
    return NextResponse.redirect(
      `${baseUrl}?error=linkedin_auth_error`
    );
  }
}
