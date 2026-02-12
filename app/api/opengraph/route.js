import { NextResponse } from "next/server";

export async function POST(request) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Cable/1.0; +https://github.com/cable)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    const html = await res.text();

    const getTag = (property) => {
      const patterns = [
        new RegExp(
          `<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]+name=["']twitter:${property}["'][^>]+content=["']([^"']+)["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:${property}["']`,
          "i"
        ),
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    const title =
      getTag("title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      "";
    const description = getTag("description") || "";
    const image = getTag("image") || "";
    const siteName = getTag("site_name") || "";
    const domain = new URL(url).hostname.replace("www.", "");

    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      image: image.trim(),
      siteName: siteName.trim(),
      domain,
      hasImage: !!image,
      url,
    });
  } catch (err) {
    try {
      const domain = new URL(url).hostname.replace("www.", "");
      return NextResponse.json({
        title: "",
        description: "",
        image: "",
        siteName: "",
        domain,
        hasImage: false,
        url,
        error: err.message,
      });
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }
}
