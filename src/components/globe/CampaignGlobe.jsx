import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const RADIUS = 2;

function latLngToVector3(lat, lng, radius = RADIUS) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// An interactive 3D globe (three.js). Drag to rotate; tap a glowing pin to
// select that campaign. Auto-rotates when idle. Falls back gracefully if WebGL
// is unavailable. All assets are procedural except an optional earth texture
// (loaded with a graceful fallback to a styled ocean sphere).
export default function CampaignGlobe({ campaigns = [], onSelect }) {
  const containerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      setFailed(true);
      return;
    }

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 3, 5);
    scene.add(dir);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const oceanMat = new THREE.MeshPhongMaterial({ color: 0x12304a, shininess: 14, specular: 0x224466 });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 64, 64), oceanMat));

    // Optional earth texture (graceful fallback to the ocean sphere above)
    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin("anonymous");
    texLoader.load(
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
      (tex) => { oceanMat.map = tex; oceanMat.color.set(0xffffff); oceanMat.needsUpdate = true; },
      undefined,
      () => { /* keep styled ocean */ }
    );

    // Graticule
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2fd3ee, transparent: true, opacity: 0.16 });
    for (let lat = -80; lat <= 80; lat += 20) {
      const pts = [];
      for (let lng = 0; lng <= 360; lng += 6) pts.push(latLngToVector3(lat, lng, RADIUS * 1.001));
      globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    for (let lng = 0; lng < 360; lng += 20) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 6) pts.push(latLngToVector3(lat, lng, RADIUS * 1.001));
      globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }

    // Atmosphere glow
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.12, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.12, side: THREE.BackSide })
    ));

    // Pins
    const pinMeshes = [];
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 });
    (campaigns || []).forEach((c) => {
      if (typeof c.location_lat !== "number" || typeof c.location_lng !== "number") return;
      const pos = latLngToVector3(c.location_lat, c.location_lng, RADIUS * 1.01);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), pinMat);
      pin.position.copy(pos);
      pin.userData = { campaign: c };
      globeGroup.add(pin);
      pinMeshes.push(pin);
      const up = pos.clone().normalize();
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), haloMat);
      pillar.position.copy(pos.clone().add(up.clone().multiplyScalar(0.1)));
      pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      globeGroup.add(pillar);
    });

    const state = { dragging: false, lastX: 0, lastY: 0, moved: false, auto: true };
    const target = { x: 0.25, y: 0 };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onDown = (e) => {
      state.dragging = true; state.auto = false; state.moved = false;
      state.lastX = e.clientX; state.lastY = e.clientY;
    };
    const onMove = (e) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
      target.y += dx * 0.005;
      target.x = Math.max(-1.2, Math.min(1.2, target.x + dy * 0.005));
      state.lastX = e.clientX; state.lastY = e.clientY;
    };
    const onUp = (e) => {
      if (!state.dragging) return;
      state.dragging = false;
      if (!state.moved) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(pinMeshes, false);
        if (hits.length) onSelectRef.current?.(hits[0].object.userData.campaign);
      }
      setTimeout(() => { if (!state.dragging) state.auto = true; }, 2500);
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const resize = () => {
      width = container.clientWidth || 600;
      height = container.clientHeight || 420;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (state.auto) target.y += 0.0014;
      globeGroup.rotation.y += (target.y - globeGroup.rotation.y) * 0.08;
      globeGroup.rotation.x += (target.x - globeGroup.rotation.x) * 0.08;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { Array.isArray(obj.material) ? obj.material.forEach((m) => m.dispose()) : obj.material.dispose(); }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [campaigns]);

  if (failed) {
    return (
      <div className="w-full h-[60vh] min-h-[420px] flex items-center justify-center text-cyan-200/80 text-sm">
        3D globe isn't available on this device. See the list below instead.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-[60vh] min-h-[420px] cursor-grab active:cursor-grabbing touch-none" />;
}