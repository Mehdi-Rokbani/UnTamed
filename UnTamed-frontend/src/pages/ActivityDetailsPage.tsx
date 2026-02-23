import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import type { ActivityResponse } from "../types/activity";
import styles from "../style/activity-details.module.css";

type LoadState = "loading" | "error" | "done" | "notfound";

function formatPrice(price: number) {
  if (Number.isNaN(price)) return "";
  return price === 0 ? "Free" : `${price} TND`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ActivityDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [state, setState] = useState<LoadState>("loading");
  const [activity, setActivity] = useState<ActivityResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) {
        setState("notfound");
        return;
      }

      setState("loading");
      try {
        const { data } = await http.get<ActivityResponse>(`/api/activities/${id}`);
        if (cancelled) return;

        setActivity(data);
        setState("done");
      } catch (err: any) {
        if (cancelled) return;

        const msg = String(err?.message ?? "");
        if (msg.includes("HTTP 404")) setState("notfound");
        else setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const safeDifficulty = activity?.difficulty ?? "Easy";

  const mapLink = useMemo(() => {
    if (!activity?.address) return null;
    const { latitude, longitude } = activity.address;
    if (latitude == null || longitude == null) return null;
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }, [activity]);

  if (state === "loading") {
    return (
      <main className={styles.activityDetails}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading adventure...</p>
        </div>
      </main>
    );
  }

  if (state === "notfound") {
    return (
      <main className={styles.activityDetails}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>🏕️</div>
          <h2>Adventure Not Found</h2>
          <p>This experience doesn't exist or has been removed.</p>
          <Link to="/" className={styles.btnPrimary}>Explore Other Adventures</Link>
        </div>
      </main>
    );
  }

  if (state === "error" || !activity) {
    return (
      <main className={styles.activityDetails}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>⚠️</div>
          <h2>Something Went Wrong</h2>
          <p>We couldn't load this adventure.</p>
          <button className={styles.btnPrimary} onClick={() => nav(0)}>Try Again</button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.activityDetails}>
      {/* Hero Section */}
      <div className={styles.detailsHero}>
        <Link to="/" className={styles.backButton}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </Link>
        
        <div className={styles.heroContent}>
          <div className={`${styles.difficultyBadge} ${styles[`difficulty-${safeDifficulty.toLowerCase()}`]}`}>
            {safeDifficulty}
          </div>
          <h1 className={styles.activityTitle}>{activity.title}</h1>
          <div className={styles.priceTag}>{formatPrice(activity.price)}</div>
        </div>
      </div>

      {/* Content Section */}
      <div className={styles.detailsContent}>
        {/* Quick Info Cards */}
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <div className={styles.infoIcon}>📅</div>
            <div className={styles.infoText}>
              <span className={styles.infoLabel}>Date & Time</span>
              <span className={styles.infoValue}>{formatDate(activity.date)}</span>
            </div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoIcon}>👥</div>
            <div className={styles.infoText}>
              <span className={styles.infoLabel}>Available Spots</span>
              <span className={styles.infoValue}>{activity.capacity} spots</span>
            </div>
          </div>

          {activity.address?.displayName && (
            <div className={`${styles.infoCard} ${styles.infoCardFull}`}>
              <div className={styles.infoIcon}>📍</div>
              <div className={styles.infoText}>
                <span className={styles.infoLabel}>Location</span>
                <span className={styles.infoValue}>{activity.address.displayName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Description Section */}
        <div className={styles.descriptionSection}>
          <h2 className={styles.sectionHeading}>About This Experience</h2>
          <p className={styles.descriptionText}>{activity.description}</p>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          {mapLink && (
            <a 
              className={styles.btnSecondary} 
              href={mapLink} 
              target="_blank" 
              rel="noreferrer"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 10C10.5523 10 11 9.55228 11 9C11 8.44772 10.5523 8 10 8C9.44772 8 9 8.44772 9 9C9 9.55228 9.44772 10 10 10Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 17C13 14 16 11.4183 16 9C16 5.68629 13.3137 3 10 3C6.68629 3 4 5.68629 4 9C4 11.4183 7 14 10 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              View on Map
            </a>
          )}
          
          <button className={styles.btnPrimary} type="button">
            <span>Book This Adventure</span>
            <span className={styles.comingSoonBadge}>Coming Soon</span>
          </button>
        </div>
      </div>
    </main>
  );
}