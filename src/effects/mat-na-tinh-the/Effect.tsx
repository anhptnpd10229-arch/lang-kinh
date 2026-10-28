"use client";

// Effect 1 – bản thô: vòng tinh thể neo vào ma trận biến đổi khuôn mặt của FaceLandmarker.
// Đơn vị của ma trận là cm trong không gian camera chuẩn của MediaPipe (fov dọc ~63°),
// nên Canvas dùng camera cùng fov đặt ở gốc toạ độ.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { EffectProps } from "../types";

const COUNT = { high: 18, medium: 12, low: 8 } as const;
const RING_Y = 11;
const RING_RADIUS = 9;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _o = new THREE.Object3D();

export default function Effect({ hub, quality }: EffectProps) {
  const anchor = useRef<THREE.Group>(null);
  const crystals = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const jaw = useRef(0);
  const spin = useRef(0);
  const count = COUNT[quality];

  const seeds = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ phase: (i / count) * Math.PI * 2, wobble: Math.random() * 10 })),
    [count],
  );

  useFrame((state, dt) => {
    const g = anchor.current;
    const mesh = crystals.current;
    if (!g || !mesh) return;

    const face = hub.results.face;
    const matrix = face?.facialTransformationMatrixes?.[0];
    const wasVisible = g.visible;
    g.visible = !!matrix;
    if (!matrix) return;

    // Làm mượt bằng nội suy hàm mũ (sẽ thay bằng lọc One-Euro ở tuần 4).
    // Khi mặt vừa xuất hiện thì đặt thẳng vào vị trí, tránh vòng tinh thể bay từ camera ra.
    _m.fromArray(matrix.data).decompose(_p, _q, _s);
    const k = wasVisible ? 1 - Math.exp(-dt * 18) : 1;
    g.position.lerp(_p, k);
    g.quaternion.slerp(_q, k);

    const jawOpen = face.faceBlendshapes?.[0]?.categories.find((c) => c.categoryName === "jawOpen")?.score ?? 0;
    jaw.current += (jawOpen - jaw.current) * Math.min(1, dt * 10);
    spin.current += dt * (0.6 + jaw.current * 3);

    const t = state.clock.elapsedTime;
    const radius = RING_RADIUS * (1 + jaw.current * 0.6);
    seeds.forEach(({ phase, wobble }, i) => {
      const a = phase + spin.current;
      _o.position.set(Math.cos(a) * radius, RING_Y + Math.sin(t * 2 + wobble) * 0.8, Math.sin(a) * radius);
      _o.rotation.set(t + wobble, a * 2, 0);
      _o.scale.setScalar(1.2 + jaw.current * 1.2);
      _o.updateMatrix();
      mesh.setMatrixAt(i, _o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    if (material.current) material.current.emissiveIntensity = 0.4 + jaw.current * 2.5;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 40, 10]} intensity={2} />
      <group ref={anchor} visible={false}>
        <instancedMesh ref={crystals} args={[undefined, undefined, count]} key={count}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            ref={material}
            color="#e9ffd0"
            emissive="#c8ff3d"
            emissiveIntensity={0.4}
            metalness={0.2}
            roughness={0.15}
            flatShading
          />
        </instancedMesh>
      </group>
    </>
  );
}
