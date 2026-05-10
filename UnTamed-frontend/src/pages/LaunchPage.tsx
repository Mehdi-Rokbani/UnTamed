import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import * as THREE from "three";
import { listPublicTemplatesPage } from "../api/activity.api";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import styles from "../style/launch.module.css";
import type { Difficulty, PublicTemplateCard } from "../types/activity";

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

// ─── seeded random (deterministic, no Math.random in render) ───────────────────
function seededUnit(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function hasWebGLSupport() {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

// ─── Hero 3-D terrain (unchanged) ─────────────────────────────────────────────
function terrainHeight(x: number, z: number) {
  const broad = Math.sin(x * 0.18 + z * 0.09) * 2.9 + Math.cos(z * 0.2) * 2.4;
  const ridge = Math.sin((x + z) * 0.42) * 1.35 + Math.cos((x - z) * 0.34) * 1.1;
  const peaks = Math.pow(Math.max(0, Math.sin(x * 0.31) + Math.cos(z * 0.27)), 2.15) * 2.35;
  const ripple = Math.sin(x * 1.35 + z * 0.62) * 0.28 + Math.cos(z * 1.08) * 0.22;
  return broad + ridge + peaks + ripple;
}

function HeroTerrainBackground() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglReady] = useState(() => hasWebGLSupport());

  useEffect(() => {
    if (!webglReady || !mountRef.current) return;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#102b1c");
    scene.fog = new THREE.Fog("#102b1c", 30, 96);
    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 180);
    camera.position.set(-5, 8.2, 24);
    camera.lookAt(4, 2.4, -16);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#102b1c", 1);
    mount.appendChild(renderer.domElement);

    const terrainGeometry = new THREE.PlaneGeometry(92, 86, 118, 118);
    terrainGeometry.rotateX(-Math.PI / 2);
    const position = terrainGeometry.attributes.position as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const depthBoost = THREE.MathUtils.clamp((z + 43) / 72, 0.42, 1.18);
      const centerLift = THREE.MathUtils.clamp(1 - Math.abs(x - 4) / 62, 0.58, 1);
      position.setY(index, terrainHeight(x, z) * depthBoost * centerLift + Math.max(0, -z - 6) * 0.045);
    }
    terrainGeometry.computeVertexNormals();
    const terrainMaterial = new THREE.MeshStandardMaterial({ color: "#2d5f3e", roughness: 0.86, metalness: 0.02, flatShading: true });
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.position.set(13, -6.2, -16);
    terrain.rotation.z = -0.12;
    scene.add(terrain);
    const wireMaterial = new THREE.MeshBasicMaterial({ color: "#ff8c42", wireframe: true, transparent: true, opacity: 0.28, depthWrite: false });
    const wireTerrain = new THREE.Mesh(terrainGeometry, wireMaterial);
    wireTerrain.position.copy(terrain.position);
    wireTerrain.rotation.copy(terrain.rotation);
    wireTerrain.scale.setScalar(1.002);
    scene.add(wireTerrain);

    const particleCount = 800;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    const color = new THREE.Color();
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (seededUnit(index, 11) - 0.5) * 72;
      particlePositions[index * 3 + 1] = seededUnit(index, 12) * 28 - 7;
      particlePositions[index * 3 + 2] = seededUnit(index, 13) * -78 + 18;
      particleSpeeds[index] = 0.014 + seededUnit(index, 14) * 0.034;
      color.set(seededUnit(index, 15) > 0.72 ? "#ff8c42" : seededUnit(index, 16) > 0.5 ? "#f4ead7" : "#8fb989");
      particleColors[index * 3] = color.r;
      particleColors[index * 3 + 1] = color.g;
      particleColors[index * 3 + 2] = color.b;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
    const particleMaterial = new THREE.PointsMaterial({ size: 0.095, transparent: true, opacity: 0.66, sizeAttenuation: true, depthWrite: false, vertexColors: true });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const ambient = new THREE.AmbientLight("#88ad87", 0.86);
    const directional = new THREE.DirectionalLight("#f4ead7", 1.45);
    directional.position.set(-12, 16, 12);
    const rim = new THREE.DirectionalLight("#7dd29a", 1.85);
    rim.position.set(14, 10, -24);
    const orbitLight = new THREE.PointLight("#ff8c42", 8.4, 58);
    scene.add(ambient, directional, rim, orbitLight);

    const sunriseGeometry = new THREE.SphereGeometry(1.2, 32, 16);
    const sunriseMaterial = new THREE.MeshBasicMaterial({ color: "#ff8c42", transparent: true, opacity: 0.5 });
    const sunrise = new THREE.Mesh(sunriseGeometry, sunriseMaterial);
    sunrise.position.set(-18, -0.4, -24);
    scene.add(sunrise);

    const mouse = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      mouse.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    let animationFrame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const positions = particleGeometry.attributes.position as THREE.BufferAttribute;
      for (let index = 0; index < particleCount; index += 1) {
        const y = positions.getY(index) + particleSpeeds[index];
        positions.setY(index, y > 18 ? -5 : y);
        positions.setX(index, positions.getX(index) + Math.sin(elapsed * 0.5 + index) * 0.0015);
      }
      positions.needsUpdate = true;
      orbitLight.position.set(Math.cos(elapsed * 0.42) * 21, 6.4 + Math.sin(elapsed * 0.34) * 3, -18 + Math.sin(elapsed * 0.42) * 17);
      sunrise.material.opacity = 0.42 + Math.sin(elapsed * 0.8) * 0.12;
      terrain.rotation.z = -0.12 + Math.sin(elapsed * 0.18) * 0.012;
      wireTerrain.rotation.z = terrain.rotation.z;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, -5 + mouse.x * 3.2, 0.035);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 8.2 - mouse.y * 1.35, 0.035);
      camera.lookAt(4 + mouse.x * 1.4, 2.2 - mouse.y * 0.45, -16);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };
    resize();
    mount.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", resize);
    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      mount.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      terrainGeometry.dispose();
      terrainMaterial.dispose();
      wireMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      sunriseGeometry.dispose();
      sunriseMaterial.dispose();
      renderer.domElement.remove();
    };
  }, [webglReady]);

  return <div ref={mountRef} className={styles.heroCanvas}>{!webglReady ? <div className={styles.canvasFallback} aria-hidden="true" /> : null}</div>;
}

// ─── Concept 3: 2-D Parallax Depth Layers — canvas background for Purpose section ──
function PurposeDepthCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const prefersReduced = useReducedMotion();

  // Pre-bake star positions (seeded, stable across renders)
  const stars = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => ({
      x: seededUnit(i, 0) * 1,        // stored as fraction 0-1, scaled on draw
      y: seededUnit(i, 1) * 0.45,
      r: seededUnit(i, 2) * 1.1 + 0.3,
      phase: seededUnit(i, 3) * Math.PI * 2,
    }));
  }, []);

  // Firefly particles
  const fireflies = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => ({
      x: seededUnit(i, 10),   // fraction
      y: 0.42 + seededUnit(i, 11) * 0.48,
      speed: 0.00012 + seededUnit(i, 12) * 0.00018,
      phase: seededUnit(i, 13) * Math.PI * 2,
      amp: 0.04 + seededUnit(i, 14) * 0.06,
      r: seededUnit(i, 15) * 1.4 + 0.8,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Layer definitions: 5 mountain silhouette layers, back → front
    // Each layer has a color, a scroll speed multiplier, opacity, and
    // a set of mountain peak x-fractions + heights (as fraction of canvas H)
    const layers = [
      {
        color: "#1a4a26",  // lightest — farthest back
        speed: 0.18,
        opacity: 1,
        peaks: [0, 0.72, 0.14, 0.52, 0.28, 0.60, 0.42, 0.45, 0.56, 0.58, 0.70, 0.54, 0.84, 0.63, 1.0, 0.72],
      },
      {
        color: "#245c30",
        speed: 0.40,
        opacity: 0.97,
        peaks: [0, 0.76, 0.10, 0.60, 0.22, 0.52, 0.36, 0.66, 0.50, 0.56, 0.64, 0.70, 0.78, 0.62, 0.92, 0.75, 1.0, 0.76],
      },
      {
        color: "#2d6b39",
        speed: 0.72,
        opacity: 0.94,
        peaks: [0, 0.80, 0.12, 0.68, 0.26, 0.60, 0.40, 0.72, 0.54, 0.64, 0.68, 0.74, 0.82, 0.68, 0.96, 0.78, 1.0, 0.80],
      },
      {
        color: "#377a42",
        speed: 1.10,
        opacity: 0.92,
        peaks: [0, 0.84, 0.16, 0.74, 0.32, 0.68, 0.48, 0.78, 0.64, 0.72, 0.80, 0.80, 1.0, 0.84],
      },
      {
        color: "#3f8a4a",  // darkest — closest, richest green
        speed: 1.60,
        opacity: 0.88,
        peaks: [0, 0.88, 0.20, 0.80, 0.40, 0.76, 0.60, 0.84, 0.80, 0.88, 1.0, 0.88],
      },
    ];

    let t = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      w = canvas.offsetWidth || 800;
      h = canvas.offsetHeight || 500;
      canvas.width = Math.round(w * Math.min(window.devicePixelRatio, 2));
      canvas.height = Math.round(h * Math.min(window.devicePixelRatio, 2));
      ctx.scale(Math.min(window.devicePixelRatio, 2), Math.min(window.devicePixelRatio, 2));
    };

    const drawLayer = (layer: typeof layers[0], offset: number) => {
      const { peaks, color, opacity } = layer;
      const wrapOffset = ((offset % w) + w) % w;    // always positive

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;

      // Draw twice side-by-side to create seamless horizontal loop
      for (let pass = 0; pass < 2; pass++) {
        const ox = wrapOffset - w * pass;
        ctx.beginPath();
        ctx.moveTo(ox + peaks[0] * w, h);

        for (let i = 0; i < peaks.length - 2; i += 2) {
          const x0 = ox + peaks[i] * w;
          const y0 = peaks[i + 1] * h;
          const x1 = ox + peaks[i + 2] * w;
          const y1 = peaks[i + 3] * h;
          const mx = (x0 + x1) / 2;
          const my = (y0 + y1) / 2;
          // Gentle sine sway on the peak heights for organic life
          const sway = Math.sin(t * 0.4 + i * 0.7 + pass) * (h * 0.008);
          ctx.quadraticCurveTo(x0, y0 + sway, mx, my);
        }

        const lastPeakX = ox + peaks[peaks.length - 2] * w;
        ctx.lineTo(lastPeakX, h);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#020805");
      sky.addColorStop(0.5, "#050e07");
      sky.addColorStop(1, "#080f09");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Subtle moon glow top-right
      const moonX = w * 0.82;
      const moonY = h * 0.18;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, h * 0.22);
      moonGlow.addColorStop(0, `rgba(255,200,100,${0.055 + Math.sin(t * 0.3) * 0.015})`);
      moonGlow.addColorStop(1, "rgba(255,200,100,0)");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, w, h);

      // Stars
      stars.forEach((s) => {
        const flicker = prefersReduced ? 0.55 : 0.3 + Math.sin(t * 1.2 + s.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,248,230,${flicker})`;
        ctx.fill();
      });

      // Parallax mountain layers
      layers.forEach((layer) => {
        const offset = prefersReduced ? 0 : -((t * layer.speed * 18) % w);
        drawLayer(layer, offset);
      });

      // Orange campfire glow at bottom-centre
      const fireX = w * 0.5;
      const fireY = h * 0.96;
      const fireGlow = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, w * 0.28);
      const pulseIntensity = prefersReduced ? 0.18 : 0.14 + Math.sin(t * 2.2) * 0.05;
      fireGlow.addColorStop(0, `rgba(255,140,66,${pulseIntensity})`);
      fireGlow.addColorStop(0.5, `rgba(255,100,30,${pulseIntensity * 0.4})`);
      fireGlow.addColorStop(1, "rgba(255,140,66,0)");
      ctx.fillStyle = fireGlow;
      ctx.fillRect(0, 0, w, h);

      // Firefly particles
      if (!prefersReduced) {
        fireflies.forEach((ff) => {
          ff.x = (ff.x + ff.speed) % 1;
          const px = ff.x * w;
          const py = ff.y * h + Math.sin(t * 1.1 + ff.phase) * ff.amp * h;
          const alpha = 0.35 + Math.sin(t * 1.8 + ff.phase) * 0.3;
          ctx.beginPath();
          ctx.arc(px, py, ff.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,200,80,${Math.max(0, alpha)})`;
          ctx.fill();
        });
      }

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [stars, fireflies, prefersReduced]);

  return <canvas ref={canvasRef} className={styles.purposeDepthCanvas} aria-hidden="true" />;
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
          <HeroTerrainBackground />
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
            <PurposeDepthCanvas />
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
