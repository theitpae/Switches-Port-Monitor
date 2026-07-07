import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // เปลี่ยนปลายทางไปที่ Render ของคุณ
        destination: 'https://switches-port-monitor.onrender.com/api/:path*',
      },
      {
        source: '/auth/:path*',
        // เปลี่ยนปลายทางไปที่ Render ของคุณ
        destination: 'https://switches-port-monitor.onrender.com/auth/:path*',
      },
    ]
  },
};

export default nextConfig;
