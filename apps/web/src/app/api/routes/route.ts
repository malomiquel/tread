import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { createRoute, readDraft, routesForPhone } from "@/lib/server/routes";

/**
 * The user's routes.
 *
 * GET is what the phone reads after it has synced, to take in the routes
 * drawn or imported on the web and drop the ones deleted here. POST makes a
 * new route from the web's editor or a GPX import. Both need a session; the
 * phone's comes in its Cookie header, as for /api/sync.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await routesForPhone(session.user.id));
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const draft = readDraft(await request.json().catch(() => null));
  if (!draft) return NextResponse.json({ error: "unreadable" }, { status: 400 });
  return NextResponse.json({ id: await createRoute(session.user.id, draft) }, { status: 201 });
}
