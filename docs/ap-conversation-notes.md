# Notes for the AP conversation — for you, not for handing over

## The one-sentence version

*"I built a website that runs my projector — lesson displays, timers, manipulatives. It doesn't
collect any student data, and I wanted you to see it before my kids do."*

Everything else is elaboration on that.

## How to run it

1. **Show it first. Talk second.** Open the site on your iPad and run ninety seconds of an actual
   lesson — a timer, a manipulative, a warm-up screen. Two minutes of the real thing beats twenty
   minutes of explanation, and it moves him from "unapproved software" to "oh, that's nice."
2. **Answer the real question before he asks it.** The only thing he actually needs to know is
   whether student data is involved. Say *"no logins, no accounts, no student names, nothing
   stored"* early and plainly.
3. **Say why you came.** *"I wanted you to know before students see it."* That sentence is the whole
   reason this goes well. Voluntary disclosure is the difference between an enthusiastic teacher and
   a discovery.
4. **Make one small, specific ask.** R-6150 approval as a supplemental digital instructional
   material. Naming the regulation shows you did the homework without turning it into a legal
   meeting.
5. **Hand him the one-pager at the end**, not the beginning. If he has paper in his hands he'll read
   instead of watching.

## What not to do

- **Don't lead with statutes.** You have FERPA, COPPA, and NRS 388 in your back pocket if he asks.
  Opening with them makes a simple thing sound complicated and invites him to punt it to district
  IT to be safe.
- **Don't present the future architecture.** No Supabase, no opaque codes, no HMAC. None of that is
  running on August 10, and describing it makes him review a system that doesn't exist.
- **Don't oversell.** "Classroom operating system" invites scrutiny. "Website that runs my
  projector" is accurate and easy to approve.
- **Don't ask for more than you need.** You need the display tool approved and the domain unblocked.
  That's it.

## Likely questions, and honest answers

| He asks | You say |
|---|---|
| "Is this approved?" | "That's what I'm asking you for — content approval under R-6150. It doesn't need the district software review because it doesn't collect student data. If you'd rather route it through TISS anyway, I'm happy to." |
| "Do students log in?" | "No. Nothing to log into." |
| "Where does it live?" | "I host it myself, personally. Costs the school nothing." |
| "What if it goes down?" | "Then I teach the lesson the way I would have anyway. It's a display tool, not a dependency." |
| "Did you build this on district time?" | "No — my own time, my own equipment, my own money." |
| "Could it track student progress?" | "It could, and I'm deliberately not doing that yet. When I want to, I'll come to you first and go through the district review before any student data is involved." |
| "Can other teachers use it?" | "If it works well this year, I'd love to share it. That's a later conversation." |
| "Is there anything on it I should look at?" | "Yes — let me show you." Then show him. |

## The one that matters most

If he asks whether student information is involved, the answer is **no**, and it's true. Don't
qualify it, don't add caveats about future plans mid-sentence, don't explain hashing. Answer the
question, then flag the future separately and on purpose — the way the one-pager does at the bottom.

## If he says no, or wants district review first

That's a fine outcome, not a failure. Ask: *"Is that a no for now, or a no until TISS looks at it?"*
Then ask who to send it to. You have the full brief, the data-flow diagram, and the justification
table ready to go — `docs/ccsd-compliance-brief.md` and `docs/ccsd-data-flow.html`.

Worst realistic case: you teach off the board for a few weeks while paperwork moves. That's an
inconvenience, not a crisis.

## What you're actually walking in with

- No real student data has ever been in the system. Verified directly against the database.
- Nothing student-linked is reachable from a browser. Verified — three curriculum content tables,
  read-only, nothing else.
- You found this yourself and came forward before anyone asked.

That's a strong position. Walk in like it.
