#!/usr/bin/env python3
"""Import a district roster CSV into the Notion Rosters database.

Privacy design: student data flows FILE -> this script -> Notion API and is
never printed. Output is limited to column mappings, counts, and property
names. Only Name, Email, and Class/Period are written - the SIS export's
sensitive columns (DOB, health, IEP, guardian contacts) are deliberately
ignored and must never be added here.

Usage:
  python3 scripts/import-roster.py "/path/to/roster.csv"                # dry run
  python3 scripts/import-roster.py "/path/to/roster.csv" --go          # import
  Options:
    --email-pattern "{number}@nv.ccsd.net"   how to build student emails from
                                             CSV fields ({number}, {first},
                                             {last} lowercase, {f} {l} initials)
    --period-label "Period {p}"              label template; {p} = Period column
    --ds <data-source-id>                    Notion data source (default: the
                                             roster DB the site syncs from)

Auth: reads NOTION_TOKEN from the environment or from .env.local in the repo
root. Copy the value from Vercel env vars into .env.local (gitignored) -
never commit it and never paste it into a chat.

The site's roster sync (src/lib/notionRoster.ts) reads: the title property
(student name), "Email" (or "Student Email"), and "Class/Period" (or
"Period" / "Class"). This script introspects the target database and adapts
to whichever of those property names and types exist.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2025-09-03"
DEFAULT_DS = "83e163c8-ce0a-4667-98ce-b9fd03d5717e"  # matches notionRoster.ts


def read_token() -> str | None:
    import os
    if os.environ.get("NOTION_TOKEN"):
        return os.environ["NOTION_TOKEN"]
    env = Path(__file__).resolve().parent.parent / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            m = re.match(r"\s*NOTION_TOKEN\s*=\s*(.+)\s*$", line)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    return None


def notion(token: str, method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{NOTION_API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as res:
        return json.load(res)


def pick(headers: list[str], *names: str) -> str | None:
    lower = {h.lower().strip(): h for h in headers}
    for n in names:
        if n.lower() in lower:
            return lower[n.lower()]
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--go", action="store_true", help="actually create pages")
    ap.add_argument("--email-pattern", default=None)
    ap.add_argument("--period-label", default="Period {p}")
    ap.add_argument("--ds", default=DEFAULT_DS)
    args = ap.parse_args()

    rows = list(csv.DictReader(open(args.csv_path, newline="", encoding="utf-8-sig")))
    if not rows:
        print("No data rows found.")
        return 1
    headers = list(rows[0].keys())

    col_first = pick(headers, "First Name", "First")
    col_last = pick(headers, "Last Name", "Last")
    col_name = pick(headers, "Student Name", "Name")
    col_period = pick(headers, "Period", "Class/Period", "Class", "Section")
    col_number = pick(headers, "Student Number", "Student ID", "ID")
    col_email = pick(headers, "Email", "Student Email", "School Email")

    if not col_period or not (col_name or (col_first and col_last)):
        print("Could not find name/period columns. Headers seen:")
        print("  " + ", ".join(headers))
        return 1

    def student_name(r: dict) -> str:
        if col_name:
            return r[col_name].strip()
        return f"{r[col_first].strip()} {r[col_last].strip()}".strip()

    def student_email(r: dict) -> str | None:
        if col_email and r.get(col_email, "").strip():
            return r[col_email].strip().lower()
        if args.email_pattern:
            first = r.get(col_first, "").strip().lower() if col_first else ""
            last = r.get(col_last, "").strip().lower() if col_last else ""
            number = r.get(col_number, "").strip() if col_number else ""
            first = re.sub(r"[^a-z]", "", first)
            last = re.sub(r"[^a-z]", "", last)
            if "{number}" in args.email_pattern and not number:
                return None
            return args.email_pattern.format(
                number=number, first=first, last=last,
                f=first[:1], l=last[:1],
            )
        return None

    def period_label(r: dict) -> str:
        raw = r[col_period].strip()
        # Infinite Campus exports schedule strings like
        # "01 07:30AM-08:23AM(1, I); 01 07:30AM-09:15AM(E1)" - the leading
        # digits are the period number.
        m = re.match(r"\s*0*(\d+)", raw)
        p = m.group(1) if m else raw
        return args.period_label.format(p=p)

    # Build the import set; report only counts.
    seen: set[tuple[str, str]] = set()
    students: list[tuple[str, str | None, str]] = []
    skipped_dupe_rows = 0
    for r in rows:
        name = student_name(r)
        if not name:
            continue
        key = (name.lower(), period_label(r))
        if key in seen:
            skipped_dupe_rows += 1
            continue
        seen.add(key)
        students.append((name, student_email(r), period_label(r)))

    per_period: dict[str, int] = {}
    missing_email = 0
    for _, email, period in students:
        per_period[period] = per_period.get(period, 0) + 1
        if not email:
            missing_email += 1

    print("Mapping:")
    print(f"  name    <- {'%s + %s' % (col_first, col_last) if not col_name else col_name}")
    print(f"  email   <- {col_email or (args.email_pattern or 'MISSING (no column, no --email-pattern)')}")
    print(f"  period  <- {col_period} as {args.period_label!r}")
    print(f"Students: {len(students)}  (duplicate CSV rows skipped: {skipped_dupe_rows})")
    for p in sorted(per_period):
        print(f"  {p}: {per_period[p]}")
    if missing_email:
        print(f"WARNING: {missing_email} students have no email - they will sync by name+period only,")
        print("and Google sign-in verification cannot match them until emails are added.")

    token = read_token()
    if not token:
        print("\nNOTION_TOKEN not found (env or .env.local). Dry-run only; cannot reach Notion.")
        return 0 if not args.go else 1

    # Introspect the target database and adapt to its property names/types.
    ds = notion(token, "GET", f"/data_sources/{args.ds}")
    props = ds.get("schema", ds).get("properties", {})
    title_prop = next((k for k, v in props.items() if v.get("type") == "title"), None)
    email_prop = next((k for k in ("Email", "Student Email") if k in props), None)
    period_prop = next((k for k in ("Class/Period", "Period", "Class") if k in props), None)
    if not title_prop or not period_prop:
        print(f"Target database is missing required properties. Found: {', '.join(props)}")
        return 1
    email_type = props[email_prop]["type"] if email_prop else None
    period_type = props[period_prop]["type"]
    print(f"\nTarget properties: title={title_prop!r}, email={email_prop!r} ({email_type}), period={period_prop!r} ({period_type})")

    # Existing rows -> skip anything already present (by email, else name+period).
    existing_emails: set[str] = set()
    existing_namekeys: set[tuple[str, str]] = set()
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        page = notion(token, "POST", f"/data_sources/{args.ds}/query", body)
        for pg in page.get("results", []):
            p = pg.get("properties", {})
            def text_of(prop):
                if not prop:
                    return ""
                t = prop.get("type")
                if t == "title":
                    return "".join(x.get("plain_text", "") for x in prop.get("title", [])).strip()
                if t == "rich_text":
                    return "".join(x.get("plain_text", "") for x in prop.get("rich_text", [])).strip()
                if t == "email":
                    return (prop.get("email") or "").strip()
                if t == "select":
                    return (prop.get("select") or {}).get("name", "").strip()
                return ""
            nm = text_of(p.get(title_prop))
            em = text_of(p.get(email_prop)) if email_prop else ""
            pd = text_of(p.get(period_prop))
            if em:
                existing_emails.add(em.lower())
            if nm:
                existing_namekeys.add((nm.lower(), pd))
        cursor = page.get("next_cursor") if page.get("has_more") else None
        if not cursor:
            break

    to_create = []
    already = 0
    for name, email, period in students:
        if email and email.lower() in existing_emails:
            already += 1
            continue
        if not email and (name.lower(), period) in existing_namekeys:
            already += 1
            continue
        to_create.append((name, email, period))
    print(f"Already in Notion (skipped): {already}. To create: {len(to_create)}.")

    if not args.go:
        print("\nDry run complete. Re-run with --go to import.")
        return 0

    created = failed = 0
    for name, email, period in to_create:
        properties = {title_prop: {"title": [{"text": {"content": name}}]}}
        if email_prop and email:
            if email_type == "email":
                properties[email_prop] = {"email": email}
            else:
                properties[email_prop] = {"rich_text": [{"text": {"content": email}}]}
        if period_type == "select":
            properties[period_prop] = {"select": {"name": period}}
        else:
            properties[period_prop] = {"rich_text": [{"text": {"content": period}}]}
        try:
            notion(token, "POST", "/pages", {
                "parent": {"type": "data_source_id", "data_source_id": args.ds},
                "properties": properties,
            })
            created += 1
        except Exception as e:
            failed += 1
            print(f"  create failed ({type(e).__name__}) for one row in {period}")
        time.sleep(0.35)  # stay under Notion's rate limit
    print(f"Created {created} pages. Failures: {failed}.")
    print("The site picks these up on the daily roster sync, or trigger it now")
    print("by visiting /api/roster/sync while logged in as the teacher.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
