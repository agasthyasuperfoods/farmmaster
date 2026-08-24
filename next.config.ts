import dns from 'dns';
dns.setServers(['8.8.8.8']);
import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  compress: true,
  async headers() {
    return [
      {
        // Cache public API routes at the Edge
        source: "/api/customer-app/:endpoint(products|categories|delivery-locations|payment-methods)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60, s-maxage=300, stale-while-revalidate=600" }
        ]
      },
      {
        // matching all API routes for CORS
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ]
  }
};

export default nextConfig;
