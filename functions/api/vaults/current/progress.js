import { requireUser } from "../../_lib/auth.js";
import { handleApi, json, readJson } from "../../_lib/http.js";
import { getSubscription, markVaultProgress } from "../../_lib/vault.js";

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
