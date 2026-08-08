// Classroom audio is stored in the same browser database the Live class host
// already reads. Keeping these names stable lets the teacher manage audio from
// a dedicated page without changing timer or music playback in /control.

const DATABASE_NAME = "bdm-control";
const DATABASE_VERSION = 1;
const STORE_NAME = "sounds";

export type TimerCueKey = "warn30" | "tick" | "end";

export const TIMER_CUE_KEYS: TimerCueKey[] = ["warn30", "tick", "end"];

// One channel name shared by /teacher/audio and /control. A Control tab reads its blobs once, at
// mount, so without this a song uploaded mid-period only reached the speakers after a refresh -
// and "refresh the host" is exactly the step that gets skipped when a class is walking in.
export const CLASSROOM_AUDIO_CHANNEL = "bdm-classroom-audio";

// Fire and forget. A browser without BroadcastChannel simply keeps the old refresh-the-host
// behaviour rather than throwing on a save that otherwise succeeded.
export function announceClassroomAudioChange(key: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(CLASSROOM_AUDIO_CHANNEL);
    channel.postMessage({ key });
    channel.close();
  } catch { /* ignore */ }
}

export function musicAudioKey(stateId: string): string {
  return `music:${stateId}`;
}

// State music now has the SAME committed-file fallback the sound bank has had
// since 2026-08-03 (see public/sounds/README.md's "three sources"): an
// IndexedDB upload on this device wins, then a file committed to the repo,
// then silence. Steele's own read of the sound bank ("I never downloaded
// those on this computer, they just play") was the correct mental model for
// how music should behave too - this brings music in line rather than
// leaving it as the one thing still stuck per-laptop. Namespaced with a
// `music-` prefix inside the SAME /sounds folder (not a second folder) so
// there is one place to look, one README, and one already-private repo the
// clips can safely live in.
export function musicFileUrl(stateId: string): string {
  return `/sounds/music-${stateId}.mp3`;
}

// HEAD first, exactly like the sound bank's loadCueFile: a plain <audio> src
// pointed at a 404 fires its error event late and inconsistently across
// browsers, so checking existence up front is the reliable way to fall
// through to "no music" instead of stalling on dead air.
export async function resolveCommittedMusicUrl(stateId: string): Promise<string | null> {
  const url = musicFileUrl(stateId);
  try {
    const head = await fetch(url, { method: "HEAD" });
    return head.ok ? url : null;
  } catch {
    return null;
  }
}

// The sound bank's clips share this store with the timer cues and per-state
// music. `bank:` namespaces them so a cue id can never collide with a music key.
// /control writes these (its own local `bankClipKey` produces the identical
// string); /teacher/present reads them through this helper.
export function bankAudioKey(cueId: string): string {
  return `bank:${cueId}`;
}

function storageError(message: string, error?: DOMException | null): Error {
  return new Error(error?.message ? `${message}: ${error.message}` : message);
}

function openAudioDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Audio storage is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError("Audio storage could not be opened", request.error));
    request.onblocked = () => reject(new Error("Audio storage is busy in another tab. Close that tab and try again."));
  });
}

export async function getClassroomAudio(key: string): Promise<Blob | undefined> {
  const database = await openAudioDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    let result: Blob | undefined;

    request.onsuccess = () => {
      result = request.result as Blob | undefined;
    };
    request.onerror = () => reject(storageError("The audio file could not be read", request.error));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(storageError("The audio file could not be read", transaction.error));
    };
    transaction.onabort = () => {
      database.close();
      reject(storageError("The audio read was interrupted", transaction.error));
    };
  });
}

export async function saveClassroomAudio(key: string, audio: Blob): Promise<void> {
  const database = await openAudioDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).put(audio, key);

    request.onerror = () => reject(storageError("The audio file could not be saved", request.error));
    transaction.oncomplete = () => {
      database.close();
      announceClassroomAudioChange(key);
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(storageError("The audio file could not be saved", transaction.error));
    };
    transaction.onabort = () => {
      database.close();
      reject(storageError("The audio save was interrupted", transaction.error));
    };
  });
}

export async function removeClassroomAudio(key: string): Promise<void> {
  const database = await openAudioDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).delete(key);

    request.onerror = () => reject(storageError("The audio file could not be removed", request.error));
    transaction.oncomplete = () => {
      database.close();
      announceClassroomAudioChange(key);
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(storageError("The audio file could not be removed", transaction.error));
    };
    transaction.onabort = () => {
      database.close();
      reject(storageError("The audio removal was interrupted", transaction.error));
    };
  });
}
