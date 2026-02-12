import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";

// In-memory temp image store (works within same serverless instance)
// For production, use Vercel Blob, S3, or Cloudinary
if (!global.__tempImages) global.__tempImages = new Map();

function storeTempImage(base64, mimeType) {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  global.__tempImages.set(id, { base64, mimeType, createdAt: Date.now() });
  // Clean up old images (> 5 min)
  for (const [k, v] of global.__tempImages.entries()) {
    if (Date.now() - v.createdAt > 300000) global.__tempImages.delete(k);
  }
  return id;
}

export async function POST(request) {
  const session = await getSession();

  if (!session.instagram?.accessToken || !session.instagram?.igUserId) {
    return NextResponse.json({ error: "Not authenticated with Instagram" }, { status: 401 });
  }

  if (Date.now() > (session.instagram.expiresAt || 0)) {
    return NextResponse.json({ error: "Instagram token expired. Please reconnect." }, { status: 401 });
  }

  const { text, imageBase64, imageMimeType } = await request.json();

  if (!text?.trim() && !imageBase64) {
    return NextResponse.json({ error: "Caption or image required" }, { status: 400 });
  }

  const token = session.instagram.accessToken;
  const igUserId = session.instagram.igUserId;

  try {
    let containerId;

    if (imageBase64) {
      // Store image temporarily and create a URL for it
      const imgId = storeTempImage(imageBase64, imageMimeType || "image/jpeg");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const imageUrl = `${baseUrl}/api/post/instagram?img=${imgId}`;

      // Step 1: Create media container
      const containerRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: text || "",
            access_token: token,
          }),
        }
      );

      const containerData = await containerRes.json();
      if (containerData.error) {
        throw new Error(containerData.error.message || "Failed to create media container");
      }
      containerId = containerData.id;
    } else {
      // Text-only posts aren't supported by Instagram API
      // Instagram requires an image for feed posts
      return NextResponse.json({
        error: "Instagram requires an image for feed posts. Add a photo to post.",
      }, { status: 400 });
    }

    // Step 2: Wait for container to be ready (poll status)
    let ready = false;
    for (let i = 0; i < 10; i++) {
      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`
      );
      const statusData = await statusRes.json();
      if (statusData.status_code === "FINISHED") {
        ready = true;
        break;
      }
      if (statusData.status_code === "ERROR") {
        throw new Error("Instagram media processing failed");
      }
      // Wait 1 second before checking again
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!ready) {
      throw new Error("Instagram media processing timed out");
    }

    // Step 3: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: token,
        }),
      }
    );

    const publishData = await publishRes.json();
    if (publishData.error) {
      throw new Error(publishData.error.message || "Failed to publish");
    }

    // Get permalink
    let postUrl = null;
    try {
      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${publishData.id}?fields=permalink&access_token=${token}`
      );
      const mediaData = await mediaRes.json();
      postUrl = mediaData.permalink;
    } catch {}

    return NextResponse.json({
      success: true,
      platform: "instagram",
      postId: publishData.id,
      postUrl,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET handler: serve temporary images for Instagram to fetch
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imgId = searchParams.get("img");

  if (!imgId || !global.__tempImages?.has(imgId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { base64, mimeType } = global.__tempImages.get(imgId);
  const buffer = Buffer.from(base64, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType || "image/jpeg",
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=300",
    },
  });
}
