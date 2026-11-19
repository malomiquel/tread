import { NextResponse } from "next/server";
import { unpackTransfer } from "@tread/core/transfer";
import { auth } from "@/lib/server/auth";
import { deleteOutings, ingestGpxRuns, ingestTransfer, readUpload } from "@/lib/server/ingest";

/**
 * Where a history arrives.
 *
 * The phone posts JSON, `{ "archive": "<base64>", "deleted": [startedAt…] }`:
 * the zipped `Transfer` it already knows how to pack, and the runs it deleted
 * since the last sync. The browser posts a form with a `file`. Both
 * need a session; the phone's comes in its Cookie header.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { archive?: unknown; deleted?: unknown } | null;
    const transfer = typeof body?.archive === "string" ? await unpackTransfer(body.archive) : null;
    if (!transfer) return NextResponse.json({ error: "unreadable" }, { status: 400 });
    const deleted = Array.isArray(body?.deleted)
      ? body.deleted.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [];
    // Deleted first: a run deleted then recorded again at the same start comes back.
    const removed = await deleteOutings(userId, deleted);
    return NextResponse.json({ ...(await ingestTransfer(userId, transfer)), removed });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "unreadable" }, { status: 400 });
  const upload = await readUpload(file.name, await file.arrayBuffer());
  if (upload.kind === "transfer") return NextResponse.json(await ingestTransfer(userId, upload.transfer));
  if (upload.kind === "gpx" && upload.runs.length > 0) {
    return NextResponse.json({ ...(await ingestGpxRuns(userId, upload.runs)), unreadable: upload.unreadable });
  }
  return NextResponse.json({ error: "unreadable" }, { status: 400 });
}
