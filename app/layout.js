import "./globals.css";

export const metadata = {
  title: "Kabel — Broadcast Console",
  description:
    "Broadcast your posts across X, LinkedIn, Bluesky, and Substack",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
