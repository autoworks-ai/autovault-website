import { requireUser } from "../_lib/auth.js";
import { handleApi, json, readJson } from "../_lib/http.js";
import { buildHostedVaultCheckoutParams, createCheckoutSession } from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const user = await requireUser(request, env);
    const body = await readJson(request, 8_000);
    const params = buildHostedVaultCheckoutParams({
      request,
      env,
      user,
      source: body.source === "playground" ? "playground" : "deploy"
    });
    const session = await createCheckoutSession(env, params);
    return json({ url: session.url, id: session.id });
  });
}
