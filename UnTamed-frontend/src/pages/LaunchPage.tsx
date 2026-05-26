import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { listPublicTemplatesPage } from "../api/activity.api";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import styles from "../style/launch.module.css";
import type { Difficulty, PublicTemplateCard } from "../types/activity";

const HeroTerrainBackground = lazy(() => import("../components/launch/HeroTerrainBackground"));
const PurposeDepthCanvas = lazy(() => import("../components/launch/PurposeDepthCanvas"));

const motionEase = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: motionEase },
  },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, ease: motionEase },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

const cardReveal = {
  hidden: { opacity: 0, y: 34, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: motionEase },
  },
};

const highlightReveal = {
  hidden: { opacity: 0, x: -18, scaleX: 0.92 },
  visible: {
    opacity: 1,
    x: 0,
    scaleX: 1,
    transition: { duration: 0.72, ease: motionEase },
  },
};

const viewportReveal = { once: true, amount: 0.2 };

const stats = [
  ["100+", "Guided Sessions"],
  ["25+", "Local Guides"],
  ["4.8", "Average Rating"],
  ["6", "Adventure Categories"],
];

const categories: { name: string; phrase: string; image: string; count: string; pill: string; layout: "tall" | "wide" | "normal" }[] = [
  { name: "Hiking", phrase: "Mountain routes led by guides who grew up on these paths", image: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80", count: "42 trails", pill: "Land", layout: "tall" },
  { name: "Camping", phrase: "Desert skies, forest floors, and coastal cliffs", image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80", count: "28 camps", pill: "Night", layout: "wide" },
  { name: "Surf", phrase: "Open water sessions with coaches who read the tide", image: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=900&q=80", count: "19 breaks", pill: "Water", layout: "normal" },
  { name: "Cycling", phrase: "Road and gravel with pacers who set a real tempo", image: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=900&q=80", count: "31 routes", pill: "Road", layout: "normal" },
  { name: "Desert", phrase: "Sahara dunes, campfire evenings, and star-filled skies", image: "https://images.unsplash.com/photo-1682686580391-615b1f28e5ee?auto=format&fit=crop&w=900&q=80", count: "14 routes", pill: "Sahara", layout: "normal" },
  { name: "Mountain", phrase: "Ridges, summits, and highland viewpoints", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80", count: "22 peaks", pill: "Summit", layout: "normal" },
];

const steps = [
  ["01", "Discover an adventure", "Search by activity, place, date, and difficulty."],
  ["02", "Book your spot", "Reserve a session with clear details and guide information."],
  ["03", "Meet your guide", "Arrive ready and connect with someone who knows the land."],
  ["04", "Check in with QR", "Use guest passes for fast attendance verification."],
];

type FeaturedExperience = {
  id: string;
  title: string;
  location: string;
  difficulty: string;
  price: string;
  badge: string;
  guideName: string;
  image: string;
  href: string;
};

const FALLBACK_EXPERIENCE_IMAGE = "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1000&q=80";

const fallbackExperiences: FeaturedExperience[] = [
  {
    id: "sunset-camp-douz",
    title: "Sunset Camp in Douz",
    location: "Douz Desert",
    difficulty: "Easy",
    price: "TND 95",
    badge: "Most booked",
    guideName: "Karim B.",
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
    href: "/home",
  },
  {
    id: "jebel-zaghouan-hike",
    title: "Jebel Zaghouan Ridge Hike",
    location: "Zaghouan",
    difficulty: "Moderate",
    price: "TND 70",
    badge: "6 spots left",
    guideName: "Sana M.",
    image: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80",
    href: "/home",
  },
  {
    id: "cap-serrat-surf",
    title: "Cap Serrat Surf Morning",
    location: "Bizerte Coast",
    difficulty: "Beginner",
    price: "TND 80",
    badge: "Open",
    guideName: "Yassine T.",
    image: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=900&q=80",
    href: "/home",
  },
];

const guideBenefits = [
  "Create sessions",
  "Manage bookings",
  "Verify attendance",
  "Grow with reviews",
];

function formatDifficulty(difficulty?: Difficulty | string | null) {
  const normalized = (difficulty ?? "").toUpperCase();
  if (normalized === "MEDIUM") return "Moderate";
  if (normalized === "HARD") return "Hard";
  return "Easy";
}

function formatPrice(price?: number | null) {
  const value = Number(price ?? 0);
  return value <= 0 ? "Free" : `TND ${Math.round(value)}`;
}

function getActivityImage(activity: PublicTemplateCard) {
  return (
    activity.coverImageUrl ||
    activity.images?.find((image) => image.cover)?.url ||
    activity.images?.[0]?.url ||
    FALLBACK_EXPERIENCE_IMAGE
  );
}

function hasActivityImage(activity: PublicTemplateCard) {
  return Boolean(activity.coverImageUrl || activity.images?.some((image) => image.url));
}

function getActivityLocation(activity: PublicTemplateCard) {
  return activity.addressDisplayName || activity.governorate || "Tunisia";
}

function getActivityBadge(activity: PublicTemplateCard) {
  const next = activity.nextSession;
  if (next && next.capacity > 0) {
    const spots = Math.max(0, next.capacity - next.bookedCount);
    if (spots === 0) return "Sold out";
    if (spots <= 3) return `${spots} spots left`;
    return "Open";
  }

  if (activity.totalBookedCount > 8) return "Most booked";
  if (activity.upcomingSessionsCount > 0) return "Open";
  return "New";
}

function mapActivityToFeatured(activity: PublicTemplateCard): FeaturedExperience {
  return {
    id: activity.id,
    title: activity.title,
    location: getActivityLocation(activity),
    difficulty: formatDifficulty(activity.difficulty),
    price: formatPrice(activity.price),
    badge: getActivityBadge(activity),
    guideName: activity.guide?.username || "local guide",
    image: getActivityImage(activity),
    href: `/activities/${activity.id}`,
  };
}

// ─── UI helpers (unchanged) ───────────────────────────────────────────────────
function Reveal({
  children,
  className = "",
  id,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.section
      id={id}
      className={`${styles.section} ${className}`}
      initial={reducedMotion ? false : "hidden"}
      whileInView={reducedMotion ? undefined : "visible"}
      viewport={viewportReveal}
      variants={{
        hidden: { opacity: 0, y: 34 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.78, delay, ease: motionEase },
        },
      }}
    >
      {children}
    </motion.section>
  );
}

function SectionHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <motion.div className={styles.sectionHeader} variants={fadeUp}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </motion.div>
  );
}

function HeroTerrainFallback() {
  return (
    <div className={styles.heroCanvas} aria-hidden="true">
      <div className={styles.canvasFallback} />
    </div>
  );
}

function PurposeCanvasFallback() {
  return <div className={styles.purposeDepthCanvas} aria-hidden="true" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function LaunchPage() {
  const navigate = useNavigate();
  const goExplore = () => navigate("/home");
  const goGuide = () => navigate("/register");
  const [featuredExperiences, setFeaturedExperiences] = useState<FeaturedExperience[]>(fallbackExperiences);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedExperiences() {
      setFeaturedLoading(true);
      setFeaturedError(false);

      try {
        const page = await listPublicTemplatesPage(0, 8);
        const mapped = (page.content ?? [])
          .filter((activity) => activity.title)
          .sort((a, b) => Number(hasActivityImage(b)) - Number(hasActivityImage(a)))
          .slice(0, 3)
          .map(mapActivityToFeatured);

        if (!cancelled && mapped.length > 0) {
          setFeaturedExperiences(mapped);
        }
      } catch {
        if (!cancelled) setFeaturedError(true);
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    }

    loadFeaturedExperiences();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Header variant="landing" />
      <main className={styles.page}>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <Suspense fallback={<HeroTerrainFallback />}>
            <HeroTerrainBackground />
          </Suspense>
          <div className={styles.heroOverlay} aria-hidden="true" />
          <motion.div
            className={styles.heroText}
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.p className={styles.eyebrow} variants={fadeUp}>
              Outdoor adventures, guided by locals
            </motion.p>
            <motion.h1 variants={fadeUp}>
              Find Your Next Wild Escape
            </motion.h1>
            <motion.p className={styles.heroLead} variants={fadeUp}>
              Discover outdoor adventures, book guided experiences, and connect with trusted local guides - from mountain trails to desert camps.
            </motion.p>
            <motion.div className={styles.actions} variants={fadeUp}>
              <motion.button type="button" className={styles.primaryButton} onClick={goExplore} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
                Explore Adventures <span aria-hidden="true">-&gt;</span>
              </motion.button>
              <motion.button type="button" className={styles.secondaryButton} onClick={goGuide} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                Become a Guide <span aria-hidden="true">-&gt;</span>
              </motion.button>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Stats ── */}
        <Reveal className={styles.statsSection}>
          <motion.div className={styles.statsStrip} variants={staggerContainer}>
            {stats.map(([value, label]) => (
              <motion.div key={label} variants={cardReveal}>
                <strong>{value}</strong>
                <span>{label}</span>
              </motion.div>
            ))}
          </motion.div>
        </Reveal>

        {/* ── Categories ── */}
        <Reveal id="explore" className={styles.categoriesSection}>
          <SectionHeader
            eyebrow="Adventure categories"
            title="Pick your wild."
            copy="Every terrain. Every pace. Always with someone who knows the land."
          />
          <motion.div className={styles.categoryBento} variants={staggerContainer}>
            {categories.map((cat) => (
              <motion.article
                key={cat.name}
                className={`${styles.categoryBentoCard} ${styles[`bento${cat.layout.charAt(0).toUpperCase() + cat.layout.slice(1)}`]}`}
                variants={cardReveal}
                whileHover={{ y: -8, scale: 1.015 }}
              >
                <img src={cat.image} alt={cat.name} loading="lazy" className={styles.bentoBg} />
                <div className={styles.bentoOverlay} aria-hidden="true" />
                <span className={styles.bentoCount}>{cat.count}</span>
                <div className={styles.bentoInfo}>
                  <span className={styles.bentoPill}>{cat.pill}</span>
                  <h3>{cat.name}</h3>
                  <p>{cat.phrase}</p>
                  <span className={styles.bentoExplore}>Explore <span aria-hidden="true">→</span></span>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </Reveal>

        {/* ── How it works ── */}
        <Reveal className={styles.stepsSection}>
          <SectionHeader eyebrow="How Untamed works" title="From discovery to QR check-in." />
          <motion.div className={styles.stepsGrid} variants={staggerContainer}>
            {steps.map(([number, title, copy]) => (
              <motion.article key={title} className={styles.stepCard} variants={cardReveal}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </motion.article>
            ))}
          </motion.div>
        </Reveal>

        {/* Featured experiences */}
        <Reveal id="adventures" className={styles.featuredSection}>
          <SectionHeader
            eyebrow="Featured experiences"
            title="A few ways to begin."
            copy="Guided experiences with real places, local knowledge, and a clear path to booking."
          />
          <motion.div className={styles.experienceStrips} variants={staggerContainer} aria-busy={featuredLoading}>
            {featuredLoading && (
              <motion.div className={styles.featuredState} variants={fadeUp}>
                Finding guided experiences...
              </motion.div>
            )}
            {featuredError && (
              <motion.div className={styles.featuredState} variants={fadeUp}>
                Showing editor picks while live experiences load.
              </motion.div>
            )}
            {featuredExperiences.map((exp, index) => (
              <motion.article
                key={exp.id}
                className={styles.experienceStrip}
                variants={cardReveal}
                whileHover={{ y: -7 }}
              >
                <Link to={exp.href} className={styles.experienceStripLink} aria-label={`Explore ${exp.title}`}>
                  <span className={styles.stripNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <div className={styles.stripImageWrap}>
                    <img
                      src={exp.image}
                      alt={exp.title}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_EXPERIENCE_IMAGE;
                      }}
                    />
                  </div>
                  <div className={styles.stripContent}>
                    <div className={styles.stripMeta}>
                      <span>{exp.location}</span>
                      <span>{exp.difficulty}</span>
                      <span>Guided by {exp.guideName}</span>
                    </div>
                    <h3>{exp.title}</h3>
                  </div>
                  <div className={styles.stripAction}>
                    <span className={styles.stripBadge}>{exp.badge}</span>
                    <strong>{exp.price}</strong>
                    <span className={styles.stripCta}>Explore <span aria-hidden="true">-&gt;</span></span>
                  </div>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        </Reveal>

        {/* ── Purpose — Concept 3: Depth Layers ── */}
        <Reveal className={styles.purposeSection}>
          {/* Canvas replaces the old TentScene */}
          <div className={styles.purposeDepthWrap} aria-hidden="true">
            <Suspense fallback={<PurposeCanvasFallback />}>
              <PurposeDepthCanvas />
            </Suspense>
          </div>

          {/* Gradient veil so text stays readable over the canvas */}
          <div className={styles.purposeVeil} aria-hidden="true" />

          <motion.div className={styles.purposeText} variants={staggerContainer}>
            <motion.span className={styles.purposeEyebrow} variants={fadeUp}>Our Purpose</motion.span>
            <blockquote className={styles.purposeQuote}>
              <motion.span className={styles.quoteMark} aria-hidden="true" variants={fadeIn}>"</motion.span>
              <motion.span variants={fadeUp}>The soul grows through</motion.span>
              <motion.span className={styles.quoteHighlight} variants={highlightReveal}>experience, not comfort.</motion.span>
            </blockquote>
            <motion.p className={styles.quoteAuthor} variants={fadeUp}>— Ibn Khaldun</motion.p>
            <motion.p className={styles.purposeCopy} variants={fadeUp}>
              Untamed is built for people who want to leave routine behind, discover real outdoor experiences, and connect with guides who know the land.
            </motion.p>
          </motion.div>
        </Reveal>

        {/* ── Guides ── */}
        <Reveal id="guides" className={styles.guidesSection}>
          <motion.div variants={staggerContainer}>
            <SectionHeader
              eyebrow="For guides"
              title="Lead better outdoor sessions with less admin."
              copy="Publish adventures, manage bookings, verify attendance, and build trust through reviews."
            />
            <motion.button type="button" className={styles.primaryButton} onClick={goGuide} variants={fadeUp} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
              Become a Guide
            </motion.button>
          </motion.div>
          <motion.div className={styles.guideBenefits} variants={staggerContainer}>
            {guideBenefits.map((benefit) => (
              <motion.span key={benefit} variants={cardReveal}>
                {benefit}
              </motion.span>
            ))}
          </motion.div>
        </Reveal>

        {/* ── Final CTA ── */}
        <Reveal className={styles.finalCta}>
          <motion.div className={styles.finalCtaInner} variants={staggerContainer}>
            <motion.h2 variants={fadeUp}>Ready to go Untamed?</motion.h2>
            <motion.p variants={fadeUp}>Start exploring guided outdoor adventures or join the platform as a local guide.</motion.p>
            <motion.div className={styles.actions} variants={fadeUp}>
              <motion.button type="button" className={styles.primaryButton} onClick={goExplore} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
                Explore Adventures
              </motion.button>
              <motion.button type="button" className={styles.secondaryButton} onClick={goGuide} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                Join as Guide
              </motion.button>
            </motion.div>
          </motion.div>
        </Reveal>

        <Footer />

      </main>
    </>
  );
}

export { LaunchPage };
export default LaunchPage;
