import { getSessionUser } from "./_lib/auth.js";
import { handleApi, json } from "./_lib/http.js";
import { getCurrentVault, getSubscription } from "./_lib/vault.js";

export async function onRequestGet({ request, env }) {
  return handleApi(async () => {
    const user = await getSessionUser(request, env);
    if (!user) return json({ user: null, subscription: null, vault: null });
    const [subscription, vault] = await Promise.all([
      getSubscription(env, user.id),
      getCurrentVault(env, user.id)
    ]);
    return json({ user, subscription, vault });
  });
}
