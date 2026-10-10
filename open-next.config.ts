// OpenNext adapter config for Cloudflare Workers. Every page is rendered per
// request, so no incremental cache is configured.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
