import Link from "next/link";
import styles from "./design-preview.module.css";

export default function DesignPreviewIndex() {
  return (
    <main className={styles.previewIndex}>
      <div className={styles.indexMark}>BDM</div>
      <h1>Interface previews</h1>
      <p>
        These are isolated visual studies. They do not change the classroom
        operating screens or connect to live services.
      </p>
      <div className={styles.previewLinks}>
        <Link href="/design-preview/studio">
          <span>01</span>
          <strong>Teacher Studio Canvas</strong>
          <small>Three-pane lesson flow, live canvas, and parameter inspector</small>
        </Link>
        <Link href="/design-preview/sync">
          <span>02</span>
          <strong>Teacher Sync Control</strong>
          <small>Operations panel, system feed, and integration dispatch matrix</small>
        </Link>
      </div>
    </main>
  );
}
