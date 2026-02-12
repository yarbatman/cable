import { NextResponse } from "next/server";

export async function POST(request) {
  const { text, platforms, mentions } = await request.json();
  // mentions is an optional object: { "Name": { x: "@handle", linkedin: "@handle", ... } }

  if (!text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI optimization not configured. Add ANTHROPIC_API_KEY to environment variables." },
      { status: 500 }
    );
  }

  const platformSpecs = [];
  if (platforms.includes("x")) {
    platformSpecs.push(
      `"x": Rewrite for X/Twitter. MUST be 280 characters or less (count carefully — this is the engagement sweet spot even for Premium users). Be punchy, direct, conversational. Use line breaks for impact. NEVER include hashtags. If the original has a URL, keep it — URLs count as 23 characters on X regardless of length.`
    );
  }
  if (platforms.includes("linkedin")) {
    platformSpecs.push(
      `"linkedin": Rewrite for LinkedIn. Can be up to 3000 characters but aim for 500-1500 for engagement. Professional but not stiff. Open with a hook. Use line breaks for readability. Can expand on the ideas. NEVER include hashtags anywhere in the text.`
    );
  }
  if (platforms.includes("instagram")) {
    platformSpecs.push(
      `"instagram": Rewrite for Instagram caption. Max 2200 characters but keep it punchy — first 125 chars show before "more" so lead with a hook. Conversational, authentic, emoji-friendly but don't overdo it. Use line breaks for readability. NEVER include hashtags. If there's a URL, note that links don't work in Instagram captions — suggest "link in bio" if relevant.`
    );
  }
  if (platforms.includes("bluesky")) {
    platformSpecs.push(
      `"bluesky": Rewrite for Bluesky. MUST be 300 characters or less (count carefully). Similar vibe to Twitter but slightly more room. Conversational, smart, concise. NEVER include hashtags. If the original has a URL, preserve it.`
    );
  }
  if (platforms.includes("substack")) {
    platformSpecs.push(
      `"substack": Rewrite for Substack Notes. No character limit but keep it medium-length (1-3 short paragraphs). More thoughtful and essay-like. Conversational but substantive. Can expand on the ideas. NEVER include hashtags.`
    );
  }

  if (platformSpecs.length === 0) {
    return NextResponse.json({ error: "No platforms specified" }, { status: 400 });
  }

  // Build mention context for the prompt
  let mentionInstructions = "";
  if (mentions && Object.keys(mentions).length > 0) {
    mentionInstructions = `\n\nMENTION HANDLING — CRITICAL:
The original text contains names wrapped in **double asterisks** like **Name**. These indicate people the user wants to tag/mention.
For each platform, you MUST ONLY use the handle assigned to THAT SPECIFIC platform. NEVER use a handle from a different platform.
Here are the resolved handles per platform:
${Object.entries(mentions).map(([name, handles]) =>
  `- "${name}":\n${Object.entries(handles).map(([p, h]) => `    ${p} → ${h}`).join("\n")}`
).join("\n")}

RULES:
1. For X text, ONLY use the X handle. For LinkedIn text, ONLY use the LinkedIn handle. And so on.
2. NEVER put a Bluesky handle (ending in .bsky.social) in X text or any non-Bluesky platform.
3. NEVER put a LinkedIn slug in X text or vice versa.
4. If a handle is not available for a platform, use the person's full name without asterisks or @ symbol.
5. The @handle should appear naturally in the text.`;
  }

  const systemPrompt = `You are a social media writing expert. You take a message and rewrite it optimized for specific platforms. You understand the culture, tone, and constraints of each platform deeply.

CRITICAL RULES:
- Preserve the core message and any URLs from the original
- Each version should feel native to its platform, not like a copy-paste
- Respect character limits STRICTLY — count characters carefully
- NEVER include hashtags (#) in any output for any platform
- Text wrapped in **double asterisks** indicates a person to be tagged — remove the asterisks and place an @mention naturally in the text
- Return ONLY valid JSON, no markdown fences, no explanation
- The JSON should have platform keys mapping to the optimized text string${mentionInstructions}`;

  const userPrompt = `Here is the original message:

"""
${text}
"""

Rewrite this message optimized for each platform below. Return a JSON object with these keys:

${platformSpecs.join("\n\n")}

Return ONLY the JSON object, nothing else.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      return NextResponse.json({ error: "AI API error", detail: errData }, { status: res.status });
    }

    const data = await res.json();
    const responseText = data.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const cleaned = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const optimized = JSON.parse(cleaned);

    return NextResponse.json({ success: true, optimized });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
