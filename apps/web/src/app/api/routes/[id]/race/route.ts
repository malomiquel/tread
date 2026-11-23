import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { setRace } from "@/lib/server/routes";

/**
 * The race planned on a route, set from the web: goal, day, laps. The phone
 * takes it in at its next sync, unless it has changed it since.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const race = await setRace(session.user.id, (await params).id, await request.json().catch(() => null));
  return race ? NextResponse.json({ race }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
