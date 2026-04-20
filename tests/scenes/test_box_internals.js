// Test to understand nesting box internal structure
const nest_boxes = 3;
const nest_box_w = 300;
const nest_box_d = 400;
const nest_box_h = 350;
const wall_t = 12;
const spacing = 18;

// Calculate individual box positions (from nesting_boxes function logic)
const box_positions = [];
for (let i = 0; i < nest_boxes; i++) {
  const x_offset = spacing + i * (nest_box_w + spacing);
  box_positions.push(x_offset);
}

// box_positions: [18, 336, 654]
// Each box is 300mm wide
// So boxes occupy: [18-318], [336-636], [654-954]
// Total span: 18 to 954 = 936mm (not 972!)

// Wait, let me recalculate nest_total_w
const nest_total_w = nest_boxes * nest_box_w + (nest_boxes + 1) * spacing;
// = 3*300 + 4*18 = 900 + 72 = 972mm

// So nest_total_w goes from 0 to 972, but boxes only go from 18 to 954
// That means we have 18mm margin on each side

// The cutout width should maybe be just the box widths without outer spacing?
const cutout_width_option1 = nest_boxes * nest_box_w + (nest_boxes - 1) * spacing;
// = 3*300 + 2*18 = 900 + 36 = 936mm

// Or maybe account for box walls (each box has 12mm walls on each side)?

const DISPLAY_SCALE = 0.01;

// Visualize the boxes and cutout zones
const box1 = translate(
  cube({ size: [nest_box_w, nest_box_d, nest_box_h], center: false }),
  [18, 0, 0]
);
const box2 = translate(
  cube({ size: [nest_box_w, nest_box_d, nest_box_h], center: false }),
  [336, 0, 0]
);
const box3 = translate(
  cube({ size: [nest_box_w, nest_box_d, nest_box_h], center: false }),
  [654, 0, 0]
);

// Current cutout (full width)
const cutout_current = translate(
  cube({ size: [nest_total_w, 100, nest_box_h], center: false }),
  [0, -50, 0]
);

// Alternative cutout (just box area)
const cutout_alt = translate(
  cube({ size: [cutout_width_option1, 100, nest_box_h], center: false }),
  [spacing, -50, 0]
);

export const scene = [
  withColor(scale(union(box1, box2, box3), DISPLAY_SCALE), [0.85, 0.75, 0.60]),
  withColor(scale(cutout_current, DISPLAY_SCALE), [1.0, 0.0, 0.0]),  // Red - current
  withColor(scale(cutout_alt, DISPLAY_SCALE), [0.0, 1.0, 0.0])  // Green - alternative
];
