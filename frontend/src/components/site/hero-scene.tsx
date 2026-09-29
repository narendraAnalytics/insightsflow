"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
} from "@react-three/drei";
import { Color, type Group, type InstancedMesh, type Mesh, Object3D } from "three";

/*
 * Hero 3D: "sheet → numbers → AI".
 * A floating glass spreadsheet with a cell grid; slim data bars rise out of its
 * cells (the magenta one is the computed answer); particles stream from the bar
 * tops into a glowing AI orb, with the destination apps (Notion, Slack) as small
 * tiles orbiting it. Loaded client-only via next/dynamic from hero-section.tsx.
 * three.js can't read CSS custom properties, so brand colors are mirrored as hex.
 */

const COLS = 6;
const ROWS = 4;
const CELL = 0.82;
const ANSWER = { c: 3, r: 1 };
const ORB_Y = 2.75;
const HEX = {
  magenta: "#e0368a",
  pink: "#f7a8c8",
  coral: "#f7785c",
  amber: "#ffb547",
  mint: "#72dcc0",
  cream: "#fff4ea",
};

type Bar = { x: number; z: number; h: number; phase: number; color: string; answer: boolean };

function useBars(): Bar[] {
  return useMemo(() => {
    const out: Bar[] = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const answer = c === ANSWER.c && r === ANSWER.r;
        // deterministic pseudo-random, so every visit looks the same
        const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
        const rand = s - Math.floor(s);
        const h = answer ? 2.05 : 0.25 + rand * 1.05;
        const color = answer ? HEX.magenta : h > 1.05 ? HEX.amber : h > 0.7 ? HEX.coral : h > 0.45 ? HEX.pink : HEX.mint;
        out.push({
          x: (c - (COLS - 1) / 2) * CELL,
          z: (r - (ROWS - 1) / 2) * CELL,
          h,
          phase: c * 0.8 + r * 0.55,
          color,
          answer,
        });
      }
    }
    return out;
  }, []);
}

function Bars({ bars, animate }: { bars: Bar[]; animate: boolean }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const start = useRef<number | null>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (start.current === null) start.current = t;
    const since = t - start.current;
    bars.forEach((bar, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      // grow in on load (staggered), then breathe gently
      const grow = animate ? Math.min(1, Math.max(0, (since - 0.3 - i * 0.035) / 0.9)) : 1;
      const eased = 1 - Math.pow(1 - grow, 3);
      const wave = animate && !bar.answer ? Math.sin(t * 0.9 + bar.phase) * 0.12 : 0;
      const h = Math.max(0.05, (bar.h + wave) * eased);
      mesh.scale.y = h;
      mesh.position.y = 0.13 + h / 2;
    });
  });

  return (
    <>
      {bars.map((bar, i) => (
        <RoundedBox
          key={i}
          ref={(m: Mesh | null) => {
            refs.current[i] = m;
          }}
          args={[0.34, 1, 0.34]}
          radius={0.06}
          smoothness={4}
          position={[bar.x, 0.13, bar.z]}
          scale={[1, animate ? 0.05 : bar.h, 1]}
        >
          <meshPhysicalMaterial
            color={bar.color}
            roughness={0.22}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.08}
            emissive={bar.answer ? HEX.magenta : bar.color}
            emissiveIntensity={bar.answer ? 0.55 : 0.08}
          />
        </RoundedBox>
      ))}
    </>
  );
}

/** Particles flowing from bar tops up into the orb. */
function DataStream({ bars, animate }: { bars: Bar[]; animate: boolean }) {
  const COUNT = 46;
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        // favour taller bars (and the answer) as sources
        const tall = bars.filter((b) => b.h > 0.8 || b.answer);
        const src = tall[i % tall.length];
        return { src, offset: i / COUNT, speed: 0.22 + ((i * 37) % 10) / 55, swirl: ((i * 53) % 10) / 10 };
      }),
    [bars]
  );
  const colors = useMemo(() => {
    const palette = [HEX.magenta, HEX.amber, HEX.coral, HEX.pink];
    return seeds.map((_, i) => new Color(palette[i % palette.length]));
  }, [seeds]);

  useEffect(() => {
    colors.forEach((c, i) => mesh.current?.setColorAt(i, c));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [colors]);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((s, i) => {
      const p = animate ? (t * s.speed + s.offset) % 1 : s.offset;
      const sx = s.src.x;
      const sy = 0.13 + s.src.h;
      const sz = s.src.z;
      // bezier-ish arc: rise, then curl into the orb
      const e = p * p * (3 - 2 * p);
      const swirl = Math.sin(p * Math.PI) * (0.6 + s.swirl * 0.5);
      const angle = p * 5 + s.swirl * 6;
      dummy.position.set(
        sx * (1 - e) + Math.cos(angle) * swirl * 0.35,
        sy + (ORB_Y - sy) * e,
        sz * (1 - e) + Math.sin(angle) * swirl * 0.35
      );
      const scale = Math.sin(p * Math.PI) * 0.07 + 0.012;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** The AI: an iridescent orb with an inner glow, a tilted ring and orbiting app tiles. */
function Orb({ animate }: { animate: boolean }) {
  const ring = useRef<Group>(null);
  const tiles = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!animate) return;
    if (ring.current) ring.current.rotation.z += delta * 0.5;
    if (tiles.current) tiles.current.rotation.y += delta * 0.45;
  });

  return (
    <group position={[0, ORB_Y, 0]}>
      <mesh>
        <sphereGeometry args={[0.5, 64, 64]} />
        <meshPhysicalMaterial
          color="#ffd1e4"
          roughness={0.08}
          metalness={0.1}
          clearcoat={1}
          iridescence={1}
          iridescenceIOR={1.6}
          iridescenceThicknessRange={[180, 620]}
          emissive={HEX.magenta}
          emissiveIntensity={0.45}
        />
      </mesh>
      {/* soft halo */}
      <mesh scale={1.55}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color={HEX.pink} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <group ref={ring} rotation={[Math.PI / 2.4, 0.3, 0]}>
        <mesh>
          <torusGeometry args={[0.85, 0.022, 16, 120]} />
          <meshPhysicalMaterial color={HEX.amber} emissive={HEX.amber} emissiveIntensity={0.6} roughness={0.2} />
        </mesh>
      </group>
      {/* orbiting destination tiles: Notion (cream) and Slack (coral) */}
      <group ref={tiles}>
        {[
          { a: 0, color: HEX.cream },
          { a: Math.PI, color: HEX.coral },
          { a: Math.PI / 2, color: HEX.mint },
        ].map((tile, i) => (
          <RoundedBox
            key={i}
            args={[0.34, 0.34, 0.08]}
            radius={0.07}
            position={[Math.cos(tile.a) * 1.25, Math.sin(tile.a * 2) * 0.12, Math.sin(tile.a) * 1.25]}
          >
            <meshPhysicalMaterial color={tile.color} roughness={0.25} clearcoat={1} />
          </RoundedBox>
        ))}
      </group>
    </group>
  );
}

function Scene({ animate }: { animate: boolean }) {
  const group = useRef<Group>(null);
  const bars = useBars();

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const targetY = animate ? -0.42 + Math.sin(t * 0.18) * 0.12 + state.pointer.x * 0.22 : -0.42;
    const targetX = animate ? 0.05 - state.pointer.y * 0.06 : 0.05;
    const k = Math.min(1, delta * 2.2);
    group.current.rotation.y += (targetY - group.current.rotation.y) * k;
    group.current.rotation.x += (targetX - group.current.rotation.x) * k;
  });

  return (
    <group ref={group} rotation={[0.05, -0.42, 0]}>
      <Float speed={animate ? 1.2 : 0} rotationIntensity={0.08} floatIntensity={0.35} floatingRange={[-0.06, 0.08]}>
        {/* glass spreadsheet */}
        <RoundedBox args={[COLS * CELL + 0.55, 0.2, ROWS * CELL + 0.55]} radius={0.1} smoothness={4}>
          <MeshTransmissionMaterial
            color="#fff0f5"
            thickness={0.55}
            roughness={0.12}
            transmission={1}
            ior={1.35}
            chromaticAberration={0.05}
            anisotropy={0.15}
            distortion={0.08}
            distortionScale={0.3}
            temporalDistortion={0}
            samples={6}
            resolution={512}
            backside={false}
          />
        </RoundedBox>
        {/* cells */}
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = Math.floor(i / ROWS);
          const r = i % ROWS;
          return (
            <mesh
              key={i}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[(c - (COLS - 1) / 2) * CELL, 0.102, (r - (ROWS - 1) / 2) * CELL]}
            >
              <planeGeometry args={[CELL - 0.08, CELL - 0.08]} />
              <meshBasicMaterial color={c === ANSWER.c && r === ANSWER.r ? HEX.pink : HEX.cream} transparent opacity={0.55} />
            </mesh>
          );
        })}
        <Bars bars={bars} animate={animate} />
        <DataStream bars={bars} animate={animate} />
        <Orb animate={animate} />
      </Float>
    </group>
  );
}

export default function HeroScene({ reduced }: { reduced: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  // Stop rendering entirely while the hero is scrolled away.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 transition-opacity duration-1000"
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, 1.75]}
        frameloop={reduced ? "demand" : visible ? "always" : "never"}
        camera={{ position: [0, 3.6, 9.6], fov: 32 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.2, 0);
          setReady(true);
        }}
      >
        <ambientLight intensity={0.5} color="#fff1e6" />
        <directionalLight position={[4, 8, 5]} intensity={1.6} color="#fff3e8" />
        <pointLight position={[-4, 3, 2]} intensity={25} color="#ff6fa8" />
        <pointLight position={[4, 1.5, 3]} intensity={18} color="#ffb547" />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2.2} color="#fff1e6" position={[0, 6, -4]} scale={[12, 4, 1]} />
          <Lightformer form="rect" intensity={1.6} color="#ff8fc0" position={[-6, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#ffc56b" position={[6, 2, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} />
          <Lightformer form="circle" intensity={1.2} color="#9ff0da" position={[0, -3, 4]} scale={4} />
        </Environment>
        <Scene animate={!reduced} />
        <ContactShadows position={[0, -0.55, 0]} opacity={0.35} scale={9} blur={2.6} far={3} color="#c2306f" />
      </Canvas>
    </div>
  );
}
