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
    return NextResponse.redirect(`${baseUrl}?error=instagram_auth_denied`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("instagram_oauth_state")?.value;
  if (state !== storedState) {
    return NextResponse.redirect(`${baseUrl}?error=instagram_state_mismatch`);
  }

  try {
    // Step 1: Exchange code for short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID);
    tokenUrl.searchParams.set("client_secret", process.env.INSTAGRAM_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", `${baseUrl}/api/auth/instagram/callback`);
    tokenUrl.searchParams.set("code", code);

    const shortTokenRes = await fetch(tokenUrl.toString());
    const shortTokenData = await shortTokenRes.json();

    if (!shortTokenData.access_token) {
      return NextResponse.redirect(`${baseUrl}?error=instagram_token_failed`);
    }

    // Step 2: Exchange for long-lived token (60 days)
    const longUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID);
    longUrl.searchParams.set("client_secret", process.env.INSTAGRAM_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", shortTokenData.access_token);

    const longTokenRes = await fetch(longUrl.toString());
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || shortTokenData.access_token;
    const expiresIn = longTokenData.expires_in || 5184000; // default 60 days

    // Step 3: Get Facebook Pages the user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(
        `${baseUrl}?error=instagram_no_pages`
      );
    }

    // Step 4: Find the Instagram Business Account linked to the first page
    let igUserId = null;
    let igUsername = null;
    let pageToken = null;

    for (const page of pagesData.data) {
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json();

      if (igData.instagram_business_account) {
        igUserId = igData.instagram_business_account.id;
        pageToken = page.access_token;

        // Get IG username
        const profileRes = await fetch(
          `https://graph.facebook.com/v21.0/${igUserId}?fields=username,name,profile_picture_url&access_token=${page.access_token}`
        );
        const profileData = await profileRes.json();
        igUsername = profileData.username || null;
        break;
      }
    }

    if (!igUserId) {
      return NextResponse.redirect(
        `${baseUrl}?error=instagram_no_business_account`
      );
    }

    // Step 5: Save to session
    const session = await getSession();
    session.instagram = {
      accessToken: pageToken || accessToken,
      igUserId,
      username: igUsername,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    await session.save();

    const response = NextResponse.redirect(`${baseUrl}?connected=instagram`);
    response.cookies.delete("instagram_oauth_state");
    return response;
  } catch (err) {
    console.error("Instagram auth error:", err);
    return NextResponse.redirect(`${baseUrl}?error=instagram_auth_error`);
  }
}
