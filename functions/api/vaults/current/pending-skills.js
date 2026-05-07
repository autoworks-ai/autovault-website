import { requireUser } from "../../_lib/auth.js";
import { handleApi, json, readJson } from "../../_lib/http.js";
import { getCurrentVault, getSubscription, savePendingSkill } from "../../_lib/vault.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const subscription = await getSubscription(env, user.id);
    if (!subscription.active) return json({ error: "Active hosted vault subscription required." }, { status: 402 });
    const vault = await getCurrentVault(env, user.id);
    if (!vault) return json({ error: "Provision a hosted vault before saving pending imports." }, { status: 409 });
    const body = await readJson(request);
    const pending = await savePendingSkill(env, user, vault, body);
    return json({ pending });
  });
}
