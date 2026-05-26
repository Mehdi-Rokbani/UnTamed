import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";
import AdminTopbar from "../components/admin/AdminTopbar";
import styles from "../style/admin.module.css";

export default function AdminLayout() {
  return (
    <div className={styles.adminShell}>
      <AdminSidebar />
      <div className={styles.mainColumn}>
        <AdminTopbar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
