// Test PBR materials: roughness, metallic, colors

const S = 0.05;
export const displayScale = S;

// Row 1: Roughness gradient (metallic=0)
const roughness_row = [];
for (let i = 0; i < 6; i++) {
  const r = i / 5;
  roughness_row.push(
    withPBR(
      scale(translate(sphere(2), [i * 6, 0, 2]), S),
      { color: [0.8, 0.2, 0.2], roughness: r, metallic: 0.0 }
    )
  );
}

// Row 2: Metallic gradient (roughness=0.3)
const metallic_row = [];
for (let i = 0; i < 6; i++) {
  const m = i / 5;
  metallic_row.push(
    withPBR(
      scale(translate(sphere(2), [i * 6, 10, 2]), S),
      { color: [0.8, 0.7, 0.2], roughness: 0.3, metallic: m }
    )
  );
}

// Row 3: Various materials
const chrome = withPBR(
  scale(translate(sphere(2), [0, 20, 2]), S),
  { color: [0.82, 0.83, 0.84], roughness: 0.1, metallic: 0.95 }
);
const gold = withPBR(
  scale(translate(sphere(2), [6, 20, 2]), S),
  { color: [0.83, 0.69, 0.22], roughness: 0.25, metallic: 0.95 }
);
const copper = withPBR(
  scale(translate(sphere(2), [12, 20, 2]), S),
  { color: [0.72, 0.45, 0.2], roughness: 0.35, metallic: 0.9 }
);
const plastic = withPBR(
  scale(translate(sphere(2), [18, 20, 2]), S),
  { color: [0.1, 0.5, 0.9], roughness: 0.5, metallic: 0.0 }
);
const rubber = withPBR(
  scale(translate(sphere(2), [24, 20, 2]), S),
  { color: [0.15, 0.15, 0.15], roughness: 0.9, metallic: 0.0 }
);

export const scene = [
  ...roughness_row,
  ...metallic_row,
  chrome, gold, copper, plastic, rubber,
];
