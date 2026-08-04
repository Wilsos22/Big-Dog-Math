import type { NextConfig } from "next";

// Hosts an outside slide image may be served from. Mirrors IMAGE_HOST_ALLOWLIST in
// src/lib/embedUrl.ts - a host added there and not here renders as a broken image.
const imageHosts = [
  "prod-files-secure.s3.us-west-2.amazonaws.com",
  "s3.us-west-2.amazonaws.com",
  "www.notion.so",
  "images.unsplash.com",
  "drive.google.com",
  "lh3.googleusercontent.com",
  "bigdogmath.com",
];

// Boards and pages the projector may load in an iframe. The named hosts are the ones embedUrl.ts
// rewrites into a product embed form; `https:` is what makes a plain website frame possible.
const frameHosts = [
  "https://lucid.app",
  "https://*.lucid.app",
  "https://*.lucidchart.com",
  "https://*.lucidspark.com",
  "https://embed.figma.com",
  "https://*.figma.com",
  "https://*.canva.com",
  "https://docs.google.com",
  "https:",
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async headers() {
    return [
      {
        // Scoped to the surfaces that can render a slide frame, so the rest of the site keeps
        // whatever framing policy it has today.
        source: "/:path(teacher|board|ipad|lesson)(.*)",
        headers: [
          { key: "Content-Security-Policy", value: `frame-src 'self' ${frameHosts.join(" ")};` },
        ],
      },
    ];
  },
};

export default nextConfig;
