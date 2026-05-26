import type { ReactNode } from "react";
import styles from "../../style/admin.module.css";

type AdminDataTableProps = {
  columns: string[];
  children: ReactNode;
};

export default function AdminDataTable({ columns, children }: AdminDataTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
