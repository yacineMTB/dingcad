// Test front wall with cutouts
const coop_len = 3000;
const wall_h = 2000;
const stud_sec = [48, 98];
const stud_sp = 400;
const door_w = 700;
const door_h = 1700;
const nest_boxes = 3;
const nest_box_w = 300;
const nest_box_d = 400;
const nest_box_h = 350;
const nest_height_off_floor = 200;
const nest_access_lip_h = 90;
const floor_stack = 314;  // paver + skid + joist + floor = 50 + 148 + 98 + 18

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

// Door cutout
const door_cutout = translate(
  cube({ size: [door_w, stud_sec[1] + 2, door_h], center: false }),
  [coop_len / 2 - door_w / 2, -1, stud_sec[0]]
);

// Nesting box access cutout
const nest_total_w = nest_boxes * nest_box_w + (nest_boxes + 1) * 18;
const nest_box_x = coop_len / 2 - door_w / 2 - nest_total_w - 100;
const nest_cutout_bottom_z = nest_height_off_floor + nest_access_lip_h;
const nest_cutout_height = nest_box_h - nest_access_lip_h;

// nest_total_w = 3*300 + 4*18 = 972
// nest_box_x = 1500 - 350 - 972 - 100 = 78
// nest_cutout_bottom_z = 200 + 90 = 290
// nest_cutout_height = 350 - 90 = 260

const nest_access_cutout = translate(
  cube({ size: [nest_total_w, stud_sec[1] + 2, nest_cutout_height], center: false }),
  [nest_box_x, -1, nest_cutout_bottom_z]
);

// Apply cutouts
const front_wall = difference(
  translate(front_wall_frame, [0, 0, floor_stack]),
  translate(door_cutout, [0, 0, floor_stack]),
  translate(nest_access_cutout, [0, 0, floor_stack])
);

const DISPLAY_SCALE = 0.01;

export const scene = [
  withColor(scale(front_wall, DISPLAY_SCALE), [0.72, 0.57, 0.38])
];
