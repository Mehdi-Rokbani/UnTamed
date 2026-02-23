import { Outlet } from "react-router-dom";
import GuideSidebar from "./GuideSidebar";
import styles from "../style/guideLayout.module.css";

export default function GuideLayout() {
  return (
    <div className={styles.guideShell}>
      <GuideSidebar />
      <main className={styles.guideMain}>
        <Outlet />
      </main>
    </div>
  );
}