# public/lesson-videos

Lesson videos for the `slide` frame. A file dropped here is served from
`https://bigdogmath.com/lesson-videos/<name>` and is referenced from a Lesson Step as a
root-relative path, exactly like a slide image: `/lesson-videos/m1t1l2-d2-takis-arizonas.mp4`.

## Why the file lives in the repo

Same argument as `public/slides`, only stronger. A hosted video is a third party, a player, a
consent frame and a bandwidth negotiation, any of which can put a spinner on the wall while thirty
kids watch. A file here is one request against the CDN that just delivered the page: if the page
loaded, the video loaded. No expiry, nothing to re-share, nothing to re-fetch.

A Notion-UPLOADED video is the one option that must never be used. Notion resolves an upload to a
signed S3 url that dies in about an hour, and Control freezes that url when it builds the lineup and
republishes the dead one all period.

## Naming

`<lesson-code-lowercased>-<short description>.mp4` - for example
`m1t1l2-d2-takis-arizonas.mp4` is the hook video for M1.T1.L2-D2. Unlike a slide image this is not
numbered by step order, because a video is usually the whole point of its step rather than one of
several visuals, and a descriptive name survives the step being reordered.

## Format

**H.264 video + AAC audio in an `.mp4` container.** `.webm` also works. Nothing else does -
`resolveSlideSource` accepts only those two extensions, on purpose. A `.mov` straight off a phone
plays on your Mac and may not play on the projector's browser, and a format that works at the desk
and fails on the wall is the worst failure there is. Same rule as the sound bank's "it must be
`.mp3`".

Keep files small. 1920x1080 is more than the room needs at 25 feet; 1280x720 at a moderate bitrate
is usually indistinguishable on a projector and a third of the size. **Target under about 10MB and
treat 25MB as the ceiling** - these are committed to git, git keeps every version forever, and a
school year of lesson videos at 100MB each would make the repository painful to clone. If a video
genuinely needs to be larger than that, it probably wants to be shorter.

There is no manifest and no code change: the path in the Lesson Step is the whole wiring.

## How it plays

**It never autoplays.** The teacher taps Play on the iPad Remote. That is deliberate - browsers
block autoplay with sound until the page has been tapped, so a narrated video set to autoplay would
open silent on a projector nobody has touched since the last deploy, which looks exactly like a
broken file.

When it ends it **holds on the last frame** and does not loop. The state ends when the teacher
advances it, not when the file runs out.

It renders on the **main projector only**. `/teacher/pace` shows it only if the step sets the slide
mirror flag, and even then pace never drives playback - the play/pause taps reach the main projector
alone, so the two screens cannot fight over the timeline.

## FERPA

**NO STUDENT NAMES, no student faces, no audible student voices, no student work with a name on
it.** The repository is private, but that does NOT make this folder private - everything under
`public/` is served by Vercel to anyone who guesses the URL. A video is far more dangerous here than
a slide, because a classroom recording carries faces and voices whether or not anyone meant it to.
If you did not film it yourself with no students in frame or on the audio, it does not go here.

Same standing caveat as the sound bank: git keeps history, so removing a file later is a history
rewrite, not a delete. Do not commit anything here you would not be willing to have permanently in
the repository.
