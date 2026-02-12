import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { createOAuthHeader } from "../../../../lib/oauth1";

async function uploadMedia(base64, mimeType, consumerKey, consumerSecret, accessToken, accessTokenSecret) {
  const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";

  const authHeader = createOAuthHeader({
    method: "POST",
    url: uploadUrl,
    consumerKey,
    consumerSecret,
    token: accessToken,
    tokenSecret: accessTokenSecret,
  });

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      media_data: base64,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Media upload failed: ${errText}`);
  }

  const data = await res.json();
  return data.media_id_string;
}

export async function POST(request) {
  const session = await getSession();

  if (!session.x?.accessToken) {
    return NextResponse.json({ error: "Not authenticated with X" }, { status: 401 });
  }

  const { text, imageBase64, imageMimeType } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Post text is required" }, { status: 400 });
  }

  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;

  try {
    let mediaId = null;
    if (imageBase64) {
      mediaId = await uploadMedia(
        imageBase64,
        imageMimeType || "image/jpeg",
        consumerKey,
        consumerSecret,
        session.x.accessToken,
        session.x.accessTokenSecret
      );
    }

    const url = "https://api.twitter.com/2/tweets";
    const authHeader = createOAuthHeader({
      method: "POST",
      url,
      consumerKey,
      consumerSecret,
      token: session.x.accessToken,
      tokenSecret: session.x.accessTokenSecret,
    });

    const tweetBody = { text };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(tweetBody),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: "X API error", detail: data }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      platform: "x",
      postId: data.data?.id,
      postUrl: `https://x.com/${session.x.screenName}/status/${data.data?.id}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
