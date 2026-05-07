import { handleOAuthCallback } from "../../_lib/auth.js";
import { handleApi } from "../../_lib/http.js";

export async function onRequestGet({ request, env, params }) {
  return handleApi(async () => handleOAuthCallback(request, env, params.provider));
}
