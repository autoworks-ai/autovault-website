import { requireUser } from "../../_lib/auth.js";
import { handleApi, json, readJson } from "../../_lib/http.js";
import { getSubscription, markVaultProgress } from "../../_lib/vault.js";

// Vestigial, like /api/logout. This backed the early-access waitlist on the
// cloud dashboard, which was removed once hosted sync shipped, so nothing in
// .vitepress/ calls it any more. The route and the two columns it writes
// (cli_linked_at, early_access_at) are left in place because dropping them
// needs a migration and buys nothing; do not wire new UI to it without
// deciding what "progress" means now.
export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const subscription = await getSubscription(env, user.id);
    if (!subscription.active) return json({ error: "Active hosted vault subscription required." }, { status: 402 });
    const body = await readJson(request);
    const vault = await markVaultProgress(env, user, body.step);
    return json({ vault });
  });
}
