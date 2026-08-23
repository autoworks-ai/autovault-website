import { handleApi, ApiError } from "../../../api/_lib/http.js";
import { authenticateDeviceRequest, deviceJson, touchDevice } from "../../../api/_lib/sync.js";

// GET /v/<slug>/devices/current  ->  { device_id, status }
//
// What the CLI polls every 1.5s while its spinner is up, waiting for the owner
// to admit it. Any enrolled device may read its own status, including a
// revoked one -- the CLI exits 1 on `revoked`, and it can only do that if we
// say so.
export async function onRequestGet(context) {
  return handleApi(async () => {
    const { request, env, params } = context;
    const { device } = await authenticateDeviceRequest(request, env, params.slug);

    // A key that was never enrolled is a different fact from a revoked one,
    // and the CLI treats them differently. Reporting "revoked" here would tell
    // a machine that its enrollment was taken away when it never had one.
    if (!device) throw new ApiError(404, "This device is not enrolled with that vault.");

    await touchDevice(env, device);
    return deviceJson({ device_id: device.id, status: device.status });
  });
}
