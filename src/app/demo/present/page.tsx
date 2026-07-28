// Public wrapper for the demo run-through: the SAME Main projector component
// that runs the classroom, reachable without the teacher gate. Safe by
// construction - in studio-preview mode the surface renders only what the
// parent posts and fetches no session; every data API it could call is still
// gated. Do not add data fetching here.
export { default } from "@/app/teacher/present/page";
