import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep the multipart request below Vercel's function body limit after form-data
// overhead is added.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safeLessonId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll("-", "");
  return /^[a-f0-9]{32}$/.test(normalized) ? normalized : null;
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Lesson image storage is not configured." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const lessonId = safeLessonId(form?.get("lessonId") || null);
  if (!(file instanceof File) || !lessonId) {
    return Response.json({ error: "Choose a lesson and an image to upload." }, { status: 400 });
  }

  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension || file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Lesson images must be PNG, JPG, or WebP files no larger than 4 MB." }, { status: 400 });
  }

  const path = `${lessonId}/${Date.now()}-${randomUUID()}.${extension}`;
  const storage = db.storage.from("lesson-media");
  const { error } = await storage.upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    const setupMissing = /bucket.*not found|not found.*bucket/i.test(error.message);
    return Response.json(
      { error: setupMissing ? "Run supabase/lesson-media.sql once, then upload the image again." : error.message },
      { status: setupMissing ? 503 : 500 },
    );
  }

  const { data } = storage.getPublicUrl(path);
  return Response.json({ url: data.publicUrl }, { status: 201 });
}
