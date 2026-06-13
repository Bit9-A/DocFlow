import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the workspace package
  transpilePackages: ["@docflow/core"],

  serverExternalPackages: [
    "pdfkit",
    "fontkit",
    "linebreak",
    "png-js",
    "@swc/helpers",
    "deep-equal",
  ],
};

export default nextConfig;
