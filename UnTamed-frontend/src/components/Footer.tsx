import { Link } from "react-router-dom";
import styles from "../style/footer.module.css";

type FooterLink = {
  label: string;
  to: string;
};

const exploreLinks: FooterLink[] = [
  { label: "Adventures", to: "/#adventures" },
  { label: "Categories", to: "/#explore" },
  { label: "Featured Experiences", to: "/#adventures" },
];

const guideLinks: FooterLink[] = [
  { label: "Become a Guide", to: "/register" },
  { label: "Create Sessions", to: "/activities/create" },
  { label: "Manage Bookings", to: "/guide/activities" },
];

const companyLinks: FooterLink[] = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/about" },
  { label: "Help", to: "/about" },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav className={styles.footerColumn} aria-label={title}>
      <h2>{title}</h2>
      {links.map((link) => (
        <Link key={`${title}-${link.label}`} to={link.to}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerCta}>
        <div>
          <span>Ready for the next route?</span>
          <h2>Find guided outdoor experiences across Tunisia.</h2>
        </div>
        <div className={styles.footerCtaActions}>
          <Link to="/home" className={styles.primaryCta}>
            Explore Adventures
          </Link>
          <Link to="/register" className={styles.secondaryCta}>
            Become a Guide
          </Link>
        </div>
      </div>

      <div className={styles.footerMain}>
        <div className={styles.brandColumn}>
          <Link to="/" className={styles.footerBrand}>
            <span>Un</span>Tamed
          </Link>
          <p>Guided outdoor experiences in Tunisia.</p>
          <div className={styles.socialLinks} aria-label="Social links">
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
              IG
            </a>
            <a href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
              FB
            </a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
              IN
            </a>
          </div>
        </div>

        <FooterColumn title="Explore" links={exploreLinks} />
        <FooterColumn title="For Guides" links={guideLinks} />
        <FooterColumn title="Company" links={companyLinks} />
      </div>

      <div className={styles.footerBottom}>
        <span>© 2026 Untamed. All rights reserved.</span>
        <nav aria-label="Legal">
          <Link to="/about">Privacy</Link>
          <Link to="/about">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
