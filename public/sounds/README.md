# public/sounds

The classroom sound clips, served from `https://bigdogmath.com/sounds/<name>`.

## The cue id is the filename

`soundCueFileUrl` in `src/lib/soundBank.ts` builds `/sounds/<id>.mp3`. That is the whole mechanism -
there is no manifest, no registry, no code change. Drop `applause.mp3` in here and the synthesized
clap is replaced on the next deploy. Remove it and the synthesized cue comes back.

**It must be `.mp3`.** A `.wav` or `.m4a` sitting in this folder is a button that stays synthesized
and gives no clue why. Convert first: `ffmpeg -i clip.m4a applause.mp3`.

Some files here are not bank cues:

- `attention-call.mp3` — the Bark / eyes-up call (`src/lib/attentionCall.ts`). Absent, it falls back
  to a synthesized bing-bong.
- `music-<stateId>.mp3` — per-state / per-transition-vibe MUSIC (added 2026-08-07), e.g.
  `music-transition-hustle.mp3`, `music-transition-settle.mp3`. `stateId` is any id from
  `DEFAULT_STATES` in `src/lib/classStates.ts` (the ad-hoc "Transition now" vibes reuse the planned
  transition states' ids, so a Hustle track and a Transition-Hustle track are the same file). Same
  three-source order as the bank cues below: an IndexedDB upload on that specific laptop wins, then
  this file, then silence (there is no synthesized fallback for music - silence is the correct
  answer when nobody has set one). `src/lib/classroomAudio.ts` (`musicFileUrl`,
  `resolveCommittedMusicUrl`) is the mechanism; `/teacher/present`'s `ClassroomAudioHost` and
  `/control`'s backup host both read through it.
- Control's three timer cues (warning / countdown / times-up) are **not** here at all. Those are
  uploaded per-machine and live in IndexedDB by design.

## Naming twenty-five of them

Don't do it by hand. `npm run sounds:name -- ~/Downloads` matches every clip in a folder to its cue
using the same matcher `/control` uses for drag-and-drop, prints the mapping, and writes nothing.
Read it, then re-run with `--write`.

A file no cue claims is reported, never placed on a nearby button — a clip on the wrong key is worse
than a clip on no key, because you find out about it in front of the room.

## Three sources, in order

1. A clip loaded on the classroom laptop in `/control`'s Sounds panel (IndexedDB, per-device).
2. A committed file here.
3. The synthesized cue.

So a button is never silent, and a file removed here degrades rather than breaks. The per-device
loader is still the fastest way to try a clip before committing it.

## Why these can live in the repo

The repository is **private** (changed 2026-08-03, Steele's call). Several of these are recognizable
copyrighted recordings, and distributing them from a public repo was the reason they were kept out
before. Private settles that. If the repo is ever made public again, these clips come out first —
and note that deleting them is not enough, because git keeps history.
