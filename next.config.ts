/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["xlsx", "pdf-parse", "pdfjs-dist"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 80, 100],
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.navii.dev",
        pathname: "/avatar/**",
      },
    ],
  },
};

module.exports = nextConfig;
