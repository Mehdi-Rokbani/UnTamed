import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import trailGuideAnimation from "../../assets/assistant/trail-guide-lottie.json";
import styles from "../../style/chat-assistant-widget.module.css";

type AssistantLottieMascotProps = {
  size?: number;
  active?: boolean;
  className?: string;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export default function AssistantLottieMascot({ size = 76, active = false, className = "" }: AssistantLottieMascotProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <span
        className={`${styles.lottieMascot} ${styles.lottieMascotReduced} ${active ? styles.lottieMascotActive : ""} ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span className={styles.lottieFallbackIcon} />
      </span>
    );
  }

  return (
    <span
      className={`${styles.lottieMascot} ${active ? styles.lottieMascotActive : ""} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Lottie
        animationData={trailGuideAnimation}
        loop
        autoplay
        className={styles.lottieInner}
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      />
    </span>
  );
}
