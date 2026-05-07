import { destroySession } from "./_lib/auth.js";
import { handleApi, json } from "./_lib/http.js";

export async function onRequestPost({ request, env }) {
  return handleApi(async () => {
    const cookie = await destroySession(request, env);
    return json({ ok: true }, { headers: { "set-cookie": cookie } });
  });
}
