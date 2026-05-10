import { useState } from "react";
import styles from "../style/landing.module.css";
import hero from "../assets/images/hero.jpg";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { useNavigate } from "react-router-dom";


// Icons as SVG components for better control
const CompassIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const MapIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const AwardIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function LandingPage() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();


  const handleGetStarted = () => {
    console.log("Getting started with:", email);
     navigate("/register");
  };

  return (
    <>
    <Header>
        
    </Header>
    <div className={styles.landingPage}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroOverlay} />
        {/* Replace with your hero image */}
        <div className={styles.heroBackground} style={{
          backgroundImage: `url(${hero})`
        }} />
        
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Real outdoor experiences<br />
            Unforgettable memories<br />
            <span className={styles.heroAccent}>Raw nature</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Guided adventure tours in Tunisia's most beautiful landscapes.<br />
            From beginner to expert - your next adventure awaits.
          </p>
        </div>
      </section>

      {/* Three Roles Section */}
      <section className={styles.rolesSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>One platform. Three roles</h2>
          <p className={styles.sectionSubtitle}>
            Whether you're seeking adventure, offering expertise, or managing operations
          </p>

          <div className={styles.rolesGrid}>
            {/* Adventurer Card */}
            <div className={styles.roleCard}>
              <div className={styles.roleBadge}>ADVENTURER</div>
              <h3 className={styles.roleTitle}>GET AN UNFORGETTABLE ADVENTURE</h3>
              <p className={styles.roleDescription}>
                Discover curated outdoor experiences led by certified guides.
                Book your next camping trip, hiking expedition, or wilderness adventure.
              </p>
              <div className={styles.roleImageWrapper}>
                <img 
                  src="https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80" 
                  alt="Camping adventure"
                  className={styles.roleImage}  
                />
              </div>
            </div>

            {/* Guide Card */}
            <div className={styles.roleCard}>
              <div className={styles.roleBadge}>GUIDE</div>
              <h3 className={styles.roleTitle}>OFFER EXPERTISE AND INSPIRE OTHERS</h3>
              <p className={styles.roleDescription}>
                Share your knowledge and passion. Create memorable experiences for adventurers
                while growing your guiding business.
              </p>
              <div className={styles.roleImageWrapper}>
                <img 
                  src="https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=80" 
                  alt="Guide with compass"
                  className={styles.roleImage}  
                />
              </div>
            </div>

            {/* Admin Card */}
            <div className={styles.roleCard}>
              <div className={styles.roleBadge}>ADMIN SUPERVISOR</div>
              <h3 className={styles.roleTitle}>OVERSEE AND MANAGE THE PLATFORM</h3>
              <p className={styles.roleDescription}>
                Maintain quality standards, verify guides, manage bookings,
                and ensure the best experience for all users.
              </p>
              <div className={styles.roleImageWrapper}>
                <img 
                  src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80" 
                  alt="Admin dashboard"
                  className={styles.roleImage}  
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* From Idea to Adventure Section */}
      <section className={styles.processSection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.white}`}>From idea to adventure</h2>
          <p className={`${styles.sectionSubtitle} ${styles.white}`}>
            Everything you need to embark, guide or manage — in one place
          </p>

          <div className={styles.processGrid}>
            <div className={styles.processCard}>
              <div className={`${styles.processIcon} ${styles.orange}`}>
                <CompassIcon />
              </div>
              <h3 className={styles.processTitle}>Discover</h3>
              <p className={styles.processDescription}>
                Browse curated adventures across Tunisia's diverse landscapes
              </p>
            </div>

            <div className={styles.processCard}>
              <div className={`${styles.processIcon} ${styles.orange}`}>
                <MapIcon />
              </div>
              <h3 className={styles.processTitle}>Plan</h3>
              <p className={styles.processDescription}>
                Choose your dates, difficulty level, and group size
              </p>
            </div>

            <div className={styles.processCard}>
              <div className={`${styles.processIcon} ${styles.orange}`}>
                <CalendarIcon />
              </div>
              <h3 className={styles.processTitle}>Book</h3>
              <p className={styles.processDescription}>
                Secure your spot with instant confirmation
              </p>
            </div>

            <div className={styles.processCard}>
              <div className={`${styles.processIcon} ${styles.orange}`}>
                <AwardIcon />
              </div>
              <h3 className={styles.processTitle}>Experience</h3>
              <p className={styles.processDescription}  >
                Create unforgettable memories in the wild
              </p>
            </div>
          </div>

          <button className={`${styles.ctaButton} ${styles.primary}`} onClick={handleGetStarted}>
            START YOUR ADVENTURE
          </button>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className={styles.whySection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Why choose UnTamed?</h2>
          <p className={styles.sectionSubtitle}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit
          </p>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <CheckIcon />
              </div>
              <h3 className={styles.featureTitle}>Certified Guides</h3>
              <p className={styles.featureDescription}>
                All our guides are professionally certified and thoroughly vetted for your safety
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <CheckIcon />
              </div>
              <h3 className={styles.featureTitle}>Best Locations</h3>
              <p className={styles.featureDescription}>
                Handpicked destinations showcasing Tunisia's most stunning natural beauty
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <CheckIcon />
              </div>
              <h3 className={styles.featureTitle}>Easy Booking</h3>
              <p className={styles.featureDescription}>
                Simple, secure reservation system with instant confirmation
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <CheckIcon />
              </div>
              <h3 className={styles.featureTitle}>24/7 Support</h3>
              <p className={styles.featureDescription}>
                Round-the-clock assistance before, during, and after your adventure
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className={styles.quoteSection}>
        <div className={styles.quoteOverlay} />
        <div className={styles.quoteBackground} style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2000&q=80")'
        }} />
        
        <div className={styles.quoteContent}>
          <h2 className={styles.quoteText}>
            "The soul grows through<br />
            <span className={styles.quoteHighlight}>experiences not comfort"</span>
          </h2>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.white}`}>Your next adventure<br />starts here</h2>
          <p className={`${styles.sectionSubtitle} ${styles.white}`}>
            Connect with expert guides and explore Tunisia's wilderness like never before
          </p>

          <div className={styles.ctaButtons}>
            <button className={`${styles.ctaButton} ${styles.secondary}`} onClick={handleGetStarted}>
              BROWSE ADVENTURES
            </button>
            <button className={`${styles.ctaButton} ${styles.outline}`} onClick={handleGetStarted}>
              BECOME A GUIDE
            </button>
          </div>

          <div className={styles.emailSignup}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.emailInput}
            />
            <button onClick={handleGetStarted} className={styles.emailSubmit}>
              Get Started
            </button>
          </div>
        </div>
      </section>
    </div>
    <Footer />
    </>
  );
}
