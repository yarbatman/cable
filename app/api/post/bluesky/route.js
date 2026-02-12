import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";

function parseFacets(text) {
  const facets = [];
  const encoder = new TextEncoder();
  const urlRegex = /https?:\/\/[^\s)]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const beforeBytes = encoder.encode(text.slice(0, match.index)).length;
    const matchBytes = encoder.encode(match[0]).length;
    facets.push({
      index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
    });
  }
  const mentionRegex = /@([a-zA-Z0-9._-]+(\.[a-zA-Z0-9._-]+)+)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    const beforeBytes = encoder.encode(text.slice(0, match.index)).length;
    const matchBytes = encoder.encode(match[0]).length;
    facets.push({
      index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
      features: [{ $type: "app.bsky.richtext.facet#mention", did: match[1] }],
    });
  }
  return facets;
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s)]+/);
  return m ? m[0] : null;
}

async function uploadBlob(accessJwt, base64, mimeType) {
  const buffer = Buffer.from(base64, "base64");

  const res = await fetch("https://bsky.social/xrpc/com.atproto.repo.uploadBlob", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessJwt}`,
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Bluesky blob upload failed: ${errText}`);
  }

  const data = await res.json();
  return data.blob;
}

export async function POST(request) {
  const { text, imageBase64, imageMimeType } = await request.json();

  const session = await getSession();
  const bsHandle = session.bluesky?.handle || process.env.BLUESKY_HANDLE;
  const bsPassword = session.bluesky?.appPassword || process.env.BLUESKY_APP_PASSWORD;

  if (!bsHandle || !bsPassword) {
    return NextResponse.json({ error: "Bluesky credentials not configured" }, { status: 401 });
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: "Post text is required" }, { status: 400 });
  }

  try {
    // Authenticate
    const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: bsHandle, password: bsPassword }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      return NextResponse.json({ error: "Bluesky auth failed", detail: err }, { status: 401 });
    }

    const bsSession = await sessionRes.json();

    // Build post record
    const record = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
    };

    const facets = parseFacets(text);
    if (facets.length > 0) record.facets = facets;

    // Handle image embed
    if (imageBase64) {
      const blob = await uploadBlob(bsSession.accessJwt, imageBase64, imageMimeType || "image/jpeg");
      record.embed = {
        $type: "app.bsky.embed.images",
        images: [{ alt: "", image: blob }],
      };
    } else {
      // External link embed if no image
      const url = extractUrl(text);
      if (url) {
        record.embed = {
          $type: "app.bsky.embed.external",
          external: { uri: url, title: "", description: "" },
        };
      }
    }

    // Create post
    const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bsSession.accessJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repo: bsSession.did,
        collection: "app.bsky.feed.post",
        record,
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      return NextResponse.json({ error: "Bluesky post failed", detail: err }, { status: postRes.status });
    }

    const postData = await postRes.json();
    const rkey = postData.uri.split("/").pop();

    return NextResponse.json({
      success: true,
      platform: "bluesky",
      postId: postData.uri,
      postUrl: `https://bsky.app/profile/${bsHandle}/post/${rkey}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
