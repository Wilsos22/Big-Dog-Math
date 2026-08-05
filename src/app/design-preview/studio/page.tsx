"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../design-preview.module.css";

const tools = ["Histogram", "Box Plot", "Stem-and-Leaf"] as const;
type Tool = (typeof tools)[number];

export default function TeacherStudioCanvas() {
  const [selectedTool, setSelectedTool] = useState<Tool>("Histogram");
  const [dataInput, setDataInput] = useState(
    "81, 55, 100, 94, 61, 80, 92, 95, 74, 86, 90",
  );
  const sampleSize = dataInput
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean).length;

  return (
    <main className={styles.labShell}>
      <nav className={styles.labNav}>
        <div className={styles.brandPath}>
          <span className={styles.bdmMark}>BDM</span>
          <span>/</span>
          <span>STUDIO_ENGINE [ID: 3642EBA1]</span>
        </div>
        <div className={styles.navActions}>
          <Link className={styles.ghostButton} href="/design-preview">
            ALL_PREVIEWS
          </Link>
          <button
            className={styles.ghostButton}
            onClick={() => window.alert("Lesson schema saved locally.")}
          >
            SAVE_DRAFT
          </button>
          <button
            className={styles.cyanButton}
            onClick={() =>
              window.alert("Deploying Data Architect block to class screens!")
            }
          >
            PUSH_LIVE_LAB
          </button>
        </div>
      </nav>

      <div className={styles.threePane}>
        <aside className={styles.manifestPane}>
          <div className={styles.paneLabel}>// MANIFEST_SEQUENCE</div>
          <div className={styles.stepList}>
            <div className={styles.inactiveStep}>
              <span>STEP_01 // INTRO</span>
              <h2>Raw Data Disruption</h2>
            </div>
            <div className={styles.activeStep}>
              <b>[EDITING]</b>
              <span>STEP_02 // THE_CORE</span>
              <h2>The Data Architect</h2>
              <p>Shaping stories hidden inside numeric sets.</p>
            </div>
            <div className={styles.inactiveStep}>
              <span>STEP_03 // SANDBOX</span>
              <h2>Continuous Distribution</h2>
            </div>
          </div>
        </aside>

        <section className={styles.canvasPane}>
          <div className={styles.gridBackdrop} />
          <div className={styles.renderFrame}>
            <div className={styles.renderHead}>
              <div>
                <span>[ LAB_STUDIO_RENDER ]</span>
                <h2>{selectedTool} Active Blueprint</h2>
              </div>
              <div className={styles.toolReadout}>
                TOOL::{selectedTool.toUpperCase()}
              </div>
            </div>

            <div className={styles.renderCanvas}>
              {selectedTool === "Histogram" && <Histogram />}
              {selectedTool === "Box Plot" && <BoxPlot />}
              {selectedTool === "Stem-and-Leaf" && <StemLeaf />}
            </div>

            <div className={styles.renderFoot}>
              <span>[ MATRIX // ACTIVE ]</span>
              <span>SAMPLE_SIZE: {sampleSize}</span>
            </div>
          </div>
        </section>

        <aside className={styles.inspectorPane}>
          <section>
            <div className={styles.inspectorTitle}>// INSTRUMENT ENGINE</div>
            <label className={styles.fieldLabel}>Select Core Visual Archetype</label>
            <div className={styles.segmentedControl}>
              {tools.map((tool) => (
                <button
                  key={tool}
                  className={selectedTool === tool ? styles.segmentActive : ""}
                  onClick={() => setSelectedTool(tool)}
                >
                  {tool === "Stem-and-Leaf" ? "Stem" : tool.split(" ")[0]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className={styles.fieldLabel} htmlFor="dataset">
              Injected Dataset Vector
            </label>
            <textarea
              id="dataset"
              className={styles.dataInput}
              value={dataInput}
              onChange={(event) => setDataInput(event.target.value)}
            />
            <small>Comma-separated matrix strings for direct evaluation.</small>
          </section>

          <section className={styles.visibilityRules}>
            <div className={styles.inspectorTitle}>// VISIBILITY OVERRIDES</div>
            <label>
              <input type="checkbox" defaultChecked />
              Expose Center (Median Value Markers)
            </label>
            <label>
              <input type="checkbox" />
              Lock Continuous Bin Intervals
            </label>
          </section>

          <button
            className={styles.complianceButton}
            onClick={() =>
              window.alert(`Variables synced to the active ${selectedTool} schema.`)
            }
          >
            GENERATE LAB COMPLIANCE
          </button>
        </aside>
      </div>
    </main>
  );
}

function Histogram() {
  return (
    <div className={styles.chartBlock}>
      <div className={styles.histogram}>
        <div style={{ height: "30%" }}>20%</div>
        <div className={styles.highlightBar} style={{ height: "75%" }}>
          60%
        </div>
        <div style={{ height: "50%" }}>40%</div>
      </div>
      <p>Continuous Interval Bin Arrays</p>
    </div>
  );
}

function BoxPlot() {
  return (
    <div className={styles.chartBlock}>
      <div className={styles.boxPlot}>
        <i />
        <span>MID_50%</span>
        <b className={styles.leftWhisker} />
        <b className={styles.rightWhisker} />
      </div>
      <p>Quartile Bounds &amp; Visualized Spread</p>
    </div>
  );
}

function StemLeaf() {
  return (
    <div className={styles.stemLeaf}>
      <div>0 | 55 94</div>
      <div>1 | 00 24 44 61 80</div>
      <div>2 | 02 44</div>
      <small>Focus: Individual Numeric Values Preserved</small>
    </div>
  );
}
