import { requireUser } from "../_lib/auth.js";
import { handleApi, json } from "../_lib/http.js";
import { getCurrentVault, getSubscription } from "../_lib/vault.js";

export async function onRequestGet({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const [subscription, vault] = await Promise.all([
      getSubscription(env, user.id),
      getCurrentVault(env, user.id)
    ]);
    return json({ vault, subscription });
  });
}
