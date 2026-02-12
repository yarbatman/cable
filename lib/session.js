// lib/session.js
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export const sessionOptions = {
  password:
    process.env.COOKIE_SECRET ||
    "complex_password_at_least_32_characters_long_xxx",
  cookieName: "cable_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  },
};

// Helper that handles the async cookies() call properly in Next.js 14+
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}
