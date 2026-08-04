import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { teacherToken, TEACHER_COOKIE } from "@/lib/teacherToken";

// "Is this the teacher's device?" - one boolean, for PUBLIC surfaces that carry
// a teacher-only affordance.
//
// The tools are public routes every Chromebook opens, and /decimal-steps had a
// "Teacher led" toggle sitting in its top bar with a "Show the answer" button
// behind it - two taps to the answer, no gate of any kind. The real teacher
// signal is the bdm_teacher cookie, but that cookie is httpOnly by design, so a
// client cannot read it and has to ask.
//
// DELIBERATELY NOT UNDER /api/teacher: that prefix is gated by the proxy, and a
// probe that 401s cannot answer the question it exists to answer. It leaks
// nothing either way - a student gets { teacher: false } and no reason.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const password = process.env.TEACHER_PASSWORD;
  if (!password) return NextResponse.json({ teacher: false });
  const jar = await cookies();
  const teacher = jar.get(TEACHER_COOKIE)?.value === (await teacherToken(password));
  return NextResponse.json({ teacher });
}
