import styles from "../../style/admin.module.css";

type AdminStatsCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: string;
};

export default function AdminStatsCard({ label, value, helper, icon }: AdminStatsCardProps) {
  return (
    <article className={styles.statsCard}>
      <div className={styles.statsTop}>
        <div>
          <p className={styles.statsLabel}>{label}</p>
          <p className={styles.statsValue}>{value}</p>
        </div>
        {icon && <div className={styles.statsIcon}>{icon}</div>}
      </div>
      {helper && <p className={styles.statsHelper}>{helper}</p>}
    </article>
  );
}
