import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";

export async function GET() {
  const session = await getSession();

  return NextResponse.json({
    x: {
      connected: !!session.x?.accessToken,
      screenName: session.x?.screenName || null,
    },
    linkedin: {
      connected:
        !!session.linkedin?.accessToken &&
        Date.now() < (session.linkedin?.expiresAt || 0),
      name: session.linkedin?.name || null,
    },
    instagram: {
      connected:
        !!session.instagram?.accessToken &&
        Date.now() < (session.instagram?.expiresAt || 0),
      username: session.instagram?.username || null,
    },
    bluesky: {
      connected: !!session.bluesky?.handle,
      handle: session.bluesky?.handle || null,
    },
    substack: {
      connected: true,
    },
  });
}

export async function POST(request) {
  const { platform, handle, appPassword } = await request.json();

  if (platform === "bluesky") {
    if (!handle || !appPassword) {
      return NextResponse.json(
        { error: "Handle and app password are required" },
        { status: 400 }
      );
    }

    try {
      const res = await fetch(
        "https://bsky.social/xrpc/com.atproto.server.createSession",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: handle,
            password: appPassword,
          }),
        }
      );

      if (!res.ok) {
        return NextResponse.json(
          { error: "Invalid Bluesky credentials" },
          { status: 401 }
        );
      }

      const session = await getSession();
      session.bluesky = { handle, appPassword };
      await session.save();

      return NextResponse.json({ success: true, handle });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
}

export async function DELETE(request) {
  const { platform } = await request.json();
  const session = await getSession();

  if (platform === "x") delete session.x;
  if (platform === "linkedin") delete session.linkedin;
  if (platform === "instagram") delete session.instagram;
  if (platform === "bluesky") delete session.bluesky;

  await session.save();
  return NextResponse.json({ success: true });
}
