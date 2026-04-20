// Test nesting box cutout alignment
const coop_len = 3000;
const wall_h = 2000;
const stud_sec = [48, 98];
const stud_sp = 400;
const door_w = 700;
const nest_boxes = 3;
const nest_box_w = 300;
const nest_box_d = 400;
const nest_box_h = 350;
const nest_height_off_floor = 200;
const nest_access_lip_h = 90;
const floor_stack = 314;

// Build front wall
const front_wall_frame = Wall({
  start: [0, 0],
  end: [coop_len, 0],
  height: wall_h,
  construction: "stickFrame",
  studSize: stud_sec,
  studSpacing: stud_sp,
  includeSheathing: false
});

// Nesting box cutout calculations
const nest_total_w = nest_boxes * nest_box_w + (nest_boxes + 1) * 18;
const nest_box_x = coop_len / 2 - door_w / 2 - nest_total_w - 100;
const nest_cutout_bottom_z = nest_height_off_floor + nest_access_lip_h;
const nest_cutout_height = nest_box_h - nest_access_lip_h;

const nest_access_cutout = translate(
  cube({ size: [nest_total_w, stud_sec[1] + 2, nest_cutout_height], center: false }),
  [nest_box_x, -1, nest_cutout_bottom_z]
);

// Apply cutout
const front_wall = difference(
  translate(front_wall_frame, [0, 0, floor_stack]),
  translate(nest_access_cutout, [0, 0, floor_stack])
);

// Create simplified nesting box representation
// Nesting boxes sit ON TOP of support structure at nest_height_off_floor
const nesting_box_viz = translate(
  cube({ size: [nest_total_w, nest_box_d, nest_box_h], center: false }),
  [nest_box_x, stud_sec[1], floor_stack + nest_height_off_floor]
);

const DISPLAY_SCALE = 0.01;

export const scene = [
  withColor(scale(front_wall, DISPLAY_SCALE), [0.72, 0.57, 0.38]),
  withColor(scale(nesting_box_viz, DISPLAY_SCALE), [0.85, 0.75, 0.60])  // Light wood color
];
