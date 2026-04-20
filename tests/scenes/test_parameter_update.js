// Test that parameters affect the scene output
// @param num_copies "Test" Number of Copies (1-8)
const num_copies = 2;

const S = 0.05;
export const displayScale = S;

const parts = [];
for (let i = 0; i < num_copies; i++) {
  parts.push(
    withColor(
      scale(translate(sphere(2), [i * 6, 0, 2]), S),
      [0.8, 0.3, 0.2]
    )
  );
}

export const scene = parts;
