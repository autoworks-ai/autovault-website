import { requireUser } from "../_lib/auth.js";
import { handleApi, json } from "../_lib/http.js";
import { provisionVault } from "../_lib/vault.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const vault = await provisionVault(env, user);
    return json({ vault });
  });
}
