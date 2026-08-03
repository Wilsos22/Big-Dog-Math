import {
  getPublishedLessonsForDateRange,
  getStepVocabularyForLessons,
  type LessonData,
} from "@/lib/notionLessons";
import { mergeVocabularyBlocks } from "@/lib/weeklyDisplayBoard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLASSROOM_TIME_ZONE = "America/Los_Angeles";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

interface DisplayLesson {
  id: string;
  lessonCode: string;
  title: string;
  standard: string;
  learningIntention: string;
  selectedSuccessCriterion: string;
  discussionVocabulary: string;
  topic: string;
  module: string;
  moduleTopic: string;
  classroomMode: string;
}

function classroomDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLASSROOM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(isoDate: string, offset: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + offset, 12));
  return value.toISOString().slice(0, 10);
}

function weekStartFor(isoDate: string): string {
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  // Weekends look AHEAD to the coming week. Pointing back at the week that
  // just ended left the projector reading a stale Friday date in front of
  // the room (outside critique, July 2026).
  const mondayOffset = weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday;
  return shiftDate(isoDate, mondayOffset);
}

function appliesToDate(lesson: LessonData, isoDate: string): boolean {
  const start = lesson.date.slice(0, 10);
  if (!start) return false;
  const end = lesson.dateEnd.slice(0, 10) || start;
  return start <= isoDate && isoDate <= end;
}

function contentScore(lesson: LessonData): number {
  return Number(Boolean(lesson.learningIntention.trim()))
    + Number(Boolean((lesson.selectedSuccessCriterion || lesson.successCriteria).trim()));
}

function displayLesson(lesson: LessonData): DisplayLesson {
  return {
    id: lesson.id,
    lessonCode: lesson.lessonCode,
    title: lesson.title,
    standard: lesson.standard,
    learningIntention: lesson.learningIntention,
    // The board shows ONE criterion a day, from the deliberately chosen Notion
    // property. The legacy `Success Criteria` menu is NOT sent: a whole menu on
    // a classroom TV is the failure this shape prevents.
    selectedSuccessCriterion: lesson.selectedSuccessCriterion,
    discussionVocabulary: lesson.discussionVocabulary,
    topic: lesson.topic,
    module: lesson.module,
    moduleTopic: lesson.moduleTopic,
    classroomMode: lesson.classroomMode,
  };
}

/**
 * Backfills `discussionVocabulary` from each lesson's STEPS when the
 * lesson-level property is blank.
 *
 * The board's vocabulary reveal - highlight the key term, drop the sentence
 * away, fly the term up, raise the definition under it - is entirely gated on
 * finding a term. Notion has TWO places to author vocabulary: `Discussion
 * Vocabulary` on the lesson, and `Vocabulary` on each Lesson Step. The board
 * only ever read the first one, so a lesson authored the second way (which is
 * the common way - it is the field beside the step you are writing) reached the
 * TVs with the reveal silently switched off. That is what happened to
 * M1.T1.L2-D1 on 2026-08-03: five defined terms on its steps, nothing on the
 * lesson, and a board that only typed the sentence in and stopped.
 *
 * Mutates in place, and swallows its own failures - a board with no reveal is
 * still a working board, and this must never be the reason a classroom TV
 * shows an error.
 */
async function fillVocabularyFromSteps(days: { lessons: DisplayLesson[] }[]): Promise<void> {
  const missing = days
    .flatMap((day) => day.lessons)
    .filter((lesson) => !lesson.discussionVocabulary.trim());
  if (!missing.length) return;

  try {
    const byLesson = await getStepVocabularyForLessons(missing.map((lesson) => lesson.id));
    for (const lesson of missing) {
      const blocks = byLesson.get(lesson.id);
      if (blocks?.length) lesson.discussionVocabulary = mergeVocabularyBlocks(blocks);
    }
  } catch {
    // Leave the blank vocabulary exactly as it was.
  }
}

export async function GET() {
  const today = classroomDate();
  const weekStart = weekStartFor(today);
  const weekEnd = shiftDate(weekStart, 4);

  try {
    const lessons = await getPublishedLessonsForDateRange(weekStart, weekEnd);
    const uniqueLessons = [...new Map(lessons.map((lesson) => [lesson.id.replace(/-/g, ""), lesson])).values()];
    const days = WEEKDAYS.map((weekday, index) => {
      const date = shiftDate(weekStart, index);
      const matchingLessons = uniqueLessons
        .filter((lesson) => appliesToDate(lesson, date))
        .sort((left, right) => (
          contentScore(right) - contentScore(left)
          || Number(right.date.slice(0, 10) === date) - Number(left.date.slice(0, 10) === date)
          || left.lessonCode.localeCompare(right.lessonCode)
        ));

      return {
        weekday,
        date,
        lessons: matchingLessons.map(displayLesson),
      };
    });

    await fillVocabularyFromSteps(days);

    return Response.json(
      {
        today,
        timeZone: CLASSROOM_TIME_ZONE,
        weekStart,
        weekEnd,
        days,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message, today }, { status: 500 });
  }
}
