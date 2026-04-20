// Hex Bolt - Helscoop cylinder segments example
// Coordinate convention: X=width, Y=depth, Z=height (up)

// @param head_width "Bolt" Head Width AF (8-30)
const head_width = 13;
// @param head_height "Bolt" Head Height (4-15)
const head_height = 5.5;
// @param shank_diameter "Bolt" Shank Diameter (4-20)
const shank_diameter = 8;
// @param shank_length "Bolt" Shank Length (10-80)
const shank_length = 40;
// @param thread_pitch "Bolt" Thread Pitch (1-3)
const thread_pitch = 1.25;

const S = 0.005;
export const displayScale = S;

const ZINC = [0.72, 0.73, 0.70];
const ZINC_DARK = [0.55, 0.56, 0.54];

// Hex head: cylinder with 6 segments gives a hexagonal prism
// head_width is across-flats, so radius = width / (2 * cos(30°))
const head_r = head_width / (2 * Math.cos(Math.PI / 6));
const head = cylinder({ height: head_height, radius: head_r, segments: 6 });

// Chamfer on top of hex head (cone that cuts the corners)
const chamfer = translate(
  cylinder({ height: head_height * 0.4, radius: head_r * 1.15, radiusTop: 0, segments: 32 }),
  [0, 0, head_height * 0.7]
);
const chamferedHead = difference(head, chamfer);

// Shank
const shank_r = shank_diameter / 2;
const shank = translate(
  cylinder({ height: shank_length, radius: shank_r, segments: 32 }),
  [0, 0, -shank_length]
);

// Thread grooves (helical approximation using stacked ring cuts)
const groove_depth = thread_pitch * 0.4;
const groove_r = shank_r + 0.5;
const num_grooves = Math.floor(shank_length / thread_pitch);
let threadCuts = [];
for (let i = 0; i < num_grooves; i++) {
  const z = -shank_length + i * thread_pitch + thread_pitch * 0.5;
  threadCuts.push(
    translate(
      cylinder({ height: thread_pitch * 0.3, radius: groove_r, radiusTop: shank_r - groove_depth, segments: 24 }),
      [0, 0, z]
    )
  );
}

let bolt = union(chamferedHead, shank);
if (threadCuts.length > 0) {
  bolt = difference(bolt, union(threadCuts));
}

export const scene = [
  withPBR(scale(bolt, S), { color: ZINC, metallic: 0.85, roughness: 0.3 }),
];
