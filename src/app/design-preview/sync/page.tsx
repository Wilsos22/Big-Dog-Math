"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../design-preview.module.css";

type Tab = "sync" | "archive";

const operations = [
  {
    id: "[SETUP_01]",
    action: "EXECUTE ->",
    title: "setupAssignmentTimelineSystem",
    detail:
      "Creates/repairs Notion database fields, structures, and foundational logs.",
    tone: "cyan",
    alert: "Triggering field repair pipeline...",
  },
  {
    id: "[PREVIEW_02]",
    action: "VIEW ->",
    title: "previewAssignmentSync",
    detail:
      "Generates an analytical sheet showing what would post. Zero Canvas or IC impact.",
    tone: "yellow",
    alert: "Compiling payload preview...",
  },
  {
    id: "[DEPLOY_03]",
    action: "PUSH ->",
    title: "pushReadyAssignmentsToCanvas",
    detail:
      "Pushes localized lesson milestones directly to live Canvas LMS course modules.",
    tone: "green",
    alert: "Pushing assets to Canvas...",
  },
  {
    id: "[EXPORT_04]",
    action: "BUILD ->",
    title: "buildInfiniteCampusVerificationExport",
    detail:
      "Runs OneRoster schema compliance validation checks and builds clean IC files.",
    tone: "orange",
    alert: "Assembling export matrix...",
  },
] as const;

export default function TeacherSyncControl() {
  const [activeTab, setActiveTab] = useState<Tab>("sync");

  return (
    <main className={styles.syncShell}>
      <header className={styles.systemHeader}>
        <div className={styles.systemWatermark}>SYS_V2</div>
        <div className={styles.systemTitle}>
          <div>[ BIGDOGMATH // CORE OPERATIONS ]</div>
          <h1>Teacher Sync Control</h1>
        </div>
        <div className={styles.systemStatus}>
          <span>STATUS: <b>ONLINE</b></span>
          <i>|</i>
          <span>HOST: <em>MATH_6_CORE</em></span>
        </div>
      </header>

      <div className={styles.syncGrid}>
        <section className={styles.operationsColumn}>
          <div className={styles.operationsBoard}>
            <div className={styles.boardTitle}>// PIPELINE OPERATIONS</div>
            <div className={styles.operationList}>
              {operations.map((operation) => (
                <button
                  key={operation.id}
                  className={`${styles.operation} ${styles[operation.tone]}`}
                  onClick={() => window.alert(operation.alert)}
                >
                  <span className={styles.operationMeta}>
                    <b>{operation.id}</b>
                    <small>{operation.action}</small>
                  </span>
                  <strong>{operation.title}</strong>
                  <p>{operation.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.systemFeed}>
            <div className={styles.feedLabel}>// ACTIVE PERIOD SYSTEM FEED</div>
            <div className={styles.feedLines}>
              <p>[08:14:22] INITIATING DATA ARCHITECT PIPELINE...</p>
              <p>[08:14:25] NOTION SHEET VERIFICATION SUCCEEDED.</p>
              <p>[08:15:01] WAITING ON INFINITE CAMPUS TOKEN HANDSHAKE...</p>
            </div>
          </div>
        </section>

        <section className={styles.dispatchBoard}>
          <div className={styles.dispatchHead}>
            <div>
              <span>[ DATA_LOG_VIEWER ]</span>
              <h2>Active Integration Dispatch</h2>
            </div>
            <div className={styles.syncTabs}>
              <button
                className={activeTab === "sync" ? styles.syncTabActive : ""}
                onClick={() => setActiveTab("sync")}
              >
                LIVE_FEED
              </button>
              <button
                className={activeTab === "archive" ? styles.syncTabActive : ""}
                onClick={() => setActiveTab("archive")}
              >
                PERIOD_ARCHIVE
              </button>
            </div>
          </div>

          {activeTab === "sync" ? <LiveFeed /> : <Archive />}

          <Link className={styles.previewBack} href="/design-preview">
            RETURN_TO_PREVIEWS
          </Link>
        </section>
      </div>
    </main>
  );
}

function LiveFeed() {
  return (
    <div className={styles.liveFeed}>
      <p>
        Below are the active alignment payloads configured for the current
        instruction sequence.
      </p>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Target Process</th>
              <th>LMS Method Signature</th>
              <th>System Bounds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Preview Sync Frame</td>
              <td>previewAssignmentSync()</td>
              <td>[LOCAL_PRE_FLIGHT]</td>
            </tr>
            <tr>
              <td>Canvas LMS Push</td>
              <td>pushReadyAssignmentsToCanvas()</td>
              <td>[EXT_CANVAS_REST]</td>
            </tr>
            <tr>
              <td>Infinite Campus Compilation</td>
              <td>buildInfiniteCampusVerificationExport()</td>
              <td>[ONEROSTER_V1.1]</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Archive() {
  return (
    <div className={styles.archiveView}>
      <div className={styles.archiveWarning}>
        [WARNING] ARCHIVE REDIRECT ENGAGED: Opening the Math 6 Period Work Log
        will dispatch data packages outwards to Google Workspace directories.
      </div>
      <p>
        Select this pathway to initiate the complete daily archive suite across
        linked cloud systems.
      </p>
      <div className={styles.archiveLaunch}>
        <span>[ GOOGLE DOCS + NOTION CONNECTOR ]</span>
        <h3>Open Period Work Log Suite</h3>
        <button
          onClick={() =>
            window.alert(
              "Redirecting to Google Doc + Notion continuous archiver platform...",
            )
          }
        >
          LAUNCH DAILY PERIOD LOG ARCHIVE
        </button>
      </div>
    </div>
  );
}
