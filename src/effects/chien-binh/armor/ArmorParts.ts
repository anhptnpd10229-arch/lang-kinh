// Các mảnh giáp dựng hoàn toàn bằng code. Kích thước tính theo đơn vị "độ rộng vai = 1"
// (mũ giáp: "khoảng cách hai tai = 1"); ArmorScene co giãn theo người thật trên hình.
// Phong cách: kim loại trắng ngọc, viền lavender, lõi và kính phát sáng xanh mint.
import * as THREE from "three";

export type ArmorMaterials = {
  pearl: THREE.MeshStandardMaterial;
  lav: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
};

export function createMaterials(): ArmorMaterials {
  return {
    pearl: new THREE.MeshStandardMaterial({ color: "#f3f1ff", metalness: 0.65, roughness: 0.26, envMapIntensity: 1.3 }),
    lav: new THREE.MeshStandardMaterial({ color: "#8a72f0", metalness: 0.75, roughness: 0.3, envMapIntensity: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2b2738", metalness: 0.6, roughness: 0.45 }),
    glow: new THREE.MeshBasicMaterial({ color: "#8ff7e4", toneMapped: false }),
  };
}

/** Giáp ngực: gốc toạ độ ở giữa hai vai, tấm giáp kéo xuống ngực; lõi phát sáng ở giữa. */
export function chestPlate(m: ArmorMaterials) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [-0.52, 0.12], [-0.2, 0.2], [-0.11, 0.06], [0.11, 0.06], [0.2, 0.2], [0.52, 0.12],
    [0.44, -0.36], [0.16, -0.66], [-0.16, -0.66], [-0.44, -0.36],
  ];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 3, curveSegments: 4 }),
    m.pearl,
  );
  g.add(plate);
  const front = 0.16;
  // Hai đường viền chữ V màu lavender.
  for (const side of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.03), m.lav);
    trim.position.set(side * 0.24, -0.2, front);
    trim.rotation.z = side * -0.62;
    g.add(trim);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 10, 40), m.lav);
  ring.position.set(0, -0.3, front);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.105, 32), m.glow);
  core.position.set(0, -0.3, front + 0.005);
  core.name = "core";
  g.add(ring, core);
  return g;
}

/** Giáp vai: vòm nửa cầu, trục +y hướng ra xa khuỷu tay. */
export function shoulderPad(m: ArmorMaterials) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m.lav);
  dome.scale.set(1, 0.72, 0.9);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.022, 8, 40), m.glow);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 0.9, 1);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.07, 28), m.pearl);
  plate.position.y = -0.02;
  g.add(plate, dome, rim);
  return g;
}

export type Gauntlet = { group: THREE.Group; body: THREE.Mesh; bandA: THREE.Mesh; bandB: THREE.Mesh; glow: THREE.Mesh };

/** Giáp tay: ống dọc theo cẳng tay, trục +y hướng về cổ tay; vòng phát sáng ở cổ tay. */
export function gauntlet(m: ArmorMaterials): Gauntlet {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.14, 1, 24), m.pearl);
  const band = () => new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 32), m.lav);
  const bandA = band();
  const bandB = band();
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 32), m.glow);
  for (const r of [bandA, bandB, glow]) r.rotation.x = Math.PI / 2;
  group.add(body, bandA, bandB, glow);
  return { group, body, bandA, bandB, glow };
}

/** Mũ giáp: vòm, kính phát sáng ngang mắt, tấm che miệng, hai má giáp và mào lavender. */
export function helmet(m: ArmorMaterials) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 40, 24), m.pearl);
  dome.scale.set(1, 1.1, 1);
  dome.position.y = 0.06;
  // CylinderGeometry: theta = 0 nằm ở +z, nên đoạn cung đối xứng quanh 0 là mặt trước.
  const arc = (r: number, h: number, span: number, mat: THREE.Material) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, 1, true, -span / 2, span), mat);
  const visorFrame = arc(0.645, 0.24, 2.6, m.dark);
  visorFrame.position.y = 0.02;
  const visor = arc(0.66, 0.11, 2.3, m.glow);
  visor.position.y = 0.02;
  visor.name = "visor";
  const mouth = arc(0.63, 0.3, 2.0, m.pearl);
  mouth.position.y = -0.3;
  mouth.scale.set(0.92, 1, 0.98);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.75), m.lav);
  crest.position.set(0, 0.68, -0.05);
  g.add(dome, visorFrame, visor, mouth, crest);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.36), m.lav);
    cheek.position.set(side * 0.56, -0.18, 0.12);
    cheek.rotation.y = side * 0.35;
    g.add(cheek);
  }
  return g;
}

/** Chấm sáng mềm dùng cho hạt (vẽ một lần bằng canvas). */
export function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
