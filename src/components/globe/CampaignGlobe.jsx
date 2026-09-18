import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const RADIUS = 2;
const MAX_PIXEL_RATIO = 2;
const MOBILE_BREAKPOINT = 640;

function latLngToVector3(lat, lng, radius = RADIUS) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

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
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      return;
    }

    let width = Math.max(1, container.clientWidth);
    let height = Math.max(1, container.clientHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const setCameraDistance = () => camera.position.set(0, 0, width < MOBILE_BREAKPOINT ? 7 : 6);
    setCameraDistance();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 3, 5);
    scene.add(dir);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    const oceanMat = new THREE.MeshPhongMaterial({ color: 0x12304a, shininess: 14, specular: 0x224466 });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 64, 64), oceanMat));

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

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.12, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.12, side: THREE.BackSide })
    ));

    const pinMeshes = [];
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 });
    campaigns.forEach((c) => {
      if (!Number.isFinite(c?.location_lat) || !Number.isFinite(c?.location_lng)) return;
      const pos = latLngToVector3(c.location_lat, c.location_lng, RADIUS * 1.01);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), pinMat);
      pin.position.copy(pos);
      pin.userData = { campaign: c };
      globeGroup.add(pin);
      pinMeshes.push(pin);
      const up = pos.clone().normalize();
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 8), haloMat);
      pillar.position.copy(pos.clone().add(up.clone().multiplyScalar(0.1)));
      pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      globeGroup.add(pillar);
    });

    const state = { dragging: false, pointerId: null, lastX: 0, lastY: 0, moved: false, auto: true };
    const target = { x: 0.25, y: 0 };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const resumeTimers = new Set();

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      state.dragging = true;
      state.pointerId = e.pointerId;
      state.auto = false;
      state.moved = false;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      if (!state.dragging || e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
      target.y += dx * 0.005;
      target.x = Math.max(-1.2, Math.min(1.2, target.x + dy * 0.005));
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    };
    const finishPointer = (e, allowSelect) => {
      if (!state.dragging || e.pointerId !== state.pointerId) return;
      const wasMoved = state.moved;
      state.dragging = false;
      state.pointerId = null;
      renderer.domElement.releasePointerCapture?.(e.pointerId);
      if (allowSelect && !wasMoved) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects(pinMeshes, false);
          if (hits.length) onSelectRef.current?.(hits[0].object.userData.campaign);
        }
      }
      const timer = window.setTimeout(() => {
        resumeTimers.delete(timer);
        if (!state.dragging) state.auto = true;
      }, 2500);
      resumeTimers.add(timer);
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", (e) => finishPointer(e, true));
    renderer.domElement.addEventListener("pointercancel", (e) => finishPointer(e, false));

    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      setCameraDistance();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.setSize(width, height, false);
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
      resumeTimers.forEach((timer) => window.clearTimeout(timer));
      ro.disconnect();
      renderer.domElement.replaceWith(renderer.domElement.cloneNode(false));
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) Array.isArray(obj.material) ? obj.material.forEach((m) => m.dispose()) : obj.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [campaigns]);

  if (failed) {
    return <div className="w-full h-[clamp(280px,52dvh,560px)] flex items-center justify-center px-4 text-center text-cyan-200/80 text-sm">3D globe isn't available on this device. See the campaign list below instead.</div>;
  }

  return <div ref={containerRef} className="w-full max-w-full h-[clamp(280px,52dvh,560px)] overflow-hidden cursor-grab active:cursor-grabbing" aria-label="Interactive campaign globe" />;
}
