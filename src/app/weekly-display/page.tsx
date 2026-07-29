"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { BELL_SCHEDULE, bellRowStates, minutesInZone, type BellRowState } from "@/lib/bellSchedule";
import {
  BOARD_CREAM,
  BOARD_FAINT,
  BOARD_INK,
  BOARD_LINE,
  BOARD_MUTED,
  BOARD_PAPER,
  BOARD_TIMING,
  BOARD_WHITE,
  DAY_PALETTES,
  SCREEN_KEYS,
  SCREEN_LABELS,
  WEEKDAY_KEYS,
  dwellSeconds,
  intentionBody,
  intentionMaxSize,
  padTwo,
  readBoardVocabulary,
  selectKeyTerm,
  successSize,
  termTravelScale,
  tokenizeIntention,
  weekdayKeyFor,
  type BoardFigure,
  type BoardToken,
  type DayPalette,
  type ScreenKey,
  type WeekdayKey,
} from "@/lib/weeklyDisplayBoard";

// The board is authored at one size and scaled to whatever display it lands on.
// That is what makes the vocabulary reveal deterministic: every measurement the
// travelling key term depends on happens in these coordinates, not in the TV's.
const STAGE_W = 1920;
const STAGE_H = 1080;
const DEFAULT_ROTATION_SECONDS = 9;

interface DisplayLesson {
  id: string;
  lessonCode: string;
  title: string;
  standard: string;
  learningIntention: string;
  successCriteria: string;
  discussionVocabulary: string;
  topic: string;
  module?: string;
  moduleTopic: string;
  classroomMode: string;
}

interface DisplayDay {
  weekday: string;
  date: string;
  lessons: DisplayLesson[];
}

interface WeeklyDisplayPayload {
  today: string;
  timeZone: string;
  weekStart: string;
  weekEnd: string;
  days: DisplayDay[];
  error?: string;
}

interface BoardTheme {
  bg: string;
  fg: string;
  rule: string;
  dots: string;
  muted: string;
  badgeBg: string;
  badgeFg: string;
  chipBg: string;
  chipFg: string;
  pipFill: string;
  onDark: boolean;
}

function trackMatches(lesson: DisplayLesson, track: string): boolean {
  const haystack = [lesson.lessonCode, lesson.title, lesson.classroomMode].join(" ");
  const isAcc = /\bacc\b/i.test(haystack);
  return track === "acc" ? isAcc : !isAcc;
}

function lessonForTrack(day: DisplayDay, track: string): DisplayLesson | null {
  return day.lessons.find((lesson) => trackMatches(lesson, track)) ?? day.lessons[0] ?? null;
}

function dayFocus(lesson: DisplayLesson | null): string {
  return lesson?.topic.trim() || lesson?.title.trim() || "";
}

function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function weekdayIndexOf(isoDate: string): number {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  if (day === 0) return 0;
  return Math.min(4, Math.max(0, day - 1));
}

function themeFor(screen: ScreenKey, palette: DayPalette): BoardTheme {
  const onDark = screen === "success";
  const bg = screen === "learning" ? palette.tint
    : screen === "success" ? BOARD_INK
      : screen === "week" ? BOARD_WHITE
        : palette.accent;
  const fg = onDark ? BOARD_PAPER : BOARD_INK;
  const rule = onDark ? "rgba(246,243,236,.22)" : "rgba(32,30,26,.16)";
  const dotInk = onDark ? "rgba(246,243,236,.10)" : "rgba(32,30,26,.07)";
  return {
    bg,
    fg,
    rule,
    dots: `radial-gradient(circle at 1px 1px, ${dotInk} 1.5px, transparent 0)`,
    muted: onDark ? "rgba(246,243,236,.82)" : "rgba(32,30,26,.66)",
    badgeBg: onDark ? palette.tint : screen === "bells" ? palette.deep : BOARD_INK,
    badgeFg: onDark ? BOARD_INK : BOARD_PAPER,
    chipBg: onDark ? palette.tint : palette.deep,
    chipFg: onDark ? BOARD_INK : BOARD_PAPER,
    pipFill: onDark ? BOARD_PAPER : BOARD_INK,
    onDark,
  };
}

const EYEBROW: CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: ".18em",
  textTransform: "uppercase",
};

const COLUMN_HEAD: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: ".16em",
  textTransform: "uppercase",
};

function Chip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "12px 26px",
      borderRadius: 14,
      fontSize: 28,
      fontWeight: 600,
      ...style,
    }}>{children}</span>
  );
}

function StepChip({ label, theme }: { label: string; theme: BoardTheme }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 52,
      height: 52,
      borderRadius: 14,
      fontFamily: "var(--bdb-font)",
      fontWeight: 800,
      fontSize: 26,
      background: theme.chipBg,
      color: theme.chipFg,
    }}>{label}</span>
  );
}

/* ------------------------------------------------------------------ figures */

function FigureView({ figure, palette }: { figure: BoardFigure; palette: DayPalette }) {
  const ink = BOARD_INK;
  const muted = "rgba(32,30,26,.60)";
  const sunk = "rgba(32,30,26,.09)";

  if (figure.kind === "table") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {figure.rows.map((row) => (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }} key={row.label}>
            <span style={{
              width: 210, flex: "none", textAlign: "right", paddingRight: 12,
              fontSize: 30, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: muted,
            }}>{row.label}</span>
            {row.cells.map((cell, index) => {
              const marked = index === row.highlight;
              return (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 150, height: 88, borderRadius: 16,
                  fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 44,
                  fontFeatureSettings: "'tnum' 1",
                  background: marked ? palette.deep : sunk,
                  color: marked ? BOARD_PAPER : ink,
                }} key={`${row.label}-${index}`}>{cell}</span>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  if (figure.kind === "lines") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 34, width: 1180 }}>
        {figure.lines.map((line) => (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 26 }} key={line.label}>
            <span style={{
              width: 170, flex: "none", paddingTop: 2,
              fontSize: 30, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: muted,
            }}>{line.label}</span>
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{
                position: "absolute", left: 0, right: 0, top: 11, height: 6,
                borderRadius: 3, background: palette.deep,
              }} />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
                {line.ticks.map((tick, index) => (
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }} key={`${line.label}-${index}`}>
                    <span style={{ width: 6, height: 28, borderRadius: 3, background: palette.deep }} />
                    <span style={{ fontSize: 34, fontWeight: 700, fontFeatureSettings: "'tnum' 1", color: ink }}>{tick}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (figure.kind === "grid") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10,26px)", gridAutoRows: "26px", gap: 5 }}>
          {Array.from({ length: 100 }, (_, index) => (
            <span style={{
              borderRadius: 5,
              background: index < figure.shaded ? palette.deep : "rgba(32,30,26,.14)",
            }} key={index} />
          ))}
        </div>
        <span style={{ fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 52, letterSpacing: "-.02em", color: ink }}>
          {figure.caption}
        </span>
      </div>
    );
  }

  if (figure.kind === "blocks") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        {figure.blocks.map((block, index) => (
          <span style={{ display: "flex", alignItems: "center", gap: 30 }} key={`${block}-${index}`}>
            {index > 0 && (
              <span style={{ fontSize: 46, fontWeight: 700, color: "rgba(32,30,26,.55)" }} aria-hidden="true">&rarr;</span>
            )}
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "22px 34px", borderRadius: 18,
              fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 46,
              fontFeatureSettings: "'tnum' 1",
              background: index === figure.blocks.length - 1 ? palette.deep : sunk,
              color: index === figure.blocks.length - 1 ? BOARD_PAPER : ink,
            }}>{block}</span>
          </span>
        ))}
      </div>
    );
  }

  if (figure.kind === "steps") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        {figure.steps.map((step, index) => (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 18,
            padding: "20px 30px", borderRadius: 18,
            fontSize: 38, fontWeight: 600, background: sunk, color: ink,
          }} key={`${step}-${index}`}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 48, height: 48, borderRadius: 14,
              fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 26,
              background: palette.deep, color: BOARD_PAPER,
            }}>{index + 1}</span>
            {step}
          </span>
        ))}
      </div>
    );
  }

  return (
    <span style={{
      maxWidth: 1400, textAlign: "center",
      fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 52, lineHeight: 1.15,
      letterSpacing: "-.02em", color: ink,
    }}>{figure.text}</span>
  );
}

/* ------------------------------------------------------- learning intention */

interface LearningScreenProps {
  theme: BoardTheme;
  palette: DayPalette;
  stepLabel: string;
  intention: string;
  tokens: BoardToken[];
  maxSize: number;
  definition: string;
  figure: BoardFigure | null;
  keyTermLabel: string;
  standard: string;
  focus: string;
  motion: boolean;
  revealing: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
  intentionRef: React.RefObject<HTMLParagraphElement | null>;
  termRef: React.RefObject<HTMLSpanElement | null>;
}

function LearningScreen(props: LearningScreenProps) {
  const {
    theme, palette, stepLabel, intention, tokens, maxSize, definition, figure,
    keyTermLabel, standard, focus, motion, revealing, stageRef, intentionRef, termRef,
  } = props;
  const t = BOARD_TIMING;

  const drop = revealing ? `wldDrop .6s ${t.dropStart}s cubic-bezier(.45,0,.9,.4) both` : "none";
  const typeIn = motion ? `wldType ${t.typeDuration}s ${t.typeStart}s cubic-bezier(.62,0,.2,1) both` : "none";
  const aura = revealing ? `wldFade 1.1s ${(t.dropStart + t.auraDelay).toFixed(2)}s cubic-bezier(.16,1,.3,1) both` : "none";
  const defIn = revealing ? `wldLensRise .8s ${(t.dropStart + t.definitionDelay).toFixed(2)}s cubic-bezier(.16,1,.3,1) both` : "none";
  const figIn = revealing ? `wldLensRise .8s ${(t.dropStart + t.figureDelay).toFixed(2)}s cubic-bezier(.16,1,.3,1) both` : "none";

  let verbIndex = 0;

  return (
    <div ref={stageRef} style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      {/* The reticle is the lens the term settles into. It only means anything
          once the reveal runs, so a board with nothing to reveal never draws it. */}
      {revealing && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: aura }} aria-hidden="true">
          <span style={{ position: "absolute", left: 0, right: 0, top: "60%", height: 2, background: "rgba(32,30,26,.09)" }} />
          <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, background: "rgba(32,30,26,.09)" }} />
        </div>
      )}

      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        justifyContent: "space-between", gap: 26,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, animation: drop }}>
          <StepChip label={stepLabel} theme={theme} />
          <span style={{ ...EYEBROW, color: theme.muted }}>Today we are learning to</span>
          <span style={{ flex: 1, height: 2, background: theme.rule }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center" }}>
          {intention ? (
            <p ref={intentionRef} style={{
              margin: 0, width: "100%",
              fontFamily: "var(--bdb-font)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.032em",
              fontSize: maxSize,
              display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: ".06em .26em",
              animation: typeIn,
            }}>
              {tokens.map((token) => {
                if (token.hit) {
                  const highlight = motion
                    ? `wldHi ${t.highlightDuration}s ${t.highlightStart}s cubic-bezier(.22,1,.3,1) forwards, wldInk ${t.highlightDuration}s ${t.highlightStart}s cubic-bezier(.22,1,.3,1) forwards`
                    : "";
                  const travel = revealing
                    ? `wldTravel ${t.travelDuration}s ${t.dropStart}s cubic-bezier(.42,0,.14,1) both`
                    : "";
                  return (
                    <span
                      ref={termRef}
                      style={{
                        position: "relative", display: "inline-block", whiteSpace: "nowrap",
                        padding: "0 .1em", borderRadius: 12,
                        color: motion ? BOARD_INK : BOARD_PAPER,
                        backgroundImage: `linear-gradient(${palette.deep}, ${palette.deep})`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "left center",
                        backgroundSize: motion ? "0% 100%" : "100% 100%",
                        animation: [highlight, travel].filter(Boolean).join(", ") || "none",
                      }}
                      key={`hit-${token.index}`}
                    >{token.text}</span>
                  );
                }
                const rise = revealing
                  ? `wldDrop .6s ${(t.dropStart + token.index * t.dropStagger).toFixed(3)}s cubic-bezier(.45,0,.9,.4) both`
                  : "";
                const pulse = token.verb && motion
                  ? `wldPulse 1.5s ${(t.verbPulseStart + (verbIndex++) * t.verbPulseStagger).toFixed(2)}s ease-in-out 2`
                  : "";
                return (
                  <span
                    style={{
                      display: "inline-block", whiteSpace: "nowrap", padding: "0 .1em",
                      color: token.verb ? palette.deep : "inherit",
                      animation: [rise, pulse].filter(Boolean).join(", ") || "none",
                    }}
                    key={`tok-${token.index}`}
                  >{token.text}</span>
                );
              })}
            </p>
          ) : (
            <MissingCopy label="No learning intention published for today." theme={theme} />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", animation: drop }}>
          {standard && (
            <Chip style={{ fontFamily: "var(--bdb-font)", fontWeight: 800, background: theme.chipBg, color: theme.chipFg }}>
              {standard}
            </Chip>
          )}
          {focus && <Chip style={{ border: `2px solid ${theme.rule}`, color: theme.fg }}>{focus}</Chip>}
          {keyTermLabel && (
            <Chip style={{ gap: 12, border: `2px solid ${theme.rule}`, color: theme.muted }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: palette.accent }} />
              Key term - {keyTermLabel}
            </Chip>
          )}
        </div>
      </div>

      {revealing && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: "29%", bottom: "2%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 46, pointerEvents: "none",
        }}>
          {definition && (
            <p style={{
              margin: 0, maxWidth: 1520, textAlign: "center",
              fontSize: 60, lineHeight: 1.2, fontWeight: 500, letterSpacing: "-.015em",
              textWrap: "pretty", color: BOARD_INK, animation: defIn,
            }}>{definition}</p>
          )}
          {figure && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: 210, animation: figIn,
            }}>
              <FigureView figure={figure} palette={palette} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MissingCopy({ label, theme }: { label: string; theme: BoardTheme }) {
  return (
    <p style={{
      margin: 0,
      fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 92, lineHeight: 1.08,
      letterSpacing: "-.03em", color: theme.muted,
    }}>{label}</p>
  );
}

/* --------------------------------------------------------- success criteria */

function SuccessScreen({
  theme, palette, stepLabel, statement, standard, focus, motion,
}: {
  theme: BoardTheme;
  palette: DayPalette;
  stepLabel: string;
  statement: string;
  standard: string;
  focus: string;
  motion: boolean;
}) {
  const t = BOARD_TIMING;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <StepChip label={stepLabel} theme={theme} />
        <span style={{ ...EYEBROW, color: theme.muted }}>You&apos;ve got it when</span>
        <span style={{ flex: 1, height: 2, background: theme.rule }} />
      </div>
      <div style={{
        flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 40,
        animation: motion ? "wldEnter .6s .18s cubic-bezier(.16,1,.3,1) both" : "none",
      }}>
        {statement ? (
          <>
            <span style={{
              flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 112, height: 112, borderRadius: 32,
              fontSize: 60, fontWeight: 700, background: palette.accent, color: BOARD_INK,
            }} aria-hidden="true">&#10003;</span>
            <p style={{
              margin: 0, flex: 1,
              fontFamily: "var(--bdb-font)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.03em",
              textWrap: "pretty", fontSize: successSize(statement),
              animation: motion ? `wldType ${t.typeDuration}s .4s cubic-bezier(.62,0,.2,1) both` : "none",
            }}>{statement}</p>
          </>
        ) : (
          <MissingCopy label="No success criterion published for today." theme={theme} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {standard && (
          <Chip style={{ fontFamily: "var(--bdb-font)", fontWeight: 800, background: theme.chipBg, color: theme.chipFg }}>
            {standard}
          </Chip>
        )}
        {focus && <Chip style={{ border: `2px solid ${theme.rule}`, color: theme.muted }}>{focus}</Chip>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- weekly schedule */

function WeekScreen({
  theme, palette, days, activeDate, track, motion,
}: {
  theme: BoardTheme;
  palette: DayPalette;
  days: DisplayDay[];
  activeDate: string;
  track: string;
  motion: boolean;
}) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        flex: "none", display: "flex", alignItems: "center", gap: 28,
        padding: "0 26px 12px", color: theme.muted, ...COLUMN_HEAD,
      }}>
        <span style={{ width: 196, flex: "none" }}>Day</span>
        <span style={{ flex: 1, minWidth: 0 }}>Focus</span>
        <span style={{ width: 380, flex: "none" }}>Key term</span>
        <span style={{ width: 220, flex: "none", textAlign: "right" }}>Standard</span>
      </div>
      {days.map((day, index) => {
        const lesson = lessonForTrack(day, track);
        const active = day.date === activeDate;
        const vocabulary = readBoardVocabulary(lesson?.discussionVocabulary ?? "");
        const keyTerm = selectKeyTerm(vocabulary.entries, intentionBody(lesson?.learningIntention ?? ""));
        return (
          <div
            style={{
              flex: 1, display: "flex", alignItems: "stretch", marginBottom: 8,
              borderRadius: 20, overflow: "hidden",
              background: active ? BOARD_INK : BOARD_PAPER,
              color: active ? BOARD_PAPER : BOARD_INK,
              boxShadow: active ? "0 12px 28px rgba(32,30,26,.24)" : "none",
              animation: motion ? "wldRow .5s cubic-bezier(.16,1,.3,1) both" : "none",
              animationDelay: `${(0.12 + index * 0.08).toFixed(2)}s`,
            }}
            key={day.date}
          >
            <span style={{ flex: "none", width: 14, background: active ? palette.accent : BOARD_LINE }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 28, padding: "0 26px 0 24px" }}>
              <span style={{ width: 196, flex: "none", display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 64, height: 64, borderRadius: 18,
                  fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 26,
                  textTransform: "uppercase", letterSpacing: ".04em",
                  background: active ? palette.accent : BOARD_CREAM,
                  color: active ? BOARD_INK : BOARD_MUTED,
                }}>{day.weekday.slice(0, 3)}</span>
                <span style={{
                  fontSize: 26, fontWeight: 600, fontFeatureSettings: "'tnum' 1",
                  color: active ? "rgba(246,243,236,.72)" : BOARD_FAINT,
                }}>{formatShortDate(day.date)}</span>
              </span>
              <span style={{
                flex: 1, minWidth: 0,
                fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 46, letterSpacing: "-.025em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{dayFocus(lesson) || "Not published yet"}</span>
              {active && (
                <span style={{
                  flex: "none", display: "inline-flex", alignItems: "center", height: 44, padding: "0 20px",
                  borderRadius: 999, fontSize: 24, fontWeight: 700, letterSpacing: ".14em",
                  textTransform: "uppercase", background: palette.accent, color: BOARD_INK,
                }}>Today</span>
              )}
              <span style={{
                width: 380, flex: "none", fontSize: 26, fontWeight: 600,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                color: active ? "rgba(246,243,236,.84)" : BOARD_MUTED,
              }}>{keyTerm?.term ?? ""}</span>
              <span style={{ width: 220, flex: "none", display: "flex", justifyContent: "flex-end" }}>
                {lesson?.standard && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", height: 48, padding: "0 20px",
                    borderRadius: 12, fontSize: 26, fontWeight: 700, fontFeatureSettings: "'tnum' 1",
                    background: active ? "rgba(246,243,236,.14)" : BOARD_CREAM,
                    color: active ? BOARD_PAPER : BOARD_MUTED,
                  }}>{lesson.standard}</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ bell schedule */

function BellsScreen({
  theme, palette, rows, motion,
}: {
  theme: BoardTheme;
  palette: DayPalette;
  rows: BellRowState[];
  motion: boolean;
}) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        flex: "none", display: "flex", alignItems: "center", gap: 26,
        padding: "0 26px 10px", color: theme.muted, ...COLUMN_HEAD,
      }}>
        <span style={{ width: 172, flex: "none" }}>Period</span>
        <span style={{ flex: 1, minWidth: 0 }}>Block</span>
        <span style={{ width: 300, flex: "none" }}>Status</span>
        <span style={{ width: 270, flex: "none", textAlign: "right" }}>Time</span>
        <span style={{ width: 110, flex: "none", textAlign: "right" }}>Min</span>
      </div>
      {rows.map((row, index) => {
        const isClass = row.kind === "Class";
        return (
          <div
            style={{
              flex: 1, display: "flex", alignItems: "stretch", marginBottom: 6,
              borderRadius: 16, overflow: "hidden",
              background: row.now ? BOARD_INK : isClass ? BOARD_WHITE : BOARD_PAPER,
              color: row.now ? BOARD_PAPER : BOARD_INK,
              border: isClass || row.now ? "2px solid transparent" : "2px dashed rgba(32,30,26,.42)",
              boxShadow: row.now ? "0 12px 30px rgba(32,30,26,.28)"
                : isClass ? "0 4px 14px rgba(32,30,26,.10)" : "none",
              animation: motion ? "wldRow .5s cubic-bezier(.16,1,.3,1) both" : "none",
              animationDelay: `${(0.1 + index * 0.06).toFixed(2)}s`,
            }}
            key={`${row.label}-${row.timeLabel}`}
          >
            <span style={{
              flex: "none", width: 12,
              background: row.now ? palette.accent : isClass ? palette.deep : "rgba(32,30,26,.24)",
            }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 26, padding: "0 26px 0 22px" }}>
              <span style={{ width: 172, flex: "none", display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 58, height: 58, borderRadius: 16,
                  fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 26,
                  fontFeatureSettings: "'tnum' 1",
                  background: row.now ? palette.accent : isClass ? palette.tint : "rgba(32,30,26,.10)",
                  color: row.now ? BOARD_INK : isClass ? palette.deep : BOARD_MUTED,
                }}>{row.periodLabel || "—"}</span>
                <span style={{
                  fontSize: 24, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
                  color: row.now ? BOARD_CREAM : BOARD_MUTED,
                }}>{row.kind}</span>
              </span>
              <span style={{
                flex: 1, minWidth: 0,
                fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 38, letterSpacing: "-.02em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{row.label}</span>
              <span style={{ width: 300, flex: "none", display: "flex", alignItems: "center", gap: 14 }}>
                {row.now && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", height: 44, padding: "0 20px",
                    borderRadius: 999, fontSize: 24, fontWeight: 700, letterSpacing: ".14em",
                    textTransform: "uppercase", background: palette.accent, color: BOARD_INK,
                  }}>Now</span>
                )}
                <span style={{
                  flex: 1, height: 12, borderRadius: 999, overflow: "hidden",
                  background: row.now ? "rgba(246,243,236,.24)" : "rgba(32,30,26,.12)",
                }}>
                  <span style={{
                    display: "block", height: "100%", borderRadius: 999,
                    width: `${Math.round(row.progress * 100)}%`,
                    background: row.now ? palette.accent : "rgba(32,30,26,.30)",
                  }} />
                </span>
              </span>
              <span style={{ width: 270, flex: "none", textAlign: "right", fontSize: 32, fontWeight: 700, fontFeatureSettings: "'tnum' 1" }}>
                {row.timeLabel}
              </span>
              <span style={{
                width: 110, flex: "none", textAlign: "right", fontSize: 26, fontWeight: 600,
                fontFeatureSettings: "'tnum' 1", color: row.now ? BOARD_CREAM : BOARD_MUTED,
              }}>{row.minutesLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- board */

export default function WeeklyDisplayPage() {
  const [payload, setPayload] = useState<WeeklyDisplayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayOverride, setDayOverride] = useState<WeekdayKey | null>(null);
  const [track, setTrack] = useState("math6");
  const [course, setCourse] = useState("Math 6");
  const [rotationSeconds, setRotationSeconds] = useState(DEFAULT_ROTATION_SECONDS);
  const [screenIndex, setScreenIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [cycle, setCycle] = useState(0);
  const [rotation, setRotation] = useState(true);
  const [motion, setMotion] = useState(true);
  const [reveal, setReveal] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [scale, setScale] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const intentionRef = useRef<HTMLParagraphElement | null>(null);
  const termRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDay = params.get("day")?.toLocaleLowerCase() ?? "";
    const requestedScreen = params.get("screen")?.toLocaleLowerCase() ?? "";
    if (WEEKDAY_KEYS.includes(requestedDay as WeekdayKey)) setDayOverride(requestedDay as WeekdayKey);
    if (SCREEN_KEYS.includes(requestedScreen as ScreenKey)) {
      setScreenIndex(SCREEN_KEYS.indexOf(requestedScreen as ScreenKey));
      setRotation(false);
    }
    setTrack(params.get("track")?.toLocaleLowerCase() === "acc" ? "acc" : "math6");
    const requestedCourse = params.get("course")?.trim();
    if (requestedCourse) setCourse(requestedCourse);
    const requestedSeconds = Number(params.get("seconds"));
    if (Number.isFinite(requestedSeconds) && requestedSeconds >= 4) setRotationSeconds(requestedSeconds);
    setNow(new Date());
  }, []);

  // The footer clock and the "Now" bell row only need minute resolution.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadWeek = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/weekly-display", { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as WeeklyDisplayPayload;
      if (!response.ok || result.error) throw new Error(result.error || "The weekly display could not load.");
      setPayload(result);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The weekly display could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Preview mode (the public /demo run-through): render a posted mock week
  // instead of fetching. The parent posts { type: "bdm-studio-preview",
  // weeklyDisplay } - same bridge the live-lesson surfaces use.
  useEffect(() => {
    let active = false;
    try { active = new URLSearchParams(window.location.search).get("studioPreview") === "1"; } catch { /* ignore */ }
    if (!active) return;
    setPreviewMode(true);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; weeklyDisplay?: WeeklyDisplayPayload } | null;
      if (!data || data.type !== "bdm-studio-preview" || !data.weeklyDisplay) return;
      setPayload(data.weeklyDisplay);
      setError(null);
      setLoading(false);
    };
    window.addEventListener("message", onMessage);
    try { window.parent?.postMessage({ type: "bdm-studio-preview-ready" }, "*"); } catch { /* ignore */ }
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (previewMode) return;
    void loadWeek(true);
    const refresh = window.setInterval(() => void loadWeek(false), 60_000);
    return () => window.clearInterval(refresh);
  }, [loadWeek, previewMode]);

  // Scale the fixed 1920x1080 board to the display. Measured from the container
  // rather than window.innerWidth, which reports the pane frame in the in-app
  // browser and misreports under zoom; a zero rect retries until it is real.
  useEffect(() => {
    const fit = () => {
      const root = rootRef.current;
      if (!root) return false;
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (!width || !height) return false;
      setScale(Math.min(width / STAGE_W, height / STAGE_H));
      return true;
    };
    let attempts = 0;
    const retry = window.setInterval(() => {
      if (fit() || attempts++ > 40) window.clearInterval(retry);
    }, 100);
    fit();
    window.addEventListener("resize", fit);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => fit()) : null;
    if (observer && rootRef.current) observer.observe(rootRef.current);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener("resize", fit);
      observer?.disconnect();
    };
  }, []);

  const activeDay = useMemo(() => {
    if (!payload?.days.length) return null;
    if (dayOverride) return payload.days.find((day) => day.weekday.toLocaleLowerCase() === dayOverride) ?? null;
    return payload.days.find((day) => day.date === payload.today)
      ?? payload.days[weekdayIndexOf(payload.today)]
      ?? payload.days[0];
  }, [dayOverride, payload]);

  const activeLesson = useMemo(() => (activeDay ? lessonForTrack(activeDay, track) : null), [activeDay, track]);
  const screen = SCREEN_KEYS[screenIndex];
  const dayKey = activeDay ? weekdayKeyFor(activeDay.weekday) : "monday";
  const palette = DAY_PALETTES[dayKey];
  const theme = themeFor(screen, palette);

  const board = useMemo(() => {
    const intention = intentionBody(activeLesson?.learningIntention ?? "");
    const vocabulary = readBoardVocabulary(activeLesson?.discussionVocabulary ?? "");
    const keyTerm = selectKeyTerm(vocabulary.entries, intention);
    const hasReveal = Boolean(keyTerm?.phrase && (keyTerm.definition || vocabulary.figure));
    return {
      intention,
      tokens: tokenizeIntention(intention, keyTerm?.phrase ?? null),
      maxSize: intentionMaxSize(intention),
      keyTerm,
      figure: vocabulary.figure,
      hasReveal,
    };
  }, [activeLesson]);

  const revealing = motion && reveal && board.hasReveal;
  const hold = dwellSeconds(screen, rotationSeconds, revealing);

  // Rotation runs in two beats so the outgoing screen can slide away before the
  // next one lands, exactly as the design frames it.
  useEffect(() => {
    if (!rotation || !activeDay) return;
    const toExit = window.setTimeout(() => setPhase("out"), hold * 1000);
    const toNext = window.setTimeout(() => {
      setScreenIndex((value) => (value + 1) % SCREEN_KEYS.length);
      setPhase("in");
      setCycle((value) => value + 1);
    }, hold * 1000 + BOARD_TIMING.exitMs);
    return () => {
      window.clearTimeout(toExit);
      window.clearTimeout(toNext);
    };
  }, [activeDay, rotation, screenIndex, cycle, hold]);

  const frameKey = `${dayKey}-${screen}-${cycle}-${activeLesson?.id ?? "empty"}`;

  // Fit the intention to the stage, then measure where the key term has to
  // travel to. Both happen in unscaled stage pixels, so the reveal lands in the
  // same place on a 4K TV and a laptop.
  useLayoutEffect(() => {
    if (screen !== "learning") return;
    let cancelled = false;
    const fit = (): boolean => {
      const paragraph = intentionRef.current;
      const stage = stageRef.current;
      const wrap = paragraph?.parentElement;
      if (!paragraph || !stage || !wrap) return false;
      if (!wrap.clientHeight || !stage.offsetWidth) return false;

      let size = board.maxSize;
      paragraph.style.fontSize = `${size}px`;
      let guard = 0;
      while (
        (paragraph.scrollHeight > wrap.clientHeight || paragraph.scrollWidth > paragraph.clientWidth + 1)
        && size > 60 && guard++ < 40
      ) {
        size -= 4;
        paragraph.style.fontSize = `${size}px`;
      }

      const term = termRef.current;
      if (term) {
        let x = 0;
        let y = 0;
        let node: HTMLElement | null = term;
        while (node && node !== stage) {
          x += node.offsetLeft;
          y += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        term.style.setProperty("--dx", `${(stage.offsetWidth / 2 - (x + term.offsetWidth / 2)).toFixed(1)}px`);
        term.style.setProperty("--dy", `${(stage.offsetHeight * 0.155 - (y + term.offsetHeight / 2)).toFixed(1)}px`);
        term.style.setProperty("--sc", termTravelScale(size).toFixed(3));
      }
      return true;
    };

    const settled = fit();
    if (document.fonts?.ready) void document.fonts.ready.then(() => { if (!cancelled) fit(); });
    if (settled) return () => { cancelled = true; };
    let attempts = 0;
    const retry = window.setInterval(() => {
      if (cancelled || attempts++ > 40 || fit()) window.clearInterval(retry);
    }, 120);
    return () => {
      cancelled = true;
      window.clearInterval(retry);
    };
  }, [frameKey, screen, board.maxSize, board.tokens]);

  const bellRows = useMemo(
    () => bellRowStates(now ? minutesInZone(now, payload?.timeZone || "America/Los_Angeles") : null, BELL_SCHEDULE),
    [now, payload?.timeZone],
  );

  // The footer clock reads the same zone the bell rows do, so the board can
  // never show a time that disagrees with the block it says is happening now.
  const clockLabel = useMemo(() => {
    if (!now) return "";
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: payload?.timeZone || "America/Los_Angeles",
        hour: "numeric",
        minute: "2-digit",
      }).format(now);
    } catch {
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
    }
  }, [now, payload?.timeZone]);

  const chooseDay = (day: WeekdayKey | null) => {
    setDayOverride(day);
    setScreenIndex(0);
    setPhase("in");
    setCycle((value) => value + 1);
    const url = new URL(window.location.href);
    if (day) url.searchParams.set("day", day);
    else url.searchParams.delete("day");
    window.history.replaceState({}, "", url);
  };

  const chooseScreen = (next: ScreenKey) => {
    setScreenIndex(SCREEN_KEYS.indexOf(next));
    setPhase("in");
    setCycle((value) => value + 1);
    setRotation(false);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        chooseScreen(SCREEN_KEYS[(screenIndex + 1) % SCREEN_KEYS.length]);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        chooseScreen(SCREEN_KEYS[(screenIndex - 1 + SCREEN_KEYS.length) % SCREEN_KEYS.length]);
      } else if (/^[1-4]$/.test(event.key)) {
        chooseScreen(SCREEN_KEYS[Number(event.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screenIndex]);

  const frameAnimation = !motion ? "none"
    : phase === "out" ? `wldSlideOut ${BOARD_TIMING.exitMs}ms cubic-bezier(.55,0,.85,.3) forwards`
      : "wldSlideIn .68s cubic-bezier(.16,1,.3,1) both";

  const unitLabel = activeLesson?.moduleTopic.trim() || activeLesson?.module?.trim() || activeLesson?.topic.trim() || "";
  const focus = dayFocus(activeLesson);
  const stepLabel = padTwo(screenIndex + 1);

  return (
    <main
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: BOARD_CREAM,
        color: BOARD_INK,
        fontFamily: "var(--bdb-font-body)",
      }}
    >
      <style>{`
        .asa-fab,.asa-panel,.asa-toast,.abs-stage { display:none !important; }
        @keyframes wldType { from { clip-path:inset(-0.35em 100% -0.35em -0.15em); } to { clip-path:inset(-900px -900px -900px -0.15em); } }
        @keyframes wldDrop { from { opacity:1; transform:translateY(0); filter:blur(0); } to { opacity:0; transform:translateY(42px); filter:blur(5px); } }
        @keyframes wldTravel { from { transform:translate(0,0) scale(1); } to { transform:translate(var(--dx,0px),var(--dy,-180px)) scale(var(--sc,1)); } }
        @keyframes wldRow { from { opacity:0; transform:translateX(38px); } to { opacity:1; transform:none; } }
        @keyframes wldEnter { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:none; } }
        @keyframes wldSlideIn { 0% { opacity:0; transform:translateX(110px) scale(.982); filter:blur(7px); } 55% { filter:blur(0); } 100% { opacity:1; transform:none; filter:blur(0); } }
        @keyframes wldSlideOut { 0% { opacity:1; transform:none; filter:blur(0); } 100% { opacity:0; transform:translateX(-110px) scale(.982); filter:blur(7px); } }
        @keyframes wldFill { from { width:0%; } to { width:100%; } }
        @keyframes wldHi { from { background-size:0% 100%; } to { background-size:100% 100%; } }
        @keyframes wldInk { from { color:${BOARD_INK}; } to { color:${BOARD_PAPER}; } }
        @keyframes wldPulse { 0% { transform:translateY(0); opacity:1; } 45% { transform:translateY(-4px); opacity:.72; } 100% { transform:translateY(0); opacity:1; } }
        @keyframes wldFade { from { opacity:0; } to { opacity:1; } }
        @keyframes wldLensRise { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:none; } }
        .wld-hotcorner { position:fixed; z-index:30; right:0; bottom:0; width:min(880px,97vw); min-height:94px; display:flex; justify-content:flex-end; align-items:flex-end; padding:12px; pointer-events:none; }
        .wld-handle { pointer-events:auto; position:absolute; right:8px; bottom:7px; width:16px; height:16px; padding:0; border:0; border-radius:50%; background:rgba(32,30,26,.16); color:transparent; cursor:pointer; }
        .wld-controls { pointer-events:auto; display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:6px; padding:8px; border:1px solid rgba(255,255,255,.17); border-radius:10px; background:rgba(32,30,26,.96); color:${BOARD_PAPER}; box-shadow:0 16px 40px rgba(32,30,26,.3); opacity:0; transform:translateY(14px); transition:opacity .18s ease,transform .18s ease; }
        .wld-hotcorner:hover .wld-controls,.wld-hotcorner:focus-within .wld-controls { opacity:1; transform:translateY(0); }
        .wld-control { min-height:38px; padding:0 10px; border:1px solid rgba(255,255,255,.2); border-radius:7px; background:#3a352e; color:${BOARD_PAPER}; font-family:var(--bdb-font); font-size:.75rem; font-weight:800; cursor:pointer; }
        .wld-control:hover,.wld-control:focus-visible,.wld-control.active { outline:none; border-color:${palette.accent}; background:#4a443b; }
        .wld-control.active { color:${palette.accent}; }
        .wld-separator { width:1px; height:30px; background:rgba(255,255,255,.15); }
        @media (prefers-reduced-motion:reduce) {
          .wld-board *,.wld-board *::before,.wld-board *::after { animation:none !important; }
        }
      `}</style>

      {/* The outer box is the board's SCALED footprint, so it fits the display
          and centres cleanly; the inner board keeps its authored 1920x1080 and
          scales from its top-left corner. Centring the 1920px box directly gets
          clamped to the start edge once it overflows, which pushed the whole
          board off the bottom-right of the screen. */}
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale, flex: "none" }}>
      <div
        className="wld-board"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          flex: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          padding: "40px 56px 30px",
          // The ground cuts rather than crossfades. Every colour on the header
          // and footer switches with the screen, so easing only the background
          // leaves ~450ms of dark text on a lightening ground - illegible from
          // the back of a room, every nine seconds.
          backgroundColor: theme.bg,
          backgroundImage: theme.dots,
          backgroundSize: "46px 46px",
          color: theme.fg,
        }}
      >
        {loading && !payload ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", fontSize: 44, fontWeight: 700, color: theme.muted }} role="status">
            Loading this week from Notion.
          </div>
        ) : activeDay && payload ? (
          <>
            <div style={{
              flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              gap: 40, paddingBottom: 20, borderBottom: `2px solid ${theme.rule}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", height: 66, padding: "0 28px",
                  borderRadius: 999, fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 32,
                  letterSpacing: ".06em", textTransform: "uppercase",
                  background: theme.badgeBg, color: theme.badgeFg,
                }}>{activeDay.weekday}</span>
                <span style={{ fontSize: 28, fontWeight: 600, color: theme.muted }}>{formatLongDate(activeDay.date)}</span>
                {unitLabel && (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.rule }} />
                    <span style={{ fontSize: 26, fontWeight: 600, color: theme.muted }}>{unitLabel}</span>
                  </>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16, textAlign: "right" }}>
                <div style={{
                  fontSize: 26, fontWeight: 700, letterSpacing: ".16em",
                  textTransform: "uppercase", color: theme.muted,
                }}>{SCREEN_LABELS[screen]}</div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  {SCREEN_KEYS.map((key, index) => {
                    const filling = index === screenIndex && rotation && motion && phase === "in";
                    return (
                      <span style={{
                        width: 76, height: 9, borderRadius: 999, overflow: "hidden", background: theme.rule,
                      }} key={key}>
                        <span style={{
                          display: "block", height: "100%", borderRadius: 999, background: theme.pipFill,
                          width: index < screenIndex ? "100%" : index > screenIndex ? "0%" : filling ? "0%" : "100%",
                          animation: filling ? `wldFill ${hold}s linear forwards` : "none",
                        }} />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
                padding: "20px 0 12px", animation: frameAnimation,
              }}
              key={frameKey}
            >
              {screen === "learning" && (
                <LearningScreen
                  theme={theme}
                  palette={palette}
                  stepLabel={stepLabel}
                  intention={board.intention}
                  tokens={board.tokens}
                  maxSize={board.maxSize}
                  definition={board.keyTerm?.definition ?? ""}
                  figure={board.figure}
                  keyTermLabel={board.keyTerm?.term ?? ""}
                  standard={activeLesson?.standard ?? ""}
                  focus={focus}
                  motion={motion}
                  revealing={revealing}
                  stageRef={stageRef}
                  intentionRef={intentionRef}
                  termRef={termRef}
                />
              )}
              {screen === "success" && (
                <SuccessScreen
                  theme={theme}
                  palette={palette}
                  stepLabel={stepLabel}
                  statement={activeLesson?.successCriteria.trim() ?? ""}
                  standard={activeLesson?.standard ?? ""}
                  focus={focus}
                  motion={motion}
                />
              )}
              {screen === "week" && (
                <WeekScreen
                  theme={theme}
                  palette={palette}
                  days={payload.days}
                  activeDate={activeDay.date}
                  track={track}
                  motion={motion}
                />
              )}
              {screen === "bells" && (
                <BellsScreen theme={theme} palette={palette} rows={bellRows} motion={motion} />
              )}
            </div>

            <div style={{
              flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 40, paddingTop: 18, borderTop: `2px solid ${theme.rule}`,
              fontSize: 26, fontWeight: 600, letterSpacing: ".04em", color: theme.muted,
            }}>
              <span>bigdogmath - {course}</span>
              <span style={{ fontFeatureSettings: "'tnum' 1", letterSpacing: ".12em" }}>
                {padTwo(screenIndex + 1)} / {padTwo(SCREEN_KEYS.length)}
              </span>
              <span style={{ fontFeatureSettings: "'tnum' 1" }}>{clockLabel}</span>
            </div>
          </>
        ) : (
          <section style={{ flex: 1, display: "grid", placeContent: "center", gap: 24, textAlign: "center" }} role="alert">
            <h1 style={{ margin: 0, fontFamily: "var(--bdb-font)", fontWeight: 800, fontSize: 96, lineHeight: 1, letterSpacing: "-.04em" }}>
              The weekly display could not load.
            </h1>
            <p style={{ margin: 0, fontSize: 34, fontWeight: 600, color: theme.muted }}>
              {error || "Reload the page to try again."}
            </p>
          </section>
        )}
      </div>
      </div>

      <aside className="wld-hotcorner" aria-label="Weekly display controls">
        <button className="wld-handle" aria-label="Show weekly display controls">Controls</button>
        <div className="wld-controls">
          <button className={`wld-control${dayOverride === null ? " active" : ""}`} onClick={() => chooseDay(null)}>Today</button>
          {WEEKDAY_KEYS.map((day, index) => (
            <button
              className={`wld-control${dayOverride === day ? " active" : ""}`}
              onClick={() => chooseDay(day)}
              key={day}
            >
              {payload?.days[index]?.weekday.slice(0, 3) ?? day.slice(0, 3)}
            </button>
          ))}
          <span className="wld-separator" aria-hidden="true" />
          {SCREEN_KEYS.map((key, index) => (
            <button
              className={`wld-control${screenIndex === index ? " active" : ""}`}
              onClick={() => chooseScreen(key)}
              key={key}
            >
              {SCREEN_LABELS[key]}
            </button>
          ))}
          <span className="wld-separator" aria-hidden="true" />
          <button className="wld-control" onClick={() => { setPhase("in"); setCycle((value) => value + 1); }}>Replay</button>
          <button className={`wld-control${rotation ? " active" : ""}`} onClick={() => setRotation((value) => !value)}>
            {rotation ? "Pause rotation" : "Start rotation"}
          </button>
          <button className={`wld-control${motion ? " active" : ""}`} onClick={() => { setMotion((value) => !value); setCycle((value) => value + 1); }}>
            {motion ? "Pause motion" : "Play motion"}
          </button>
          <button className={`wld-control${reveal ? " active" : ""}`} onClick={() => { setReveal((value) => !value); setCycle((value) => value + 1); }}>
            Vocab reveal
          </button>
          <button className="wld-control" onClick={() => void loadWeek(true)}>Refresh</button>
          <button className="wld-control" onClick={() => void toggleFullscreen()}>Fullscreen</button>
        </div>
      </aside>
    </main>
  );
}
