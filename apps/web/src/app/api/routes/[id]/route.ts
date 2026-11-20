import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { deleteRoute, readDraft, updateRoute } from "@/lib/server/routes";

/** One route: changed from the web's editor, or deleted. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const draft = readDraft(await request.json().catch(() => null));
  if (!draft) return NextResponse.json({ error: "unreadable" }, { status: 400 });
  const done = await updateRoute(session.user.id, (await params).id, draft);
  return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const done = await deleteRoute(session.user.id, (await params).id);
  return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
