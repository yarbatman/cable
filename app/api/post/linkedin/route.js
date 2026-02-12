import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";

async function uploadImage(accessToken, personUrn, base64, mimeType) {
  // Step 1: Register upload
  const registerRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202401",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  if (!registerRes.ok) {
    const errText = await registerRes.text();
    throw new Error(`LinkedIn image register failed: ${errText}`);
  }

  const registerData = await registerRes.json();
  const uploadUrl = registerData.value.uploadUrl;
  const imageUrn = registerData.value.image;

  // Step 2: Upload binary
  const buffer = Buffer.from(base64, "base64");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`LinkedIn image upload failed: ${errText}`);
  }

  return imageUrn;
}

export async function POST(request) {
  const session = await getSession();

  if (!session.linkedin?.accessToken) {
    return NextResponse.json({ error: "Not authenticated with LinkedIn" }, { status: 401 });
  }

  if (Date.now() > session.linkedin.expiresAt) {
    return NextResponse.json({ error: "LinkedIn token expired. Please reconnect." }, { status: 401 });
  }

  const { text, articleUrl, imageBase64, imageMimeType } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Post text is required" }, { status: 400 });
  }

  try {
    let imageUrn = null;
    if (imageBase64) {
      imageUrn = await uploadImage(
        session.linkedin.accessToken,
        session.linkedin.personUrn,
        imageBase64,
        imageMimeType || "image/jpeg"
      );
    }

    const postBody = {
      author: session.linkedin.personUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    // Image takes priority over article link
    if (imageUrn) {
      postBody.content = {
        media: {
          id: imageUrn,
        },
      };
    } else if (articleUrl) {
      postBody.content = {
        article: {
          source: articleUrl,
          title: "",
          description: "",
        },
      };
    }

    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.linkedin.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202401",
      },
      body: JSON.stringify(postBody),
    });

    if (res.status === 201) {
      const postId = res.headers.get("x-restli-id");
      return NextResponse.json({
        success: true,
        platform: "linkedin",
        postId,
        postUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : null,
      });
    }

    const errorData = await res.text();
    return NextResponse.json({ error: "LinkedIn API error", detail: errorData }, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
