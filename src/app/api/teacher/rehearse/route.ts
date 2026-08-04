// Build one lesson's live-flow sequence WITHOUT touching a session.
//
// /teacher/rehearse needs exactly what start-lesson needs - stepsFromLesson +
// lessonSnapshotFromNotion - but must not open a session, insert a poll, or
// publish anything. So this route returns the built sequence and stops there;
// the runner turns it into per-step snapshots client-side via rehearsalFlow.ts.
//
// Teacher-gated by src/proxy.ts (the /api/teacher prefix). Read-only: it makes
// one Notion read and writes nothing anywhere.

import { getPublishedLessonById, getLessonByCode } from "@/lib/notionLessons";
import { lessonSnapshotFromNotion, stepsFromLesson } from "@/lib/lessonFlowBuild";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();
  const code = (url.searchParams.get("code") || "").trim();
  if (!id && !code) {
    return Response.json({ error: "Pass a lesson id or code." }, { status: 400 });
  }

  try {
    // Same id shape check /api/teacher/lesson uses - a Notion page id with the
    // hyphens optional.
    const lesson = id
      ? (/^[0-9a-f]{32}$/i.test(id.replace(/-/g, "")) ? await getPublishedLessonById(id) : null)
      : await getLessonByCode(code);

    if (!lesson) {
      return Response.json({ error: "That lesson is not published, or does not exist." }, { status: 404 });
    }
    const steps = stepsFromLesson(lesson);
    if (!steps.length) {
      return Response.json(
        { error: `"${lesson.title || lesson.lessonCode}" has no Lesson Steps yet, so there is nothing to run.` },
        { status: 409 },
      );
    }
    return Response.json(
      { lesson: lessonSnapshotFromNotion(lesson), steps },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "That lesson could not be loaded.";
    return Response.json({ error: message }, { status: 500 });
  }
}
