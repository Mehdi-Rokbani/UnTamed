import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import styles from "../../style/launch.module.css";

function seededUnit(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function hasWebGLSupport() {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext
        && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

function terrainHeight(x: number, z: number) {
  const broad = Math.sin(x * 0.18 + z * 0.09) * 2.9 + Math.cos(z * 0.2) * 2.4;
  const ridge = Math.sin((x + z) * 0.42) * 1.35 + Math.cos((x - z) * 0.34) * 1.1;
  const peaks = Math.pow(Math.max(0, Math.sin(x * 0.31) + Math.cos(z * 0.27)), 2.15) * 2.35;
  const ripple = Math.sin(x * 1.35 + z * 0.62) * 0.28 + Math.cos(z * 1.08) * 0.22;
  return broad + ridge + peaks + ripple;
}

export default function HeroTerrainBackground() {
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

  return (
    <div ref={mountRef} className={styles.heroCanvas}>
      {!webglReady ? <div className={styles.canvasFallback} aria-hidden="true" /> : null}
    </div>
  );
}
