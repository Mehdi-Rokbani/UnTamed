import { useEffect, useRef } from 'react';
import styles from '../style/TopCategories.module.css';

interface Category {
  id: string | number;
  name: string;
  iconUrl?: string;
  count: number;
}

interface Props {
  topCategories: Category[];
  onSeeAll?: () => void;
}

export function TopCategories({ topCategories, onSeeAll }: Props) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const maxCount = Math.max(...topCategories.map((c) => c.count), 1);

  useEffect(() => {
    const timer = setTimeout(() => {
      barRefs.current.forEach((el, i) => {
        if (el) {
          const pct = Math.round((topCategories[i].count / maxCount) * 100);
          el.style.width = `${pct}%`;
        }
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [topCategories, maxCount]);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Your taste profile</p>
          <h2 className={styles.title}>Top categories</h2>
        </div>
        {onSeeAll && (
          <button className={styles.seeAll} onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {topCategories.length === 0 ? (
        <EmptyState />
      ) : (
        <div className={styles.grid}>
          {topCategories.map((cat, idx) => {
            const isTop = idx === 0;
            return (
              <div
                key={cat.id}
                className={`${styles.card} ${isTop ? styles.featured : ''}`}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className={styles.cardTop}>
                  <div className={styles.iconWrap}>
                    {cat.iconUrl ? (
                      <img src={cat.iconUrl} alt={cat.name} className={styles.icon} />
                    ) : (
                      <span className={styles.iconFallback}>🌿</span>
                    )}
                  </div>
                  <span className={`${styles.badge} ${isTop ? styles.badgeTop : ''}`}>
                    {isTop ? '★ Fav' : `#${idx + 1}`}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.catName}>{cat.name}</p>
                  <p className={styles.catCount}>
                    {cat.count} {cat.count === 1 ? 'trip' : 'trips'}
                  </p>
                </div>

                <div className={styles.barTrack}>
                  <div
                    ref={(el) => { barRefs.current[idx] = el; }}
                    className={`${styles.barFill} ${isTop ? styles.barFillTop : ''}`}
                    style={{ width: '0%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <p className={styles.emptyTitle}>No categories yet</p>
      <p className={styles.emptySub}>
        Complete a trip to start building your taste profile.
      </p>
    </div>
  );
}