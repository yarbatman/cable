import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";

/* ─── X / Twitter: search users by name ─────────────────────────────────── */
async function searchX(name, session) {
  const token = session.x?.accessToken || process.env.X_ACCESS_TOKEN;
  if (!token) {
    // No token: return best-guess handle
    const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
    return [{ handle, name, bio: "Best guess — verify handle on X", selected: true, guessed: true }];
  }
  try {
    const q = encodeURIComponent(name);
    const res = await fetch(`https://api.twitter.com/2/users/search?query=${q}&max_results=5&user.fields=name,username,description,profile_image_url`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const v1Res = await fetch(`https://api.twitter.com/1.1/users/search.json?q=${q}&count=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!v1Res.ok) {
        const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
        return [{ handle, name, bio: "Best guess — X search unavailable", selected: true, guessed: true }];
      }
      const v1Data = await v1Res.json();
      if (!v1Data.length) {
        const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
        return [{ handle, name, bio: "No matches found — verify handle", selected: true, guessed: true }];
      }
      return v1Data.map((u, i) => ({
        handle: `@${u.screen_name}`,
        name: u.name,
        bio: u.description || "",
        avatar: u.profile_image_url_https || "",
        selected: i === 0,
      }));
    }
    const data = await res.json();
    if (!data.data || data.data.length === 0) {
      const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
      return [{ handle, name, bio: "No matches found — verify handle", selected: true, guessed: true }];
    }
    return data.data.map((u, i) => ({
      handle: `@${u.username}`,
      name: u.name,
      bio: u.description || "",
      avatar: u.profile_image_url || "",
      selected: i === 0,
    }));
  } catch (e) {
    console.error("X search error:", e.message);
    const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
    return [{ handle, name, bio: "Best guess — X search error", selected: true, guessed: true }];
  }
}

/* ─── Bluesky: search actors ────────────────────────────────────────────── */
async function searchBluesky(name, session) {
  const handle = session.bluesky?.handle || process.env.BLUESKY_HANDLE;
  const password = session.bluesky?.appPassword || process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    const guess = `@${name.toLowerCase().replace(/\s+/g, "")}.bsky.social`;
    return [{ handle: guess, name, bio: "Best guess — connect Bluesky for search", selected: true, guessed: true }];
  }
  try {
    const authRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: handle, password }),
    });
    if (!authRes.ok) {
      const guess = `@${name.toLowerCase().replace(/\s+/g, "")}.bsky.social`;
      return [{ handle: guess, name, bio: "Best guess — Bluesky auth failed", selected: true, guessed: true }];
    }
    const auth = await authRes.json();
    const q = encodeURIComponent(name);
    const res = await fetch(`https://bsky.social/xrpc/app.bsky.actor.searchActors?q=${q}&limit=5`, {
      headers: { Authorization: `Bearer ${auth.accessJwt}` },
    });
    if (!res.ok || !(await res.clone().json()).actors?.length) {
      const guess = `@${name.toLowerCase().replace(/\s+/g, "")}.bsky.social`;
      return [{ handle: guess, name, bio: "No matches found — verify handle", selected: true, guessed: true }];
    }
    const data = await res.json();
    return data.actors.map((a, i) => ({
      handle: `@${a.handle}`,
      name: a.displayName || a.handle,
      bio: a.description || "",
      avatar: a.avatar || "",
      did: a.did,
      selected: i === 0,
    }));
  } catch (e) {
    console.error("Bluesky search error:", e.message);
    const guess = `@${name.toLowerCase().replace(/\s+/g, "")}.bsky.social`;
    return [{ handle: guess, name, bio: "Best guess — Bluesky search error", selected: true, guessed: true }];
  }
}

/* ─── Instagram: search users via Facebook Graph API ──────────────────── */
async function searchInstagram(name, session) {
  const token = session.instagram?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = session.instagram?.igUserId || process.env.INSTAGRAM_USER_ID;
  if (!token || !igUserId) {
    const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
    return [{ handle, name, bio: "Best guess — connect Instagram for search", selected: true, guessed: true }];
  }
  try {
    const q = encodeURIComponent(name);
    // Search for Instagram users by name using the business discovery endpoint
    // Note: This searches public business/creator accounts only
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}?fields=business_discovery.fields(username,name,biography,profile_picture_url){username=${q}}&access_token=${token}`
    );
    if (res.ok) {
      const data = await res.json();
      const bd = data.business_discovery;
      if (bd) {
        return [{
          handle: `@${bd.username}`,
          name: bd.name || bd.username,
          bio: bd.biography || "",
          avatar: bd.profile_picture_url || "",
          selected: true,
        }];
      }
    }
    // Fallback: best guess from name
    const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
    return [{
      handle,
      name: name,
      bio: "Best guess — verify handle on Instagram",
      selected: true,
      guessed: true,
    }];
  } catch (e) {
    console.error("Instagram search error:", e.message);
    const handle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
    return [{
      handle,
      name: name,
      bio: "Best guess — verify handle on Instagram",
      selected: true,
      guessed: true,
    }];
  }
}

/* ─── LinkedIn: search 1st-degree connections ───────────────────────────── */
async function searchLinkedIn(name, session) {
  const token = session.linkedin?.accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
  const guess = name.toLowerCase().replace(/\s+/g, "-");
  if (!token) {
    return [{ handle: guess, name, bio: "Best guess — connect LinkedIn for search", selected: true, guessed: true }];
  }
  try {
    const q = encodeURIComponent(name);
    const res = await fetch(`https://api.linkedin.com/v2/connections?q=viewer&start=0&count=5&keywords=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const searchRes = await fetch(`https://api.linkedin.com/v2/search?q=people&keywords=${q}&count=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!searchRes.ok) {
        return [{ handle: guess, name, bio: "Best guess — LinkedIn search unavailable", selected: true, guessed: true }];
      }
      const searchData = await searchRes.json();
      const results = (searchData.elements || []).map((e, i) => ({
        handle: e.vanityName || e.id,
        name: `${e.firstName?.localized?.en_US || ""} ${e.lastName?.localized?.en_US || ""}`.trim(),
        bio: e.headline?.localized?.en_US || "",
        urn: e.id ? `urn:li:person:${e.id}` : "",
        selected: i === 0,
      }));
      return results.length ? results : [{ handle: guess, name, bio: "No matches found — verify handle", selected: true, guessed: true }];
    }
    const data = await res.json();
    const results = (data.elements || []).map((e, i) => ({
      handle: e.vanityName || e.id,
      name: `${e.firstName || ""} ${e.lastName || ""}`.trim(),
      bio: e.headline || "",
      urn: e.urn || (e.id ? `urn:li:person:${e.id}` : ""),
      selected: i === 0,
    }));
    return results.length ? results : [{ handle: guess, name, bio: "No matches found — verify handle", selected: true, guessed: true }];
  } catch (e) {
    console.error("LinkedIn search error:", e.message);
    return [{ handle: guess, name, bio: "Best guess — LinkedIn search error", selected: true, guessed: true }];
  }
}

/* ─── LinkedIn: resolve from profile URL ────────────────────────────────── */
async function resolveLinkedInUrl(url, session) {
  const token = session.linkedin?.accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
  try {
    const personMatch = url.match(/linkedin\.com\/in\/([^/?]+)/);
    const companyMatch = url.match(/linkedin\.com\/company\/([^/?]+)/);

    if (personMatch) {
      const vanity = personMatch[1];
      // Try API if we have a token
      if (token) {
        try {
          const res = await fetch(`https://api.linkedin.com/v2/people/(vanityName:${vanity})`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            return {
              handle: vanity,
              name: `${data.firstName?.localized?.en_US || ""} ${data.lastName?.localized?.en_US || ""}`.trim() || vanity,
              bio: data.headline?.localized?.en_US || "Resolved via profile URL",
              urn: data.id ? `urn:li:person:${data.id}` : `urn:li:person:${vanity}`,
              selected: true,
              fromUrl: true,
            };
          }
        } catch {}
      }
      // Fallback: parse from URL slug (works without token)
      return {
        handle: vanity,
        name: vanity.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        bio: "Resolved from profile URL",
        urn: `urn:li:person:${vanity}`,
        selected: true,
        fromUrl: true,
      };
    }

    if (companyMatch) {
      const slug = companyMatch[1];
      return {
        handle: slug,
        name: slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        bio: "Company page",
        urn: `urn:li:organization:${slug}`,
        selected: true,
        fromUrl: true,
        isCompany: true,
      };
    }

    return null;
  } catch (e) {
    console.error("LinkedIn URL resolve error:", e.message);
    return null;
  }
}

/* ─── Main endpoint ─────────────────────────────────────────────────────── */
export async function POST(request) {
  const { name, linkedinUrl, context } = await request.json();
  const session = await getSession();

  // If resolving a LinkedIn URL directly
  if (linkedinUrl) {
    const resolved = await resolveLinkedInUrl(linkedinUrl, session);
    if (resolved) {
      return NextResponse.json({ success: true, name, linkedin: [resolved] });
    }
    return NextResponse.json({ success: false, error: "Could not resolve LinkedIn URL" }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Fan out searches in parallel
  const [xResults, blueskyResults, linkedinResults, instagramResults] = await Promise.all([
    searchX(name, session),
    searchBluesky(name, session),
    searchLinkedIn(name, session),
    searchInstagram(name, session),
  ]);

  // Substack: best guess from name (no search API)
  const substackHandle = `@${name.toLowerCase().replace(/\s+/g, "")}`;
  const substackResults = [{
    handle: substackHandle,
    name: name,
    bio: "Best guess — verify handle",
    selected: true,
    guessed: true,
  }];

  return NextResponse.json({
    success: true,
    name,
    candidates: {
      x: xResults,
      linkedin: linkedinResults,
      instagram: instagramResults,
      bluesky: blueskyResults,
      substack: substackResults,
    },
  });
}
