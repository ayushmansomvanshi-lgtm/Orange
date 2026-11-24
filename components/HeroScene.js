"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const cssVar = (n, d) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,1)");
  grad.addColorStop(0.65, "rgba(255,255,255,.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * The Orange mark in 3D: a magnifying glass holding a small website graph.
 * Packets travel along the links, the way a crawler moves through a site.
 */
export default function HeroScene() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);

    const disposables = [];
    const track = (o) => { disposables.push(o); return o; };

    // Lens: ring, glass and handle
    const ringMat = track(new THREE.MeshBasicMaterial());
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(2.3, 0.045, 14, 180)), ringMat);
    const glassMat = track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
    const glass = new THREE.Mesh(track(new THREE.CircleGeometry(2.28, 64)), glassMat);
    const handle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.14, 1.7, 20)), ringMat);
    const ang = -Math.PI / 4;
    handle.position.set(Math.cos(ang) * 3.15, Math.sin(ang) * 3.15, 0);
    handle.rotation.z = ang - Math.PI / 2;
    spin.add(ring, glass, handle);

    // Website graph inside the lens
    const ico = track(new THREE.IcosahedronGeometry(1.55, 2));
    const edgesGeo = track(new THREE.EdgesGeometry(ico, 1));
    const lineMat = track(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 }));
    const wire = new THREE.LineSegments(edgesGeo, lineMat);
    spin.add(wire);

    const uniq = new Map();
    const pos = ico.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!uniq.has(k)) uniq.set(k, [pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
    const verts = Array.from(uniq.values());
    const tex = track(dotTexture());

    const baseGeo = track(new THREE.BufferGeometry());
    baseGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts.flat(), 3));
    const baseMat = track(new THREE.PointsMaterial({ size: 0.1, map: tex, transparent: true, depthWrite: false, sizeAttenuation: true }));
    spin.add(new THREE.Points(baseGeo, baseMat));

    // A few larger "pages" that carry an audit colour
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const hubIdx = verts.map((_, i) => i).filter(() => rnd() < 0.16);
    const hubGeo = track(new THREE.BufferGeometry());
    hubGeo.setAttribute("position", new THREE.Float32BufferAttribute(hubIdx.flatMap((i) => verts[i]), 3));
    const hubKinds = hubIdx.map(() => { const r = rnd(); return r < 0.68 ? "good" : r < 0.88 ? "warn" : "error"; });
    hubGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(hubIdx.length * 3), 3));
    const hubMat = track(new THREE.PointsMaterial({ size: 0.34, map: tex, vertexColors: true, transparent: true, depthWrite: false }));
    spin.add(new THREE.Points(hubGeo, hubMat));

    // Packets moving along links
    const ep = edgesGeo.attributes.position;
    const edgeCount = ep.count / 2;
    const packets = Array.from({ length: 14 }, () => ({ e: Math.floor(rnd() * edgeCount), t: rnd(), s: 0.35 + rnd() * 0.5 }));
    const packGeo = track(new THREE.BufferGeometry());
    packGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(packets.length * 3), 3));
    const packMat = track(new THREE.PointsMaterial({ size: 0.24, map: tex, transparent: true, depthWrite: false }));
    spin.add(new THREE.Points(packGeo, packMat));

    function colours() {
      const ink = new THREE.Color(cssVar("--ink", "#24150C"));
      const brand = new THREE.Color(cssVar("--brand", "#FF6A13"));
      const strong = new THREE.Color(cssVar("--brand-strong", "#E55400"));
      const kinds = { good: new THREE.Color(cssVar("--good", "#12805C")), warn: new THREE.Color(cssVar("--warn", "#B07300")), error: new THREE.Color(cssVar("--error", "#D92D20")) };
      ringMat.color.copy(brand);
      glassMat.color.copy(brand);
      lineMat.color.copy(ink);
      baseMat.color.copy(ink);
      packMat.color.copy(strong);
      const col = hubGeo.attributes.color;
      hubKinds.forEach((k, i) => col.setXYZ(i, kinds[k].r, kinds[k].g, kinds[k].b));
      col.needsUpdate = true;
      const dark = document.documentElement.dataset.theme === "dark";
      lineMat.opacity = dark ? 0.42 : 0.3;
      glassMat.opacity = dark ? 0.14 : 0.13;
    }
    colours();
    const themeObs = new MutationObserver(colours);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    function resize() {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0 };
    const onMove = (e) => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener("pointermove", onMove);

    const a = new THREE.Vector3(), b = new THREE.Vector3();
    function updatePackets(dt) {
      const arr = packGeo.attributes.position;
      packets.forEach((p, i) => {
        p.t += dt * p.s;
        if (p.t > 1) { p.t = 0; p.e = Math.floor(Math.random() * edgeCount); }
        a.fromBufferAttribute(ep, p.e * 2);
        b.fromBufferAttribute(ep, p.e * 2 + 1);
        a.lerp(b, p.t);
        arr.setXYZ(i, a.x, a.y, a.z);
      });
      arr.needsUpdate = true;
    }

    let raf, last = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spin.rotation.y += dt * 0.28;
      tilt.rotation.x += (0.32 + pointer.y * 0.28 - tilt.rotation.x) * 0.05;
      tilt.rotation.z += (-0.12 - pointer.x * 0.1 - tilt.rotation.z) * 0.05;
      updatePackets(dt);
      renderer.render(scene, camera);
    }
    if (reduce) { tilt.rotation.x = 0.32; spin.rotation.y = 0.6; updatePackets(0.3); renderer.render(scene, camera); }
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      themeObs.disconnect();
      disposables.forEach((d) => d.dispose && d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="hero-scene" ref={hostRef} aria-hidden="true" />;
}
