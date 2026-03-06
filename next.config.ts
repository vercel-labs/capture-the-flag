import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@upstash/redis"],
};

export default withWorkflow(nextConfig);
