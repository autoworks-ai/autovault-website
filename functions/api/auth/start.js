import { createOAuthStart } from "../_lib/auth.js";
import { handleApi } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  return handleApi(async () => {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") || "";
    const returnTo = url.searchParams.get("return_to") || "/deploy.html#hosts";
    return createOAuthStart(request, env, provider, returnTo);
  });
}
