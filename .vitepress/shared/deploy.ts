export const RAILWAY_TEMPLATE_URL = "https://railway.com/deploy/autovault?referralCode=VuFE6g&utm_medium=integration&utm_source=template&utm_campaign=generic";

/**
 * Container tag, deliberately separate from PRODUCT_VERSION.
 *
 * The npm package and the GHCR image do not ship together. ghcr.io publishes
 * 0.4.0, v0.4.0 and latest today while npm is on 0.5.0, so a deploy page that
 * printed the CLI version next to a `docker pull` would name a tag that does
 * not resolve. Bump this when the image is actually pushed, not when the CLI
 * releases.
 */
export const MANUAL_GHCR_TAG = "v0.4.0";
export const MANUAL_GHCR_IMAGE = `ghcr.io/autoworks-ai/autovault:${MANUAL_GHCR_TAG}`;
