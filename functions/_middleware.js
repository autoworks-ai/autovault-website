const DEFAULT_INSTALLER_URL = "https://raw.githubusercontent.com/autoworks-ai/autovault/main/scripts/install.sh";

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (!isInstallerHost(url.hostname)) {
    return context.next();
  }

  if (url.pathname === "/install.sh") {
    return installerResponse(context);
  }

  if (url.pathname === "/" || url.pathname === "") {
    if (wantsBrowserHtml(request)) {
      return Response.redirect("https://autovault.dev/", 302);
    }
    return installerResponse(context);
  }

  const target = new URL(url.pathname + url.search, "https://autovault.dev");
  return Response.redirect(target.toString(), 302);
}

function isInstallerHost(hostname) {
  return hostname === "autovault.sh" || hostname === "www.autovault.sh";
}

function wantsBrowserHtml(request) {
  const accept = request.headers.get("accept") || "";
  const userAgent = request.headers.get("user-agent") || "";
  const commandLineClient = /\b(curl|wget|httpie|libwww-perl|python-requests|go-http-client)\b/i.test(userAgent);
  return accept.includes("text/html") && !commandLineClient;
}

async function installerResponse(context) {
  const upstreamUrl = context.env.AUTOVAULT_INSTALLER_URL || DEFAULT_INSTALLER_URL;
  const upstream = await fetch(upstreamUrl, {
    headers: { accept: "text/x-shellscript, text/plain, */*" },
    cf: { cacheTtl: 300, cacheEverything: true }
  });

  if (!upstream.ok) {
    return new Response("Unable to fetch the AutoVault installer.\n", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff"
    }
  });
}
