// coop.js
// Parametric Nordic Chicken Coop - Ported to Helscoop/Manifold
// Units: millimeters

// ============================================================================
// PARAMETERS - Main Configuration
// ============================================================================

// Coop dimensions
// @param coop_len "Coop Dimensions" Coop Length (1500-6000)
const coop_len = 1526;           // Coop length (X direction)
// @param coop_w "Coop Dimensions" Coop Width (1500-6000)
const coop_w = 4841;             // Coop width (Y direction)
// @param wall_h "Coop Dimensions" Wall Height (1500-3000)
const wall_h = 2630;             // Wall height (Z direction)

// Structural members
const joist_sec = [48, 98];      // Joist cross-section [thickness, height]
const stud_sec = [48, 98];       // Stud cross-section [thickness, width]
const joist_sp = 400;            // Joist spacing
const stud_sp = 400;             // Stud spacing
const floor_th = 18;             // Floor sheet thickness

// Roof
// @param roof_pitch_deg "Roof" Roof Pitch (15-45)
const roof_pitch_deg = 28;       // Roof pitch in degrees
// @param overhang "Roof" Overhang (50-400)
const overhang = 117;            // Roof overhang on all sides

// Base
const paver_size = [200, 200, 50]; // Paver dimensions [width, depth, height]
const max_paver_spacing = 1200;    // Maximum spacing between pavers
const skid_sec = [148, 148];       // Skid cross-section [thickness, height]
const skirting_t = 12;             // Skirting panel thickness

// Doors
// @param door_w "Doors" Door Width (500-1000)
const door_w = 588;              // Human door width - Finnish standard 9M
// @param door_h "Doors" Door Height (1200-2200)
const door_h = 2100;             // Human door height - Finnish standard 21M
// @param pop_w "Doors" Pop Door Width (150-400)
const pop_w = 195;               // Pop door width
// @param pop_opening_h "Doors" Pop Opening Height (200-500)
const pop_opening_h = 200;       // Pop door opening height
const pop_ramp_angle = 30;       // Ramp angle in degrees

// Calculate pop door height
const pop_door_height_from_ground = paver_size[2] + skid_sec[1] + joist_sec[1] + floor_th + 200;
const pop_h = pop_door_height_from_ground / Math.sin(pop_ramp_angle * Math.PI / 180);

// Vents
const vent_w = Math.max(300, Math.sqrt(coop_len * coop_w * 0.005));
const vent_h = Math.max(150, Math.sqrt(coop_len * coop_w * 0.005));
const front_vent_enabled = false;
const vent_top_clearance = 20;
const front_vent_clearance_over_door = 20;

// Nesting boxes
// @param nest_boxes "Nesting Boxes" Number of Boxes (1-6)
const nest_boxes = 6;
// @param nest_box_w "Nesting Boxes" Box Width (200-500)
const nest_box_w = 305;
// @param nest_box_d "Nesting Boxes" Box Depth (300-600)
const nest_box_d = 400;
// @param nest_box_h "Nesting Boxes" Box Height (250-500)
const nest_box_h = 350;
// @param nest_height_off_floor "Nesting Boxes" Height Off Floor (100-600)
const nest_height_off_floor = 200;  // Lowered from 400mm to 200mm
const nest_access_lip_h = 90;

// Calculated values
const floor_stack = paver_size[2] + skid_sec[1] + joist_sec[1] + floor_th;

// Scale factor for viewing (1/100 = cm instead of mm for easier viewing)
const DISPLAY_SCALE = 0.003;  // Smaller to see whole scene

// ============================================================================
// VISIBILITY TOGGLES - Show/hide components to see inside
// ============================================================================
// @param show_cladding "Visibility" Show exterior cladding (0-1)
const show_cladding = 1;       // 1=show, 0=hide exterior cladding
// @param show_roof "Visibility" Show roof (0-1)
const show_roof = 1;           // 1=show, 0=hide roof
// @param show_walls "Visibility" Show wall framing (0-1)
const show_walls = 1;          // 1=show, 0=hide wall framing
// @param show_floor "Visibility" Show floor and foundation (0-1)
const show_floor = 1;          // 1=show, 0=hide floor
// @param show_insulation "Visibility" Show insulation (0-1)
const show_insulation = 1;     // 1=show, 0=hide insulation
// @param show_run "Visibility" Show chicken run (0-1)
const show_run = 1;            // 1=show, 0=hide run
// @param show_tunnel "Visibility" Show viewing tunnel (0-1)
const show_tunnel = 1;         // 1=show, 0=hide tunnel
// @param show_interior "Visibility" Show interior (roosts, nests) (0-1)
const show_interior = 1;       // 1=show, 0=hide interior
// @param show_chickens "Visibility" Show chickens (0-1)
const show_chickens = 1;       // 1=show, 0=hide chickens

// ============================================================================
// EXTERIOR COLORS - Classic Finnish wooden house colors
// ============================================================================
// 0=Yellow (Keltamulta), 1=Falu Red (Punamulta), 2=Gray, 3=Blue, 4=Green, 5=White
// @param cladding_color "Exterior" Cladding Color (0-5)
const cladding_color = 1;

// Finnish exterior color palette
const FINNISH_COLORS = [
  [0.85, 0.78, 0.45],   // 0: Yellow ochre (Keltamulta) - golden yellow
  [0.55, 0.18, 0.12],   // 1: Falu red (Punamulta) - classic Swedish/Finnish red
  [0.45, 0.47, 0.50],   // 2: Gray - traditional gray
  [0.35, 0.45, 0.58],   // 3: Blue - muted dusty blue
  [0.28, 0.42, 0.32],   // 4: Green - forest green
  [0.92, 0.90, 0.85],   // 5: White/cream
];
const CLADDING_RGB = FINNISH_COLORS[Math.floor(cladding_color) % FINNISH_COLORS.length];

// ============================================================================
// DOOR ANGLES - Simulate doors open/closed (degrees)
// ============================================================================
// @param human_door_angle "Doors" Human door swing angle (0-120)
const human_door_angle = 80;    // 0=closed, 90=fully open
// @param nest_lid_angle "Doors" Nest box lid angle (0-90)
const nest_lid_angle = 24;     // 0=closed, 90=fully open
// @param tunnel_door_angle "Doors" Tunnel access door angle (0-90)
const tunnel_door_angle = 58;  // 0=closed, 90=fully open
// @param run_gate_angle "Doors" Run gate swing angle (0-120)
const run_gate_angle = 44;      // 0=closed, 90=open

// ============================================================================
// ELECTRICITY & HEATING COSTS (Finland 2024)
// ============================================================================
// @param electricity_price "Energy" Electricity price c/kWh (5-50)
const electricity_price = 12;  // Finnish spot price ~8-15 c/kWh average
// @param heater_power "Energy" Heater power in watts (100-2000)
const heater_power = 250;      // Chicken heat plate ~250W
// @param chicken_body_heat "Energy" Heat per chicken in watts (5-15)
const chicken_body_heat = 10;  // ~10W per chicken body heat
// @param num_chickens_for_heat "Energy" Number of chickens (0-20)
const num_chickens_for_heat = 6; // 6 chickens = 60W body heat

// Calculate total heat input and monthly cost
const total_heat_input_W = heater_power + (chicken_body_heat * num_chickens_for_heat);
const monthly_kwh = (heater_power / 1000) * 24 * 30;  // kWh per month (heater only)
const monthly_cost_eur = (monthly_kwh * electricity_price) / 100;  // € per month

// Export heating info for thermal panel

// ============================================================================
// MATERIALS & PRICING - Bill of Materials for cost estimation
// Finnish lumber dimensions and prices (from Sarokas, K-Rauta)
// Quantities are calculated dynamically based on coop parameters
// ============================================================================

// Calculate material quantities based on coop dimensions
const wall_perimeter = 2 * (coop_len + coop_w);  // mm
const wall_studs = Math.ceil(wall_perimeter / stud_sp) + 4;  // 4 corners
const floor_joists = Math.ceil(coop_len / joist_sp) + 1;
const floor_area_sqm = (coop_len * coop_w) / 1000000;
const wall_area_sqm = (wall_perimeter * wall_h) / 1000000;
const roof_pitch_rad = roof_pitch_deg * Math.PI / 180;
const roof_run = coop_w / 2;
const roof_slope_len = roof_run / Math.cos(roof_pitch_rad);
const roof_area_sqm = (coop_len + 2 * overhang) * (roof_slope_len + overhang) * 2 / 1000000;
const rafter_count = Math.ceil(coop_len / joist_sp) + 1;

// Finnish lumber lengths: calculate total running meters (jm) needed
const stud_length_m = wall_h / 1000;  // Studs are wall height
const plate_length_jm = (wall_perimeter * 2) / 1000;  // Top + bottom plates
const joist_length_m = coop_w / 1000;  // Joists span the width
const rafter_length_m = (roof_slope_len + overhang) / 1000;  // Rafter length

// Total running meters for each lumber type
const studs_jm = wall_studs * stud_length_m;
const joists_jm = floor_joists * joist_length_m;
const rafters_jm = rafter_count * 2 * rafter_length_m;

// Sheet counts (Finnish standard: 2440x1200mm = ~2.93 sqm each)
const floor_sheets = Math.ceil(floor_area_sqm / 2.93);
const wall_sheets = Math.ceil(wall_area_sqm / 2.93);
const roof_sheets = Math.ceil(roof_area_sqm / 2.93);

// Roofing felt rolls (~15 sqm per roll)
const felt_rolls = Math.ceil(roof_area_sqm / 15);

// Paint coverage (~10 sqm/liter, 2 coats)
const total_paint_area = wall_area_sqm + roof_area_sqm * 0.3;
const paint_liters = Math.ceil(total_paint_area / 5);


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Calculate paver offsets
function calc_paver_offsets(len, max_spacing = 1200) {
  const num_spans = Math.max(1, Math.floor(len / max_spacing));
  const num_pavers = num_spans + 1;
  const spacing = len / num_spans;
  const offsets = [];
  for (let i = 0; i < num_pavers; i++) {
    offsets.push(i * spacing);
  }
  return offsets;
}

// ============================================================================
// CLADDING SYSTEM - Horizontal lap siding with trim
// ============================================================================

// Cladding colors
const CLADDING_MAIN = [0.93, 0.78, 0.18];  // Golden yellow siding
const CLADDING_TRIM = [1, 1, 1];            // White trim

// Horizontal cladding for walls running along X axis (front/back walls)
// Solid backing panel with thin board faces creating shadow lines
// facing: -1 for front wall (faces -Y), +1 for back wall (faces +Y)
function horizontal_cladding_x(len, height, base_pos, cutouts = [], margin = 25, thickness = 18, trim_w = 45, facing = -1) {
  const panel_x = base_pos[0] - margin;
  const panel_y = base_pos[1];
  const panel_z = base_pos[2];
  const panel_len = len + 2 * margin;

  // Backing panel (wall sheathing) - solid, no gaps
  const backing_thickness = 12;
  let backing = translate(
    cube({ size: [panel_len, backing_thickness, height], center: false }),
    [panel_x, panel_y, panel_z]
  );

  // Apply cutouts to backing
  for (const cutout of cutouts) {
    const cutout_pos = cutout[0];
    const cutout_size = cutout[1];
    const cutout_box = translate(
      cube({ size: cutout_size, center: false }),
      cutout_pos
    );
    backing = difference(backing, cutout_box);
  }

  // Board dimensions - thin faces mounted on backing
  const board_height = 145;     // Visible board height
  const board_thickness = 12;   // Thicker boards for better MSAA edge coverage, no volume gradient
  const shadow_gap = 8;         // Gap between boards
  // Board position depends on facing direction
  const board_y = facing < 0 ? panel_y - board_thickness : panel_y + backing_thickness;

  // Create thin board faces
  const boards = [];
  let z = 0;
  while (z < height) {
    const remaining = height - z;
    const this_height = Math.min(board_height, remaining);

    if (this_height > 20) {
      let board = translate(
        cube({ size: [panel_len, board_thickness, this_height], center: false }),
        [panel_x, board_y, panel_z + z]
      );

      // Apply cutouts
      for (const cutout of cutouts) {
        const cutout_pos = cutout[0];
        const cutout_size = cutout[1];
        const cutout_box = translate(
          cube({ size: cutout_size, center: false }),
          cutout_pos
        );
        board = difference(board, cutout_box);
      }
      boards.push(board);
    }
    z += board_height + shadow_gap;
  }

  // Union all boards (keep backing separate for darker shadow color)
  let boardsUnion = boards[0];
  for (let i = 1; i < boards.length; i++) {
    boardsUnion = union(boardsUnion, boards[i]);
  }

  // Corner trim boards - thicker to stand proud
  const trim_thickness = 25;
  const trim_y = facing < 0 ? board_y - 7 : board_y + board_thickness + 7 - trim_thickness;

  const left_trim = translate(
    cube({ size: [trim_w, trim_thickness, height + 40], center: false }),
    [base_pos[0] - margin - trim_w, trim_y, panel_z - 20]
  );
  const right_trim = translate(
    cube({ size: [trim_w, trim_thickness, height + 40], center: false }),
    [base_pos[0] + len + margin, trim_y, panel_z - 20]
  );

  // Top and bottom trim
  const trim_total_len = len + 2 * margin + 2 * trim_w;
  const top_trim = translate(
    cube({ size: [trim_total_len, trim_thickness, 20], center: false }),
    [base_pos[0] - margin - trim_w, trim_y, panel_z + height]
  );
  const bottom_trim = translate(
    cube({ size: [trim_total_len, trim_thickness, 20], center: false }),
    [base_pos[0] - margin - trim_w, trim_y, panel_z - 20]
  );

  return {
    backing: backing,
    boards: boardsUnion,
    trim: union(left_trim, right_trim, top_trim, bottom_trim)
  };
}

// Horizontal cladding for walls running along Y axis (left/right walls)
// Solid backing panel with thin board faces creating shadow lines
// facing: -1 for left wall (faces -X), +1 for right wall (faces +X)
function horizontal_cladding_y(width, height, base_pos, cutouts = [], margin = 25, thickness = 18, trim_w = 45, facing = -1, back_margin = null) {
  const front_m = margin;
  const back_m = back_margin !== null ? back_margin : margin;
  const panel_x = base_pos[0];
  const panel_y = base_pos[1] - front_m;
  const panel_z = base_pos[2];
  const panel_width = width + front_m + back_m;

  // Backing panel (wall sheathing) - solid, no gaps
  const backing_thickness = 12;
  let backing = translate(
    cube({ size: [backing_thickness, panel_width, height], center: false }),
    [panel_x, panel_y, panel_z]
  );

  // Apply cutouts to backing
  for (const cutout of cutouts) {
    const cutout_pos = cutout[0];
    const cutout_size = cutout[1];
    const cutout_box = translate(
      cube({ size: cutout_size, center: false }),
      cutout_pos
    );
    backing = difference(backing, cutout_box);
  }

  // Board dimensions - thin faces mounted on backing
  const board_height = 145;     // Visible board height
  const board_thickness = 12;   // Thicker boards for better MSAA edge coverage
  const shadow_gap = 8;         // Gap between boards
  // Board position depends on facing direction
  const board_x = facing < 0 ? panel_x - board_thickness : panel_x + backing_thickness;

  // Create thin board faces
  const boards = [];
  let z = 0;
  while (z < height) {
    const remaining = height - z;
    const this_height = Math.min(board_height, remaining);

    if (this_height > 20) {
      let board = translate(
        cube({ size: [board_thickness, panel_width, this_height], center: false }),
        [board_x, panel_y, panel_z + z]
      );

      // Apply cutouts
      for (const cutout of cutouts) {
        const cutout_pos = cutout[0];
        const cutout_size = cutout[1];
        const cutout_box = translate(
          cube({ size: cutout_size, center: false }),
          cutout_pos
        );
        board = difference(board, cutout_box);
      }
      boards.push(board);
    }
    z += board_height + shadow_gap;
  }

  // Union all boards (keep backing separate for darker shadow color)
  let boardsUnion = boards[0];
  for (let i = 1; i < boards.length; i++) {
    boardsUnion = union(boardsUnion, boards[i]);
  }

  // Corner trim boards - thicker to stand proud
  const trim_thickness = 25;
  const trim_x = facing < 0 ? board_x - 7 : board_x + board_thickness + 7 - trim_thickness;

  const front_trim = translate(
    cube({ size: [trim_thickness, trim_w, height + 40], center: false }),
    [trim_x, base_pos[1] - front_m - trim_w, panel_z - 20]
  );
  const back_trim = translate(
    cube({ size: [trim_thickness, trim_w, height + 40], center: false }),
    [trim_x, base_pos[1] + width + back_m, panel_z - 20]
  );

  // Top and bottom trim
  const trim_total_width = width + front_m + back_m + 2 * trim_w;
  const top_trim = translate(
    cube({ size: [trim_thickness, trim_total_width, 20], center: false }),
    [trim_x, base_pos[1] - front_m - trim_w, panel_z + height]
  );
  const bottom_trim = translate(
    cube({ size: [trim_thickness, trim_total_width, 20], center: false }),
    [trim_x, base_pos[1] - front_m - trim_w, panel_z - 20]
  );

  return {
    backing: backing,
    boards: boardsUnion,
    trim: union(front_trim, back_trim, top_trim, bottom_trim)
  };
}

// Traditional 4-panel door with proper proportions
// Classic style: 2 SMALLER panels on TOP, 2 LARGER panels on BOTTOM
// Returns { body: ..., hardware: ... } for separate material application
// Based on research from dimensions.com, finewoodworking.com, directdoors.com
function door_panel(width, height, thickness = 40) {
  // === FRAME DIMENSIONS (scaled for door size) ===
  // Standard proportions: stiles ~57mm (2.25"), rails similar, bottom rail wider
  const stile_w = 57;              // Vertical frame pieces (left/right)
  const top_rail_h = 57;           // Top rail - same as stiles
  const bottom_rail_h = 90;        // Bottom rail - wider for kick resistance
  const mid_rail_h = 57;           // Middle rail at waist height

  // === PANEL LAYOUT ===
  // Classic 4-panel: smaller panels on top, larger panels on bottom
  // Mid rail positioned at about 55% of door height (waist height ~1100mm on 2000mm door)
  const mid_rail_z = height * 0.55;

  // Inner dimensions (where panels go)
  const inner_w = width - 2 * stile_w;

  // Panel heights
  const lower_panel_h = mid_rail_z - bottom_rail_h;
  const upper_panel_h = height - mid_rail_z - mid_rail_h - top_rail_h;

  // Center muntin (vertical divider between left/right panels)
  const muntin_w = 57;
  const panel_w = (inner_w - muntin_w) / 2;

  const door_parts = [];
  const hardware_parts = [];

  // === SOLID DOOR CORE ===
  const core = cube({ size: [width, thickness, height], center: false });
  door_parts.push(core);

  // === FRAME PIECES (stand proud of panels) ===
  const frame_proud = 8;  // Frame stands 8mm proud of panel surface

  // Left stile (full height)
  door_parts.push(translate(
    cube({ size: [stile_w, frame_proud, height], center: false }),
    [0, -frame_proud, 0]
  ));

  // Right stile (full height)
  door_parts.push(translate(
    cube({ size: [stile_w, frame_proud, height], center: false }),
    [width - stile_w, -frame_proud, 0]
  ));

  // Center muntin
  door_parts.push(translate(
    cube({ size: [muntin_w, frame_proud, height - top_rail_h - bottom_rail_h], center: false }),
    [stile_w + panel_w, -frame_proud, bottom_rail_h]
  ));

  // Top rail
  door_parts.push(translate(
    cube({ size: [width, frame_proud, top_rail_h], center: false }),
    [0, -frame_proud, height - top_rail_h]
  ));

  // Bottom rail
  door_parts.push(translate(
    cube({ size: [width, frame_proud, bottom_rail_h], center: false }),
    [0, -frame_proud, 0]
  ));

  // Mid rail
  door_parts.push(translate(
    cube({ size: [inner_w, frame_proud, mid_rail_h], center: false }),
    [stile_w, -frame_proud, mid_rail_z]
  ));

  // === RAISED PANEL CENTERS ===
  const left_panel_x = stile_w;
  const right_panel_x = stile_w + panel_w + muntin_w;
  const lower_panel_z = bottom_rail_h;
  const upper_panel_z = mid_rail_z + mid_rail_h;
  const panel_face_y = -frame_proud;
  const field_margin = 20;
  const field_proud = 4;

  // Helper for raised panel center field
  function add_panel_field(px, pz, pw, ph) {
    if (pw > 2 * field_margin && ph > 2 * field_margin) {
      door_parts.push(translate(
        cube({ size: [pw - 2 * field_margin, field_proud, ph - 2 * field_margin], center: false }),
        [px + field_margin, panel_face_y - field_proud, pz + field_margin]
      ));
    }
  }

  add_panel_field(left_panel_x, lower_panel_z, panel_w, lower_panel_h);
  add_panel_field(right_panel_x, lower_panel_z, panel_w, lower_panel_h);
  add_panel_field(left_panel_x, upper_panel_z, panel_w, upper_panel_h);
  add_panel_field(right_panel_x, upper_panel_z, panel_w, upper_panel_h);

  // === DOOR HANDLE (on LEFT side - opposite hinge at right edge X=width) ===
  // Hinge is at X=width of door, so handle must be on LEFT side near X=0
  const handle_x = stile_w / 2;  // Center of LEFT stile
  const handle_z = mid_rail_z + mid_rail_h / 2;  // Lock height

  // Backplate
  const bp_w = 35;
  const bp_h = 160;
  const bp_d = 6;
  hardware_parts.push(translate(
    cube({ size: [bp_w, bp_d, bp_h], center: false }),
    [handle_x - bp_w / 2, -frame_proud - bp_d, handle_z - bp_h / 2]
  ));

  // Lever rose
  const rose_r = 20;
  const rose_d = 3;
  hardware_parts.push(translate(
    rotate(cylinder({ height: rose_d, radius: rose_r, center: false }), [90, 0, 0]),
    [handle_x, -frame_proud - bp_d, handle_z + 25]
  ));

  // Lever spindle
  const spindle_len = 18;
  const spindle_r = 6;
  hardware_parts.push(translate(
    rotate(cylinder({ height: spindle_len, radius: spindle_r, center: false }), [90, 0, 0]),
    [handle_x, -frame_proud - bp_d - rose_d, handle_z + 25]
  ));

  // Lever arm (pointing toward +X, toward hinge/center of door)
  const lever_len = 95;
  const lever_r = 8;
  hardware_parts.push(translate(
    rotate(cylinder({ height: lever_len, radius: lever_r, center: false }), [0, 90, 0]),
    [handle_x, -frame_proud - bp_d - rose_d - spindle_len, handle_z + 25]
  ));

  // Lever end
  hardware_parts.push(translate(
    sphere({ radius: lever_r + 1, center: true }),
    [handle_x + lever_len, -frame_proud - bp_d - rose_d - spindle_len, handle_z + 25]
  ));

  // Key escutcheon
  const esc_r = 16;
  hardware_parts.push(translate(
    rotate(cylinder({ height: 2, radius: esc_r, center: false }), [90, 0, 0]),
    [handle_x, -frame_proud - bp_d, handle_z - 30]
  ));

  // Key cylinder
  hardware_parts.push(translate(
    rotate(cylinder({ height: 10, radius: 9, center: false }), [90, 0, 0]),
    [handle_x, -frame_proud - bp_d - 2, handle_z - 30]
  ));

  return {
    body: union(...door_parts),
    hardware: union(...hardware_parts)
  };
}

// Pop door panel - bottom-hinged ramp with grip cleats
function pop_door_panel(width, length, thickness = 18, num_cleats = 8) {
  // Main ramp surface
  const ramp = cube({ size: [width, thickness, length], center: false });

  // Add grip cleats
  const cleats = [];
  const cleat_spacing = length / (num_cleats + 1);
  for (let i = 1; i <= num_cleats; i++) {
    const cleat = translate(
      cube({ size: [width, 10, 10], center: false }),
      [0, thickness, i * cleat_spacing - 5]
    );
    cleats.push(cleat);
  }

  return union(ramp, ...cleats);
}

// Roosting perch - cylindrical roost
function roosting_perch(length, diameter = 50) {
  return rotate(
    cylinder({ height: length, radius: diameter / 2, center: false }),
    [0, 90, 0]
  );
}

// ============================================================================
// HARDWARE PRIMITIVES (bolts, screws, hangers)
// ============================================================================

// Hex bolt with head - length is shaft length, diameter is shaft diameter
function hex_bolt(length, diameter = 8) {
  const head_height = diameter * 0.7;
  const head_width = diameter * 1.8;
  // Hexagonal head approximated as cylinder (6-sided)
  const head = cylinder({ height: head_height, radius: head_width / 2, center: false });
  const shaft = translate(
    cylinder({ height: length, radius: diameter / 2, center: false }),
    [0, 0, head_height]
  );
  return union(head, shaft);
}

// Wood screw with countersunk head
function wood_screw(length, diameter = 4) {
  const head_height = diameter * 0.5;
  const head_radius = diameter * 1.2;
  // Countersunk head (cone shape approximated)
  const head = cylinder({ height: head_height, radius: head_radius, center: false });
  const shaft = translate(
    cylinder({ height: length - head_height, radius: diameter / 2, center: false }),
    [0, 0, head_height]
  );
  return union(head, shaft);
}

// Joist hanger - U-shaped metal bracket
function joist_hanger_3d(joist_width, joist_height, thickness = 2) {
  const flange_height = 30;
  // Bottom plate
  const bottom = cube({ size: [joist_width + 2 * thickness, thickness, joist_height], center: false });
  // Left side
  const left = translate(
    cube({ size: [thickness, joist_height * 0.8, flange_height], center: false }),
    [0, thickness, 0]
  );
  // Right side
  const right = translate(
    cube({ size: [thickness, joist_height * 0.8, flange_height], center: false }),
    [joist_width + thickness, thickness, 0]
  );
  // Top flanges for nailing
  const flange_l = translate(
    cube({ size: [25, thickness, flange_height], center: false }),
    [-25, 0, 0]
  );
  const flange_r = translate(
    cube({ size: [25, thickness, flange_height], center: false }),
    [joist_width + 2 * thickness, 0, 0]
  );
  return union(bottom, left, right, flange_l, flange_r);
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Paver row
function paver_row(len, paver, max_spacing, y) {
  const offsets = calc_paver_offsets(len, max_spacing);
  const pavers = offsets.map((offset, i) => {
    const x_offset = i === 0 ? paver[0] / 2 :
                    i === offsets.length - 1 ? offset - paver[0] / 2 :
                    offset;

    return translate(
      cube({ size: paver, center: false }),
      [x_offset - paver[0] / 2, y - paver[1] / 2, 0]
    );
  });
  return union(...pavers);
}

// Foundation pavers only (concrete blocks)
function foundation_pavers(len, width, paver, max_spacing) {
  // Three rows of pavers
  const paver1 = paver_row(len, paver, max_spacing, paver[1] / 2);
  const paver2 = paver_row(len, paver, max_spacing, width / 2);
  const paver3 = paver_row(len, paver, max_spacing, width - paver[1] / 2);
  return union(paver1, paver2, paver3);
}

// Foundation skids only (pressure-treated timber beams)
function foundation_skids(len, width, skid, paver) {
  // Three skids sitting on top of pavers
  const skid1 = translate(
    cube({ size: [len, skid[0], skid[1]], center: false }),
    [0, skid[0] / 2, paver[2]]
  );
  const skid2 = translate(
    cube({ size: [len, skid[0], skid[1]], center: false }),
    [0, width / 2 - skid[0] / 2, paver[2]]
  );
  const skid3 = translate(
    cube({ size: [len, skid[0], skid[1]], center: false }),
    [0, width - skid[0] - skid[0] / 2, paver[2]]
  );
  return union(skid1, skid2, skid3);
}

// Skid base - combined (for backwards compatibility if needed)
function skid_base(len, width, skid, paver, max_spacing) {
  const pavers = foundation_pavers(len, width, paver, max_spacing);
  const skids = foundation_skids(len, width, skid, paver);
  return union(pavers, skids);
}

// Skirting around base
function coop_skirting(len, width, height, thickness, overhang) {
  const front = translate(
    cube({ size: [len + 2 * overhang, overhang, height], center: false }),
    [-overhang, -overhang, 0]
  );
  const back = translate(
    cube({ size: [len + 2 * overhang, overhang, height], center: false }),
    [-overhang, width, 0]
  );
  const left = translate(
    cube({ size: [overhang, width + 2 * overhang, height], center: false }),
    [-overhang, -overhang, 0]
  );
  const right = translate(
    cube({ size: [overhang, width + 2 * overhang, height], center: false }),
    [len, -overhang, 0]
  );

  return union(front, back, left, right);
}

// Floor frame with joists
function floor_frame(len, width, joist, spacing, paver_h, skid_h, floor_th) {
  const base_z = paver_h + skid_h;

  // Rim joists
  const front_rim = translate(
    cube({ size: [joist[0], width, joist[1]], center: false }),
    [0, 0, base_z]
  );
  const back_rim = translate(
    cube({ size: [joist[0], width, joist[1]], center: false }),
    [len - joist[0], 0, base_z]
  );
  const left_rim = translate(
    cube({ size: [len - 2 * joist[0], joist[0], joist[1]], center: false }),
    [joist[0], 0, base_z]
  );
  const right_rim = translate(
    cube({ size: [len - 2 * joist[0], joist[0], joist[1]], center: false }),
    [joist[0], width - joist[0], base_z]
  );

  // Interior joists
  const hanger_drop = 48;
  const interior_joists = [];
  for (let x = joist[0] + spacing / 2; x < len - joist[0] - spacing / 2; x += spacing) {
    interior_joists.push(
      translate(
        cube({ size: [joist[0], width - 2 * joist[0], joist[1] - hanger_drop], center: false }),
        [x - joist[0] / 2, joist[0], base_z]
      )
    );
  }

  // Floor sheet
  const floor_sheet = translate(
    cube({ size: [len, width, floor_th], center: false }),
    [0, 0, base_z + joist[1]]
  );

  return union(front_rim, back_rim, left_rim, right_rim, ...interior_joists, floor_sheet);
}

// Nesting box array with round entrance holes and hinged doors
function nesting_boxes(count, box_w, box_d, box_h, wall_t = 12, spacing = 18, door_angle = 45) {
  const boxes = [];
  const doors = [];

  for (let i = 0; i < count; i++) {
    const x_offset = spacing + i * (box_w + spacing);

    // Create box side panels, bottom, and top
    const left_wall = cube({ size: [wall_t, box_d, box_h], center: false });
    const right_wall = translate(
      cube({ size: [wall_t, box_d, box_h], center: false }),
      [box_w - wall_t, 0, 0]
    );
    const bottom = cube({ size: [box_w, box_d, wall_t], center: false });
    const top = translate(
      cube({ size: [box_w, box_d, wall_t], center: false }),
      [0, 0, box_h - wall_t]
    );

    // Front panel (faces into coop) - solid panel with round hole cut out
    const entrance_diameter = 250;  // 250mm round opening - bigger for chickens
    const entrance_center_h = box_h * 0.55;  // Slightly above center

    const front_panel = translate(
      cube({ size: [box_w, wall_t, box_h], center: false }),
      [0, box_d - wall_t, 0]
    );

    // Create entrance hole using cylinder
    const hole = translate(
      rotate(
        cylinder({ height: wall_t + 4, radius: entrance_diameter / 2, center: true }),
        [90, 0, 0]
      ),
      [box_w / 2, box_d - wall_t / 2, entrance_center_h]
    );

    const front_with_hole = difference(front_panel, hole);

    // Box structure (without back door) - now includes top
    const box_structure = union(left_wall, right_wall, bottom, top, front_with_hole);

    const single_box = translate(box_structure, [x_offset, 0, 0]);
    boxes.push(single_box);

    // Hinged door on back (for egg collection from outside)
    // Door is hinged at the bottom and opens downward/outward
    const door = cube({ size: [box_w - 2 * wall_t, wall_t, box_h - wall_t], center: false });

    // Rotate door around its bottom edge (hinge point)
    const door_rotated = translate(
      rotate(
        translate(door, [0, 0, -(box_h - wall_t)]),  // Move to origin at bottom
        [-door_angle, 0, 0]  // Rotate down
      ),
      [wall_t, -wall_t, box_h - wall_t]  // Move back to position
    );

    const positioned_door = translate(door_rotated, [x_offset, 0, 0]);
    doors.push(positioned_door);
  }

  return { boxes: union(...boxes), doors: union(...doors) };
}

// Gable roof with complete enclosure
function gable_roof(len, width, wall_h, floor_stack, pitch_deg, overhang, roof_t) {
  const roof_pitch_rad = pitch_deg * Math.PI / 180;
  const half_width = width / 2;
  const roof_rise = half_width * Math.tan(roof_pitch_rad);
  const roof_length = half_width / Math.cos(roof_pitch_rad);
  const roof_plate_len = len + 2 * overhang;
  const roof_plate_width = roof_length + overhang;

  const base_z = floor_stack + wall_h;
  const peak_z = base_z + roof_rise;

  // Gable end panel thickness - matches wall framing for solid integration
  const gable_thickness = 98;  // Match stud width for proper wall integration

  // Create pitched roof panels
  // Left panel (slopes down from peak toward Y=0)
  const left_panel = translate(
    rotate(
      translate(
        cube({ size: [roof_plate_len, roof_plate_width, roof_t], center: false }),
        [0, -roof_plate_width, 0]
      ),
      [pitch_deg, 0, 0]
    ),
    [-overhang, width / 2, peak_z]
  );

  // Right panel (slopes down from peak toward Y=width)
  const right_panel = translate(
    rotate(
      cube({ size: [roof_plate_len, roof_plate_width, roof_t], center: false }),
      [-pitch_deg, 0, 0]
    ),
    [-overhang, width / 2, peak_z]
  );

  // Gable end infill - solid triangular walls using hull()
  // Use thin vertical plates at triangle vertices for clean hull geometry
  const vertex_size = 10;  // Size of hull vertex elements

  // Extra height to ensure overlap with roof underside (avoid gaps)
  const overlap = 20;

  // Front gable - triangular infill above front wall
  // Triangle vertices: bottom-left (Y=0), bottom-right (Y=width), peak (Y=width/2)
  const front_gable = translate(
    hull(
      // Bottom-left vertex
      cube({ size: [gable_thickness, vertex_size, vertex_size], center: false }),
      // Bottom-right vertex
      translate(
        cube({ size: [gable_thickness, vertex_size, vertex_size], center: false }),
        [0, width - vertex_size, 0]
      ),
      // Peak vertex (with overlap to ensure contact with roof)
      translate(
        cube({ size: [gable_thickness, vertex_size, vertex_size], center: false }),
        [0, half_width - vertex_size / 2, roof_rise + overlap]
      )
    ),
    [0, 0, base_z]
  );

  // Back gable - same triangle at the back of the coop
  const back_gable = translate(
    hull(
      cube({ size: [gable_thickness, vertex_size, vertex_size], center: false }),
      translate(
        cube({ size: [gable_thickness, vertex_size, vertex_size], center: false }),
        [0, width - vertex_size, 0]
      ),
      translate(
        cube({ size: [gable_thickness, vertex_size, vertex_size], center: false }),
        [0, half_width - vertex_size / 2, roof_rise + overlap]
      )
    ),
    [len - gable_thickness, 0, base_z]
  );

  // Ridge board - structural member at the peak
  const ridge_height = 50;
  const ridge_thickness = 25;
  const ridge_board = translate(
    cube({ size: [len, ridge_thickness, ridge_height], center: false }),
    [0, width / 2 - ridge_thickness / 2, peak_z - ridge_height]
  );

  // Barge boards (verge boards) - trim along the gable rake edges
  // These follow the roof pitch at each gable end
  const barge_width = 150;
  const barge_thickness = 25;

  // Front gable barge boards (left and right of peak)
  const front_barge_left = translate(
    rotate(
      translate(
        cube({ size: [barge_thickness, roof_length + overhang, barge_width], center: false }),
        [0, -(roof_length + overhang), 0]
      ),
      [pitch_deg, 0, 0]
    ),
    [-overhang, width / 2, peak_z]
  );

  const front_barge_right = translate(
    rotate(
      cube({ size: [barge_thickness, roof_length + overhang, barge_width], center: false }),
      [-pitch_deg, 0, 0]
    ),
    [-overhang, width / 2, peak_z]
  );

  // Back gable barge boards
  const back_barge_left = translate(
    rotate(
      translate(
        cube({ size: [barge_thickness, roof_length + overhang, barge_width], center: false }),
        [0, -(roof_length + overhang), 0]
      ),
      [pitch_deg, 0, 0]
    ),
    [len + overhang - barge_thickness, width / 2, peak_z]
  );

  const back_barge_right = translate(
    rotate(
      cube({ size: [barge_thickness, roof_length + overhang, barge_width], center: false }),
      [-pitch_deg, 0, 0]
    ),
    [len + overhang - barge_thickness, width / 2, peak_z]
  );

  return union(
    left_panel, right_panel,
    front_gable, back_gable,
    ridge_board,
    front_barge_left, front_barge_right,
    back_barge_left, back_barge_right
  );
}

// ============================================================================
// MAIN ASSEMBLY
// ============================================================================

// Build the foundation - separate pavers and skids for material tracking
const foundationPavers = foundation_pavers(coop_len, coop_w + stud_sec[1], paver_size, max_paver_spacing);
const foundationSkids = foundation_skids(coop_len, coop_w + stud_sec[1], skid_sec, paver_size);

// Build the skirting
const skirting = coop_skirting(coop_len, coop_w + stud_sec[1], floor_stack, skirting_t, 25);

// Build the floor frame
const floor = floor_frame(coop_len, coop_w, joist_sec, joist_sp, paver_size[2], skid_sec[1], floor_th);

// Build joist hangers for floor joists
// Hangers attach to inside faces of front/back rim joists, opening toward floor joist
function build_floor_hangers(coop_len, coop_w, joist_sec, joist_sp, paver_z, skid_h) {
  const hangers = [];
  const joist_count = Math.floor((coop_w - joist_sec[0]) / joist_sp);
  const hanger_z = paver_z + skid_h;  // Bottom of rim joist
  const thickness = 1.5;
  const flange_w = 20;
  const hanger_depth = joist_sec[1] * 0.7;  // How deep the U is

  // Build properly oriented hanger - U-shape opening along +X (toward back)
  function make_front_hanger() {
    // Back plate (attaches to rim joist) - vertical plate in YZ plane
    const back = cube({ size: [thickness, joist_sec[0] + 4, hanger_depth], center: false });
    // Bottom plate - horizontal, extends into floor area
    const bottom = translate(
      cube({ size: [joist_sec[1] + thickness, joist_sec[0] + 4, thickness], center: false }),
      [thickness, 0, 0]
    );
    // Left side
    const left = translate(
      cube({ size: [joist_sec[1] * 0.7, thickness, hanger_depth], center: false }),
      [thickness, 0, 0]
    );
    // Right side
    const right = translate(
      cube({ size: [joist_sec[1] * 0.7, thickness, hanger_depth], center: false }),
      [thickness, joist_sec[0] + 4 - thickness, 0]
    );
    // Top flanges for nailing to rim joist
    const flange_l = cube({ size: [thickness, flange_w, hanger_depth], center: false });
    const flange_r = translate(
      cube({ size: [thickness, flange_w, hanger_depth], center: false }),
      [0, joist_sec[0] + 4 - flange_w, 0]
    );
    return union(back, bottom, left, right, flange_l, flange_r);
  }

  // Build hanger opening toward -X (for back rim joist)
  function make_back_hanger() {
    // Back plate - vertical plate in YZ plane
    const back = cube({ size: [thickness, joist_sec[0] + 4, hanger_depth], center: false });
    // Bottom plate - horizontal, extends into floor area (toward -X)
    const bottom = translate(
      cube({ size: [joist_sec[1] + thickness, joist_sec[0] + 4, thickness], center: false }),
      [-(joist_sec[1]), 0, 0]
    );
    // Left side
    const left = translate(
      cube({ size: [joist_sec[1] * 0.7, thickness, hanger_depth], center: false }),
      [-(joist_sec[1] * 0.7), 0, 0]
    );
    // Right side
    const right = translate(
      cube({ size: [joist_sec[1] * 0.7, thickness, hanger_depth], center: false }),
      [-(joist_sec[1] * 0.7), joist_sec[0] + 4 - thickness, 0]
    );
    // Top flanges
    const flange_l = cube({ size: [thickness, flange_w, hanger_depth], center: false });
    const flange_r = translate(
      cube({ size: [thickness, flange_w, hanger_depth], center: false }),
      [0, joist_sec[0] + 4 - flange_w, 0]
    );
    return union(back, bottom, left, right, flange_l, flange_r);
  }

  // Place hangers at each floor joist position
  for (let i = 1; i <= joist_count; i++) {
    const y_pos = i * joist_sp - joist_sec[0] / 2 - 2;  // Center on joist

    // Front hanger - attaches to inside of front rim joist (at X = joist_sec[0])
    const front_hanger = translate(
      make_front_hanger(),
      [joist_sec[0], y_pos, hanger_z]
    );
    hangers.push(front_hanger);

    // Back hanger - attaches to inside of back rim joist (at X = coop_len - joist_sec[0])
    const back_hanger = translate(
      make_back_hanger(),
      [coop_len - joist_sec[0], y_pos, hanger_z]
    );
    hangers.push(back_hanger);
  }
  return union(...hangers);
}

const floor_hangers = build_floor_hangers(coop_len, coop_w, joist_sec, joist_sp, paver_size[2], skid_sec[1]);

// Door and vent cutouts
const door_cutout = translate(
  cube({ size: [door_w, stud_sec[1] + 2, door_h], center: false }),
  [coop_len / 2 - door_w / 2, -1, stud_sec[0]]
);

const back_vent_bottom_z = wall_h - vent_top_clearance - vent_h - stud_sec[0];
const back_vent_cutout = translate(
  cube({ size: [vent_w, stud_sec[1] + 2, vent_h], center: false }),
  [coop_len / 2 - vent_w / 2, -1, back_vent_bottom_z]
);

// Nesting box access cutout in front wall (external access to collect eggs)
// The cutout should align with the nesting boxes, leaving a lip at the bottom
const nest_spacing = 18;
const nest_total_w = nest_boxes * nest_box_w + (nest_boxes + 1) * nest_spacing;
const nest_box_x = coop_len / 2 - door_w / 2 - nest_total_w - 100;
// Cutout should match actual box positions (excluding outer spacing)
const nest_cutout_w = nest_boxes * nest_box_w + (nest_boxes - 1) * nest_spacing;
const nest_cutout_x = nest_box_x + nest_spacing;  // Start where first box starts
// The wall's coordinate system starts at floor level (floor_stack in absolute coords)
// So cutout Z is just: nest_height_off_floor + nest_access_lip_h (relative to wall origin)
const nest_cutout_bottom_z = nest_height_off_floor + nest_access_lip_h;
const nest_cutout_height = nest_box_h - nest_access_lip_h;
const nest_access_cutout = translate(
  cube({ size: [nest_cutout_w, stud_sec[1] + 2, nest_cutout_height], center: false }),
  [nest_cutout_x, -1, nest_cutout_bottom_z]
);

// Build the walls using Wall() primitive with stick-frame construction

// Front wall - along X axis from [0,0] to [coop_len, 0]
const front_wall_frame = Wall({
  start: [0, 0],
  end: [coop_len, 0],
  height: wall_h,
  construction: "stickFrame",
  studSize: stud_sec,
  studSpacing: stud_sp,
  includeSheathing: false
});
const front_wall = difference(
  translate(front_wall_frame, [0, 0, floor_stack]),
  translate(door_cutout, [0, 0, floor_stack]),
  translate(nest_access_cutout, [0, 0, floor_stack])
);

// Back wall - along X axis from [0, coop_w] to [coop_len, coop_w]
const back_wall_frame = Wall({
  start: [0, coop_w],
  end: [coop_len, coop_w],
  height: wall_h,
  construction: "stickFrame",
  studSize: stud_sec,
  studSpacing: stud_sp,
  includeSheathing: false
});
const back_wall = difference(
  translate(back_wall_frame, [0, 0, floor_stack]),
  translate(back_vent_cutout, [0, 0, floor_stack])
);

// Left wall - along Y axis from [0, coop_w] to [0, 0]
const left_wall_frame = Wall({
  start: [0, coop_w],
  end: [0, 0],
  height: wall_h,
  construction: "stickFrame",
  studSize: stud_sec,
  studSpacing: stud_sp,
  includeSheathing: false
});
const left_wall = translate(left_wall_frame, [0, 0, floor_stack]);

// Right wall - along Y axis from [coop_len, 0] to [coop_len, coop_w]
const right_wall_frame = Wall({
  start: [coop_len, 0],
  end: [coop_len, coop_w],
  height: wall_h,
  construction: "stickFrame",
  studSize: stud_sec,
  studSpacing: stud_sp,
  includeSheathing: false
});
const right_wall = translate(right_wall_frame, [0, 0, floor_stack]);

// Interior cladding on right wall - plywood panel covering studs from inside
// Panel sits 1mm inside of stud face to avoid z-fighting
const interior_panel_t = 12;
const right_interior_base = translate(
  cube({ size: [interior_panel_t, coop_w, wall_h], center: false }),
  [coop_len - interior_panel_t - 1, 0, floor_stack]
);

// Tunnel access opening through interior panel
// Position matches where the tunnel connects (centered on pop door)
const tunnel_opening_y = stud_sec[1] + 50 + pop_w / 2 - 175;  // pop_door_y + pop_w/2 - opening_w/2
const tunnel_opening_w = 350;   // Wide enough for chickens
const tunnel_opening_h = 400;   // Tall enough for chickens
const interior_cutout = translate(
  cube({ size: [interior_panel_t + 4, tunnel_opening_w, tunnel_opening_h], center: false }),
  [coop_len - interior_panel_t - 2, tunnel_opening_y, floor_stack]
);
const right_interior_panel = difference(right_interior_base, interior_cutout);

// Trim/frame around the tunnel access opening (interior side)
const ita_frame_w = 40;
const ita_frame_d = 15;
const ita_frame_parts = [];
const ita_panel_x = coop_len - interior_panel_t - 1;  // Match panel position
// Left jamb
ita_frame_parts.push(translate(
  cube({ size: [ita_frame_d, ita_frame_w, tunnel_opening_h], center: false }),
  [ita_panel_x - ita_frame_d, tunnel_opening_y - ita_frame_w, floor_stack]
));
// Right jamb
ita_frame_parts.push(translate(
  cube({ size: [ita_frame_d, ita_frame_w, tunnel_opening_h], center: false }),
  [ita_panel_x - ita_frame_d, tunnel_opening_y + tunnel_opening_w, floor_stack]
));
// Head (top piece)
ita_frame_parts.push(translate(
  cube({ size: [ita_frame_d, tunnel_opening_w + 2 * ita_frame_w, ita_frame_w], center: false }),
  [ita_panel_x - ita_frame_d, tunnel_opening_y - ita_frame_w, floor_stack + tunnel_opening_h]
));
// Threshold
ita_frame_parts.push(translate(
  cube({ size: [ita_frame_d + 20, tunnel_opening_w + 2 * ita_frame_w, 15], center: false }),
  [ita_panel_x - ita_frame_d - 10, tunnel_opening_y - ita_frame_w, floor_stack - 15]
));
const tunnel_access_interior_frame = union(...ita_frame_parts);

// Small ramp from coop floor into tunnel opening
const ramp_w = tunnel_opening_w - 20;  // Slightly narrower than opening
const ramp_length = 250;               // Extends into coop from wall
const ramp_t = 12;
const ramp_cleat_h = 8;
const ramp_parts = [];
// Ramp board - starts at interior panel face
ramp_parts.push(translate(
  cube({ size: [ramp_length, ramp_w, ramp_t], center: false }),
  [ita_panel_x - ramp_length, tunnel_opening_y + 10, floor_stack]
));
// Grip cleats on ramp (every 60mm)
for (let i = 1; i < Math.floor(ramp_length / 60); i++) {
  ramp_parts.push(translate(
    cube({ size: [10, ramp_w - 20, ramp_cleat_h], center: false }),
    [ita_panel_x - i * 60, tunnel_opening_y + 20, floor_stack + ramp_t]
  ));
}
const tunnel_access_ramp = union(...ramp_parts);

// Nesting box support structure
// Build a proper platform with posts directly under joists
const nest_ledger_h = 48;  // Support frame height
const support_platform_top_z = floor_stack + nest_height_off_floor;
const support_platform_bottom_z = support_platform_top_z - nest_ledger_h;
const post_height = support_platform_bottom_z - floor_stack;

// Horizontal ledger attached to wall (back edge) - now at Y=0 to match boxes
const nest_ledger = translate(
  cube({ size: [nest_total_w, 48, nest_ledger_h], center: false }),
  [nest_box_x, 0, support_platform_bottom_z]
);

// Front cross-member (front edge)
const front_member = translate(
  cube({ size: [nest_total_w, 48, nest_ledger_h], center: false }),
  [nest_box_x, nest_box_d - 48, support_platform_bottom_z]
);

// Cross joists running front-to-back, connecting ledger to front member
const cross_joists = [];
const num_joists = Math.floor(nest_total_w / 600) + 2;

for (let i = 0; i < num_joists; i++) {
  const joist_x = nest_box_x + (i * nest_total_w) / (num_joists - 1);
  const joist = translate(
    cube({ size: [48, nest_box_d, nest_ledger_h], center: false }),
    [joist_x - 24, 0, support_platform_bottom_z]
  );
  cross_joists.push(joist);

  // Post directly under this joist
  const post = translate(
    cube({ size: [48, 48, post_height], center: false }),
    [joist_x - 24, nest_box_d / 2 - 24, floor_stack]
  );
  cross_joists.push(post);
}

const nest_support_structure = union(nest_ledger, front_member, ...cross_joists);

// Nesting boxes sitting ON TOP of the ledger
// Bottom of boxes should be at nest_height_off_floor
// Position at Y=0 (flush with front wall) so access doors face exterior
// and wall cutout aligns with boxes
const nest_result = nesting_boxes(nest_boxes, nest_box_w, nest_box_d, nest_box_h, 12, 18, nest_lid_angle);
const nesting_box_array = translate(
  nest_result.boxes,
  [nest_box_x, 0, floor_stack + nest_height_off_floor]
);
const nesting_box_doors = translate(
  nest_result.doors,
  [nest_box_x, 0, floor_stack + nest_height_off_floor]
);
// Small pull handles on each exterior nest door for egg-collection access.
const nest_handle_parts = [];
for (let i = 0; i < nest_boxes; i += 1) {
  const x_offset = nest_box_x + nest_spacing + i * (nest_box_w + nest_spacing);
  const door_w = nest_box_w - 2 * 12;
  const handle_x = x_offset + door_w * 0.72;
  const handle_y = -12 - 26;
  const handle_z = floor_stack + nest_height_off_floor + nest_box_h * 0.58;
  const grip = translate(
    cube({ size: [92, 16, 16], center: true }),
    [handle_x, handle_y, handle_z]
  );
  const stem = translate(
    cube({ size: [22, 22, 22], center: true }),
    [handle_x, handle_y + 12, handle_z]
  );
  nest_handle_parts.push(union(grip, stem));
}
const nesting_box_handles = nest_handle_parts.length > 0 ? union(...nest_handle_parts) : cube({ size: [1, 1, 1], center: false });

// Build the roof
const roof = gable_roof(coop_len, coop_w, wall_h, floor_stack, roof_pitch_deg, overhang, 8);

// ============================================================================
// ROOF INSULATION - 100mm mineral wool under roof panels
// ============================================================================

const insulation_thickness = 100;  // 100mm mineral wool batts

// Calculate roof geometry (must match gable_roof function)
const roof_base_z = floor_stack + wall_h;
const roof_half_width = coop_w / 2;
const roof_rise = roof_half_width * Math.tan(roof_pitch_deg * Math.PI / 180);
const roof_slope_length = roof_half_width / Math.cos(roof_pitch_deg * Math.PI / 180);
const roof_peak_z = roof_base_z + roof_rise;
const insulation_plate_len = coop_len;  // No overhang for insulation (stays inside)
const insulation_plate_width = roof_slope_length;  // Match roof slope length

// Left roof insulation panel - positioned below metal roofing
// The insulation sits on the underside of the roof, between rafters
const roof_insulation_left = translate(
  rotate(
    translate(
      cube({ size: [insulation_plate_len, insulation_plate_width, insulation_thickness], center: false }),
      [0, -insulation_plate_width, -insulation_thickness]  // Below roof panel
    ),
    [roof_pitch_deg, 0, 0]
  ),
  [0, coop_w / 2, roof_peak_z]
);

// Right roof insulation panel - mirror of left
const roof_insulation_right = translate(
  rotate(
    cube({ size: [insulation_plate_len, insulation_plate_width, insulation_thickness], center: false }),
    [-roof_pitch_deg, 0, 0]
  ),
  [0, coop_w / 2, roof_peak_z - insulation_thickness]
);

// Combined roof insulation
const roof_insulation = union(roof_insulation_left, roof_insulation_right);

// ============================================================================
// WALL INSULATION - 100mm mineral wool in wall cavities
// ============================================================================

// Wall insulation fills the stud cavities (between interior and exterior)
// Stud depth is 98mm, so 100mm insulation will compress slightly (realistic)
const wall_insulation_depth = stud_sec[1];  // Match stud depth (98mm)

// Front wall insulation (along X axis at Y=0) - with door and nest access cutouts
const front_wall_insulation_base = translate(
  cube({ size: [coop_len, wall_insulation_depth, wall_h], center: false }),
  [0, 0, floor_stack]
);
// Door cutout in front insulation
// Make cutout extend beyond insulation boundaries to ensure clean cut
const front_insulation_door_cutout = translate(
  cube({ size: [door_w + 10, wall_insulation_depth + 20, door_h + 10], center: false }),
  [coop_len / 2 - door_w / 2 - 5, -10, floor_stack + stud_sec[0] - 5]
);
// Nesting box access cutout in front insulation
const front_insulation_nest_cutout = translate(
  cube({ size: [nest_cutout_w, wall_insulation_depth + 2, nest_cutout_height], center: false }),
  [nest_cutout_x, -1, floor_stack + nest_cutout_bottom_z]
);
const front_wall_insulation = difference(
  difference(front_wall_insulation_base, front_insulation_door_cutout),
  front_insulation_nest_cutout
);

// Back wall insulation (along X axis at Y=coop_w) - with vent cutout
const back_wall_insulation_base = translate(
  cube({ size: [coop_len, wall_insulation_depth, wall_h], center: false }),
  [0, coop_w, floor_stack]
);
// Vent cutout in back insulation
const back_insulation_vent_cutout = translate(
  cube({ size: [vent_w, wall_insulation_depth + 2, vent_h], center: false }),
  [coop_len / 2 - vent_w / 2, coop_w - 1, floor_stack + back_vent_bottom_z]
);
const back_wall_insulation = difference(back_wall_insulation_base, back_insulation_vent_cutout);

// Left wall insulation (along Y axis at X=0) - no cutouts
const left_wall_insulation = translate(
  cube({ size: [wall_insulation_depth, coop_w, wall_h], center: false }),
  [0, 0, floor_stack]
);

// Right wall insulation (along Y axis at X=coop_len) - with nesting box cutout
const right_wall_insulation_base = translate(
  cube({ size: [wall_insulation_depth, coop_w, wall_h], center: false }),
  [coop_len, 0, floor_stack]
);
// Nesting box exterior cutout - boxes protrude through right wall
// The boxes are positioned at nest_box_x (X position) and extend nest_box_d into the wall
// We need to cut through at Y position where boxes sit (centered around coop_w/2)
const nest_box_y_start = 0;  // Nesting boxes span from front wall
const nest_box_y_end = nest_box_d + 50;  // Box depth plus some margin
const right_insulation_nest_cutout = translate(
  cube({ size: [wall_insulation_depth + 2, nest_box_y_end - nest_box_y_start, nest_box_h + 50], center: false }),
  [coop_len - 1, nest_box_y_start, floor_stack + nest_height_off_floor]
);
const right_wall_insulation = difference(right_wall_insulation_base, right_insulation_nest_cutout);

// Combined wall insulation
const wall_insulation = union(
  front_wall_insulation,
  back_wall_insulation,
  left_wall_insulation,
  right_wall_insulation
);

// ============================================================================
// THERMAL NOTE: Openings (doors, vents) use ACTUAL geometry with thermal materials
// ============================================================================
// The thermal calculation works correctly because:
// 1. Wall insulation has cutouts where doors/vents are (CSG difference)
// 2. The actual door/vent geometry has materials with "opening" category
// 3. Heat loss is calculated separately for insulation (R=2.86) and openings (lower R)
// No fake "thermal slab" geometry needed - the real geometry provides the area.

// ============================================================================
// FLOOR INSULATION - 100mm mineral wool between floor joists
// ============================================================================

// Floor insulation sits between joists, below the OSB floor sheet
// Positioned at the bottom of the joist cavities (on top of skids)
const floor_insulation_z = paver_size[2] + skid_sec[1];  // Top of skids
const floor_insulation_height = joist_sec[1];  // Fill joist cavity depth (98mm)

// Single slab covering the entire floor area (simplified representation)
// In reality, it would be cut to fit between joists, but for thermal calc
// the total area is what matters
const floor_insulation = translate(
  cube({ size: [coop_len, coop_w, floor_insulation_height], center: false }),
  [0, 0, floor_insulation_z]
);

// ============================================================================
// CLADDING - Apply to all four walls
// ============================================================================

const cladding_th = 18;
const cladding_margin = 25;

// Front wall cladding (at Y = -cladding_th, facing outward)
// Cutouts need to extend far enough in Y to cut through both backing panel and board faces
// Backing is at panel_y, boards are at panel_y - 3 (board_thickness)
const front_cladding_cutouts = [
  // Human door cutout - make wider to accommodate door frame
  [[coop_len / 2 - door_w / 2 - 10, -cladding_th - 20, floor_stack + stud_sec[0] - 5],
   [door_w + 20, 40, door_h + 10]],
  // Nesting box access cutout
  [[nest_cutout_x, -cladding_th - 20, floor_stack + nest_cutout_bottom_z],
   [nest_cutout_w, 40, nest_cutout_height]]
];
const front_cladding = horizontal_cladding_x(
  coop_len, wall_h,
  [0, -cladding_th, floor_stack],
  front_cladding_cutouts
);

// Back wall cladding (at Y = coop_w + stud depth, facing outward)
// The Wall() studs extend 98mm (studSize[1]) outward from Y=coop_w, so cladding must be outside them
const back_cladding_y = coop_w + stud_sec[1];  // Outside the wall studs (stud depth is 98mm)
const back_cladding_cutouts = [
  // Vent cutout
  [[coop_len / 2 - vent_w / 2, back_cladding_y - 1, floor_stack + back_vent_bottom_z],
   [vent_w, cladding_th + 2, vent_h]]
];
const back_cladding = horizontal_cladding_x(
  coop_len, wall_h,
  [0, back_cladding_y, floor_stack],
  back_cladding_cutouts,
  25, 18, 45, +1  // facing = +1 for back wall (faces +Y)
);

// Left wall cladding (at X = -cladding_th)
const left_cladding = horizontal_cladding_y(
  coop_w, wall_h,
  [-cladding_th, 0, floor_stack],
  [],  // No cutouts on left wall
  25, 18, 45, -1, stud_sec[1]  // back_margin covers back wall stud depth at corner
);

// Right wall cladding (at X = coop_len + stud depth) - with tunnel opening cutout
const pop_door_y = stud_sec[1] + 50;  // Used for tunnel positioning
const right_tunnel_y = pop_door_y + pop_w / 2 - 600 / 2;  // Tunnel Y position (600 = tunnel_width)
// Cutout must exactly match tunnel exterior so no sky gap is visible
const right_cladding_cutouts = [
  [[coop_len + stud_sec[1] - 1, right_tunnel_y, floor_stack],
   [40, 600, 600]]  // tunnel_width x tunnel_height, no margin
];
const right_cladding = horizontal_cladding_y(
  coop_w, wall_h,
  [coop_len + stud_sec[1], 0, floor_stack],  // Outside the wall studs (stud depth is 98mm)
  right_cladding_cutouts,  // Cutout for tunnel opening
  25, 18, 45, +1, stud_sec[1]  // back_margin covers back wall stud depth at corner
);

// ============================================================================
// DOOR PANELS
// ============================================================================

// Human door - positioned at front wall, hinged on left edge
// Mirror in X so handle is on free edge (hinge is at X=0 for this door)
const human_door_parts = door_panel(door_w, door_h, 18);
const human_door_body_mirrored = translate(scale(human_door_parts.body, [-1, 1, 1]), [door_w, 0, 0]);
const human_door_hw_mirrored = translate(scale(human_door_parts.hardware, [-1, 1, 1]), [door_w, 0, 0]);
const human_door_hinge_x = coop_len / 2 - door_w / 2;
const human_door_hinge_y = -cladding_th - 18;
const human_door_body = translate(
  rotate(
    human_door_body_mirrored,
    [0, 0, -human_door_angle]  // Swing outward (negative Y direction)
  ),
  [human_door_hinge_x, human_door_hinge_y, floor_stack + stud_sec[0]]
);
const human_door_hardware = translate(
  rotate(
    human_door_hw_mirrored,
    [0, 0, -human_door_angle]
  ),
  [human_door_hinge_x, human_door_hinge_y, floor_stack + stud_sec[0]]
);
// Combined for thermal calculations (backwards compat)
const human_door = union(human_door_body, human_door_hardware);

// Door frame/casing - surrounds the door opening
// Frame sits on the cladding surface, door swings within it
const door_frame_w = 60;          // Width of frame pieces
const door_frame_d = 20;          // Depth (how much it stands proud)
const door_frame_reveal = 3;      // Gap between frame and door edge
const door_opening_w = door_w + 2 * door_frame_reveal;
const door_opening_h = door_h + door_frame_reveal;  // No reveal at bottom (threshold)
// Frame position - directly around the door opening
const door_frame_x = human_door_hinge_x - door_frame_reveal;
const door_frame_y = -cladding_th - door_frame_d - 3;  // In front of cladding boards
const door_frame_z = floor_stack + stud_sec[0];  // Door bottom position
const door_frame_floor_z = floor_stack;  // Jambs extend to floor level (not below skirting)

// Frame pieces
const door_frame_parts = [];

// Jamb height - from floor to top of door opening plus head height
const jamb_full_height = door_frame_z + door_opening_h + door_frame_w - door_frame_floor_z;

// Left jamb (extends to floor level)
door_frame_parts.push(translate(
  cube({ size: [door_frame_w, door_frame_d, jamb_full_height], center: false }),
  [door_frame_x - door_frame_w, door_frame_y, door_frame_floor_z]
));

// Right jamb (extends to floor level)
door_frame_parts.push(translate(
  cube({ size: [door_frame_w, door_frame_d, jamb_full_height], center: false }),
  [door_frame_x + door_opening_w, door_frame_y, door_frame_floor_z]
));

// Head (top piece, spans the full width including jambs)
door_frame_parts.push(translate(
  cube({ size: [door_opening_w + 2 * door_frame_w, door_frame_d, door_frame_w], center: false }),
  [door_frame_x - door_frame_w, door_frame_y, door_frame_z + door_opening_h]
));

// Threshold/sill (bottom piece at door level)
const threshold_h = 15;
door_frame_parts.push(translate(
  cube({ size: [door_opening_w + 2 * door_frame_w, door_frame_d + 20, threshold_h], center: false }),
  [door_frame_x - door_frame_w, door_frame_y - 10, door_frame_z - threshold_h]
));

const human_door_frame = union(...door_frame_parts);

// ============================================================================
// NESTING BOX OPENING FRAME
// ============================================================================
// Trim around the nesting box access opening - similar construction to door frame
const nest_frame_w = 40;          // Width of frame pieces (slightly narrower than door)
const nest_frame_d = 20;          // Depth (how much it stands proud)
const nest_frame_opening_w = nest_cutout_w;
const nest_frame_opening_h = nest_cutout_height;
// Frame position - around the nesting box opening
const nest_frame_x = nest_cutout_x;
const nest_frame_y = -cladding_th - nest_frame_d - 3;  // In front of cladding boards
const nest_frame_z = floor_stack + nest_cutout_bottom_z;

const nest_frame_parts = [];

// Left jamb
nest_frame_parts.push(translate(
  cube({ size: [nest_frame_w, nest_frame_d, nest_frame_opening_h + nest_frame_w], center: false }),
  [nest_frame_x - nest_frame_w, nest_frame_y, nest_frame_z - nest_frame_w / 2]
));

// Right jamb
nest_frame_parts.push(translate(
  cube({ size: [nest_frame_w, nest_frame_d, nest_frame_opening_h + nest_frame_w], center: false }),
  [nest_frame_x + nest_frame_opening_w, nest_frame_y, nest_frame_z - nest_frame_w / 2]
));

// Head (top piece)
nest_frame_parts.push(translate(
  cube({ size: [nest_frame_opening_w + 2 * nest_frame_w, nest_frame_d, nest_frame_w], center: false }),
  [nest_frame_x - nest_frame_w, nest_frame_y, nest_frame_z + nest_frame_opening_h]
));

// Sill (bottom piece)
nest_frame_parts.push(translate(
  cube({ size: [nest_frame_opening_w + 2 * nest_frame_w, nest_frame_d + 15, nest_frame_w], center: false }),
  [nest_frame_x - nest_frame_w, nest_frame_y - 5, nest_frame_z - nest_frame_w]
));

const nest_box_frame = union(...nest_frame_parts);


// ============================================================================
// ROOSTING PERCHES
// ============================================================================

const roost_dia = 50;
const roost_color = [0.55, 0.35, 0.20];  // Dark brown

// Lower roost - runs front to back (Y direction), above nesting boxes
const lower_roost_h = floor_stack + nest_box_h + 200;
const lower_roost_length = coop_w - 2 * (stud_sec[1] + 100);
const lower_roost = translate(
  rotate(
    cylinder({ height: lower_roost_length, radius: roost_dia / 2, center: false }),
    [90, 0, 0]
  ),
  [coop_len / 2 - door_w / 2 - nest_total_w / 2, stud_sec[1] + 100 + lower_roost_length, lower_roost_h]
);

// Mid roost - runs left to right (X direction), higher up
const mid_roost_h = lower_roost_h + 400;
const mid_roost_length = coop_len - 2 * (stud_sec[1] + 100);
const mid_roost = translate(
  rotate(
    cylinder({ height: mid_roost_length, radius: roost_dia / 2, center: false }),
    [0, 90, 0]
  ),
  [stud_sec[1] + 100, coop_w * 0.75, mid_roost_h]
);

// Upper roost - runs left to right (X direction), at back
const upper_roost_h = mid_roost_h + 400;
const upper_roost_length = coop_len - 2 * (stud_sec[1] + 100);
const upper_roost = translate(
  rotate(
    cylinder({ height: upper_roost_length, radius: roost_dia / 2, center: false }),
    [0, 90, 0]
  ),
  [stud_sec[1] + 100, coop_w - stud_sec[1] - 100, upper_roost_h]
);


// ============================================================================
// VIEWING TUNNEL - Enclosed structure from coop to run
// ============================================================================

const tunnel_width = 600;
const tunnel_length = 1200;
const tunnel_height = 600;
const tunnel_wall_t = 18;
const tunnel_roof_pitch = 45;
const tunnel_roof_t = 8;
const tunnel_window_inset = 50;
const tunnel_window_height = tunnel_height - 200;

// Tunnel position - starts at outer cladding face so it doesn't protrude into coop
const tunnel_base_x = coop_len + stud_sec[1] + 24;  // past studs (98) + backing (12) + boards (12)
const tunnel_base_y = pop_door_y + pop_w / 2 - tunnel_width / 2;
const tunnel_base_z = floor_stack;

// Wall passthrough sleeve - rectangular tube through the stud wall connecting interior to tunnel
// Starts at stud inner face (hidden behind interior panel) and extends to tunnel start
const passthrough_start_x = coop_len;  // Stud inner face - hidden behind interior panel
const passthrough_end_x = tunnel_base_x;
const passthrough_length = passthrough_end_x - passthrough_start_x;
// Floor
const passthrough_floor = translate(
  cube({ size: [passthrough_length, tunnel_width, tunnel_wall_t], center: false }),
  [passthrough_start_x, tunnel_base_y, tunnel_base_z]
);
// Left wall
const passthrough_left = translate(
  cube({ size: [passthrough_length, tunnel_wall_t, tunnel_height], center: false }),
  [passthrough_start_x, tunnel_base_y, tunnel_base_z]
);
// Right wall
const passthrough_right = translate(
  cube({ size: [passthrough_length, tunnel_wall_t, tunnel_height], center: false }),
  [passthrough_start_x, tunnel_base_y + tunnel_width - tunnel_wall_t, tunnel_base_z]
);
// Ceiling
const passthrough_ceiling = translate(
  cube({ size: [passthrough_length, tunnel_width, tunnel_wall_t], center: false }),
  [passthrough_start_x, tunnel_base_y, tunnel_base_z + tunnel_height - tunnel_wall_t]
);
const wall_passthrough = union(passthrough_floor, passthrough_left, passthrough_right, passthrough_ceiling);

// Create tunnel floor
const tunnel_floor = translate(
  cube({ size: [tunnel_length, tunnel_width, tunnel_wall_t], center: false }),
  [tunnel_base_x, tunnel_base_y, tunnel_base_z]
);

// Front wall (end facing run) - with chicken door opening at floor level
const tunnel_front_wall_base = translate(
  cube({ size: [tunnel_wall_t, tunnel_width, tunnel_height], center: false }),
  [tunnel_base_x + tunnel_length - tunnel_wall_t, tunnel_base_y, tunnel_base_z]
);
// Chicken door opening - centered, at floor level, sized for chickens to walk through
const chicken_door_width = 350;  // Wide enough for chickens
const chicken_door_height = 400; // Tall enough for chickens
const tunnel_chicken_door = translate(
  cube({ size: [tunnel_wall_t + 2, chicken_door_width, chicken_door_height], center: false }),
  [tunnel_base_x + tunnel_length - tunnel_wall_t - 1, tunnel_base_y + tunnel_width / 2 - chicken_door_width / 2, tunnel_base_z + tunnel_wall_t]
);
const tunnel_front_wall = difference(tunnel_front_wall_base, tunnel_chicken_door);

// Left wall - with large hinged access door for humans (feeding access)
const tunnel_left_wall_base = translate(
  cube({ size: [tunnel_length, tunnel_wall_t, tunnel_height], center: false }),
  [tunnel_base_x, tunnel_base_y, tunnel_base_z]
);
// Large door opening - almost full wall for easy access
const tunnel_access_door_width = tunnel_length - 100;  // Leave 50mm frame on each side
const tunnel_access_door_height = tunnel_height - 80;  // Leave frame at top and bottom
const tunnel_access_door_cutout = translate(
  cube({ size: [tunnel_access_door_width, tunnel_wall_t + 2, tunnel_access_door_height], center: false }),
  [tunnel_base_x + 50, tunnel_base_y - 1, tunnel_base_z + 40]
);
const tunnel_left_wall = difference(tunnel_left_wall_base, tunnel_access_door_cutout);

// Hinged access door panel - proper 4-panel door using door_panel()
// Mirror in X so handle is on free edge (hinge is at X=0 for this door)
const tunnel_door_parts = door_panel(tunnel_access_door_width, tunnel_access_door_height, tunnel_wall_t);
const tunnel_door_body_mirrored = translate(scale(tunnel_door_parts.body, [-1, 1, 1]), [tunnel_access_door_width, 0, 0]);
const tunnel_door_hw_mirrored = translate(scale(tunnel_door_parts.hardware, [-1, 1, 1]), [tunnel_access_door_width, 0, 0]);
const tunnel_access_door_body = translate(
  rotate(
    tunnel_door_body_mirrored,
    [0, 0, -tunnel_door_angle]  // Swing outward based on parameter
  ),
  [tunnel_base_x + 50, tunnel_base_y, tunnel_base_z + 40]
);
const tunnel_access_door_hardware = translate(
  rotate(
    tunnel_door_hw_mirrored,
    [0, 0, -tunnel_door_angle]
  ),
  [tunnel_base_x + 50, tunnel_base_y, tunnel_base_z + 40]
);

// Door frame/casing around tunnel access opening
const tad_frame_w = 40;          // Width of frame pieces
const tad_frame_d = 15;          // Depth (how much it stands proud)
const tad_frame_reveal = 3;      // Gap between frame and door edge
const tad_opening_w = tunnel_access_door_width + 2 * tad_frame_reveal;
const tad_opening_h = tunnel_access_door_height + tad_frame_reveal;
const tad_frame_x = tunnel_base_x + 50 - tad_frame_reveal;
const tad_frame_y = tunnel_base_y - tad_frame_d;
const tad_frame_z = tunnel_base_z + 40;

const tunnel_door_frame_parts = [];
// Left jamb
tunnel_door_frame_parts.push(translate(
  cube({ size: [tad_frame_w, tad_frame_d, tad_opening_h + tad_frame_w], center: false }),
  [tad_frame_x - tad_frame_w, tad_frame_y, tad_frame_z]
));
// Right jamb
tunnel_door_frame_parts.push(translate(
  cube({ size: [tad_frame_w, tad_frame_d, tad_opening_h + tad_frame_w], center: false }),
  [tad_frame_x + tad_opening_w, tad_frame_y, tad_frame_z]
));
// Head (top piece)
tunnel_door_frame_parts.push(translate(
  cube({ size: [tad_opening_w + 2 * tad_frame_w, tad_frame_d, tad_frame_w], center: false }),
  [tad_frame_x - tad_frame_w, tad_frame_y, tad_frame_z + tad_opening_h]
));
// Threshold/sill
const tad_threshold_h = 12;
tunnel_door_frame_parts.push(translate(
  cube({ size: [tad_opening_w + 2 * tad_frame_w, tad_frame_d + 10, tad_threshold_h], center: false }),
  [tad_frame_x - tad_frame_w, tad_frame_y - 5, tad_frame_z - tad_threshold_h]
));
const tunnel_door_frame = union(...tunnel_door_frame_parts);

// Right wall - with window cutout
const tunnel_right_wall_base = translate(
  cube({ size: [tunnel_length, tunnel_wall_t, tunnel_height], center: false }),
  [tunnel_base_x, tunnel_base_y + tunnel_width - tunnel_wall_t, tunnel_base_z]
);
const tunnel_right_window = translate(
  cube({ size: [tunnel_length - 2 * tunnel_window_inset, tunnel_wall_t + 2, tunnel_window_height], center: false }),
  [tunnel_base_x + tunnel_window_inset, tunnel_base_y + tunnel_width - tunnel_wall_t - 1, tunnel_base_z + 100]
);
const tunnel_right_wall = difference(tunnel_right_wall_base, tunnel_right_window);

// Tunnel roof - two pitched panels meeting at ridge
const tunnel_rise = (tunnel_width / 2) * Math.tan(tunnel_roof_pitch * Math.PI / 180);
const tunnel_roof_panel_width = Math.sqrt(Math.pow(tunnel_width / 2, 2) + Math.pow(tunnel_rise, 2));
const tunnel_peak_z = tunnel_base_z + tunnel_height + tunnel_rise;

// Left roof panel - slopes down from peak toward front (Y=tunnel_base_y)
const tunnel_roof_left = translate(
  rotate(
    translate(
      cube({ size: [tunnel_length, tunnel_roof_panel_width, tunnel_roof_t], center: false }),
      [0, -tunnel_roof_panel_width, 0]  // Move so rotation pivot is at far edge
    ),
    [tunnel_roof_pitch, 0, 0]
  ),
  [tunnel_base_x, tunnel_base_y + tunnel_width / 2, tunnel_peak_z]
);

// Right roof panel - slopes down from peak toward back (Y=tunnel_base_y + tunnel_width)
const tunnel_roof_right = translate(
  rotate(
    cube({ size: [tunnel_length, tunnel_roof_panel_width, tunnel_roof_t], center: false }),
    [-tunnel_roof_pitch, 0, 0]
  ),
  [tunnel_base_x, tunnel_base_y + tunnel_width / 2, tunnel_peak_z]
);

// Gable end panel at run-facing end of tunnel (closes the triangular opening)
// Build as horizontal slices that narrow toward the peak (like createGableMesh but solid)
const tunnel_gable_parts = [];
const tunnel_gable_x = tunnel_base_x + tunnel_length - tunnel_wall_t;
const tunnel_gable_base_z = tunnel_base_z + tunnel_height;
const tunnel_gable_slice_h = 20;  // Slice thickness
const tunnel_gable_num_slices = Math.ceil(tunnel_rise / tunnel_gable_slice_h);
for (let i = 0; i < tunnel_gable_num_slices; i++) {
  const z = i * tunnel_gable_slice_h;
  const next_z = Math.min((i + 1) * tunnel_gable_slice_h, tunnel_rise);
  const slice_h = next_z - z;
  // Width narrows linearly from tunnel_width at base to 0 at peak
  const width_at_z = tunnel_width * (1 - z / tunnel_rise);
  const offset = (tunnel_width - width_at_z) / 2;
  if (width_at_z > 0 && slice_h > 0) {
    tunnel_gable_parts.push(translate(
      cube({ size: [tunnel_wall_t, width_at_z, slice_h], center: false }),
      [tunnel_gable_x, tunnel_base_y + offset, tunnel_gable_base_z + z]
    ));
  }
}
const tunnel_gable_end = tunnel_gable_parts.length > 0 ? union(...tunnel_gable_parts) : null;

// Combine tunnel walls, roof, and wall passthrough sleeve
const tunnel_walls = union(tunnel_floor, tunnel_front_wall, tunnel_left_wall, tunnel_right_wall,
  wall_passthrough,
  ...(tunnel_gable_end ? [tunnel_gable_end] : []));
const tunnel_roof = union(tunnel_roof_left, tunnel_roof_right);

// Corner framing posts at tunnel corners (visible structural detail)
const tunnel_post_sec = 38;  // 38x38mm posts
const tunnel_corner_posts = [];
const tunnel_post_positions = [
  [tunnel_base_x, tunnel_base_y, tunnel_base_z],
  [tunnel_base_x, tunnel_base_y + tunnel_width - tunnel_post_sec, tunnel_base_z],
  [tunnel_base_x + tunnel_length - tunnel_post_sec, tunnel_base_y, tunnel_base_z],
  [tunnel_base_x + tunnel_length - tunnel_post_sec, tunnel_base_y + tunnel_width - tunnel_post_sec, tunnel_base_z]
];
for (const pos of tunnel_post_positions) {
  tunnel_corner_posts.push(translate(
    cube({ size: [tunnel_post_sec, tunnel_post_sec, tunnel_height], center: false }),
    pos
  ));
}
const tunnel_posts = union(...tunnel_corner_posts);

// Interior shelf/platform for feeder and waterer
const shelf_thickness = 18;
const shelf_width = tunnel_width - 2 * tunnel_wall_t - 2 * tunnel_post_sec;
const shelf_depth = 500;  // Extends partway along tunnel length
const shelf_height = 50;  // Raised platform 50mm above tunnel floor
const tunnel_shelf = translate(
  cube({ size: [shelf_depth, shelf_width, shelf_thickness], center: false }),
  [tunnel_base_x + tunnel_length - tunnel_wall_t - shelf_depth - tunnel_post_sec,
   tunnel_base_y + tunnel_wall_t + tunnel_post_sec,
   tunnel_base_z + tunnel_wall_t + shelf_height]
);

// Chicken door frame on front wall of tunnel
const cdf_frame_w = 30;          // Width of frame pieces
const cdf_frame_d = 12;          // Depth (stands proud of wall)
const cdf_frame_parts = [];
// Left jamb
cdf_frame_parts.push(translate(
  cube({ size: [cdf_frame_d, cdf_frame_w, chicken_door_height], center: false }),
  [tunnel_base_x + tunnel_length - tunnel_wall_t - cdf_frame_d,
   tunnel_base_y + tunnel_width / 2 - chicken_door_width / 2 - cdf_frame_w,
   tunnel_base_z + tunnel_wall_t]
));
// Right jamb
cdf_frame_parts.push(translate(
  cube({ size: [cdf_frame_d, cdf_frame_w, chicken_door_height], center: false }),
  [tunnel_base_x + tunnel_length - tunnel_wall_t - cdf_frame_d,
   tunnel_base_y + tunnel_width / 2 + chicken_door_width / 2,
   tunnel_base_z + tunnel_wall_t]
));
// Head (top piece)
cdf_frame_parts.push(translate(
  cube({ size: [cdf_frame_d, chicken_door_width + 2 * cdf_frame_w, cdf_frame_w], center: false }),
  [tunnel_base_x + tunnel_length - tunnel_wall_t - cdf_frame_d,
   tunnel_base_y + tunnel_width / 2 - chicken_door_width / 2 - cdf_frame_w,
   tunnel_base_z + tunnel_wall_t + chicken_door_height]
));
const chicken_door_frame = union(...cdf_frame_parts);

// Extended skid for tunnel support
const tunnel_skid = translate(
  cube({ size: [tunnel_length, skid_sec[0], skid_sec[1]], center: false }),
  [tunnel_base_x, tunnel_base_y + tunnel_width / 2 - skid_sec[0] / 2, paver_size[2]]
);

// ============================================================================
// ATTACHED RUN STRUCTURE
// ============================================================================

const run_length = 4000;  // Run extends along X axis from tunnel
const run_width = 3000;   // Run width along Y axis
const run_height = 2000;  // Run height (to eaves)
const post_sec = [98, 98]; // Run posts cross-section

// Run position - near posts overlap with tunnel end so mesh aligns with tunnel front wall
const run_base_x = tunnel_base_x + tunnel_length - post_sec[0] / 2;
const run_base_y = tunnel_base_y + tunnel_width / 2 - run_width / 2;
const run_base_z = paver_size[2];

// Corner posts
const run_posts = [];
const run_post_positions = [
  [run_base_x, run_base_y, run_base_z],
  [run_base_x, run_base_y + run_width - post_sec[1], run_base_z],
  [run_base_x + run_length - post_sec[0], run_base_y, run_base_z],
  [run_base_x + run_length - post_sec[0], run_base_y + run_width - post_sec[1], run_base_z]
];
for (const pos of run_post_positions) {
  run_posts.push(translate(
    cube({ size: [post_sec[0], post_sec[1], run_height], center: false }),
    pos
  ));
}

// Top rails connecting posts
const run_top_rails = [];
// Front and back rails (along X)
run_top_rails.push(translate(
  cube({ size: [run_length, post_sec[1], post_sec[0]], center: false }),
  [run_base_x, run_base_y, run_base_z + run_height - post_sec[0]]
));
run_top_rails.push(translate(
  cube({ size: [run_length, post_sec[1], post_sec[0]], center: false }),
  [run_base_x, run_base_y + run_width - post_sec[1], run_base_z + run_height - post_sec[0]]
));
// Left and right rails (along Y)
run_top_rails.push(translate(
  cube({ size: [post_sec[0], run_width, post_sec[1]], center: false }),
  [run_base_x, run_base_y, run_base_z + run_height - post_sec[0]]
));
run_top_rails.push(translate(
  cube({ size: [post_sec[0], run_width, post_sec[1]], center: false }),
  [run_base_x + run_length - post_sec[0], run_base_y, run_base_z + run_height - post_sec[0]]
));

// Lower rails (for mesh attachment)
const run_lower_rails = [];
const lower_rail_z = run_base_z + 100;
// Front and back
run_lower_rails.push(translate(
  cube({ size: [run_length, post_sec[1] / 2, post_sec[0] / 2], center: false }),
  [run_base_x, run_base_y, lower_rail_z]
));
run_lower_rails.push(translate(
  cube({ size: [run_length, post_sec[1] / 2, post_sec[0] / 2], center: false }),
  [run_base_x, run_base_y + run_width - post_sec[1] / 2, lower_rail_z]
));

// Gate opening - in front left corner
const gate_width = 900;
const gate_post = translate(
  cube({ size: [post_sec[0], post_sec[1], run_height], center: false }),
  [run_base_x + gate_width, run_base_y, run_base_z]
);

// Gate top beam
const gate_beam = translate(
  cube({ size: [gate_width, post_sec[1], post_sec[0]], center: false }),
  [run_base_x, run_base_y, run_base_z + run_height - post_sec[0]]
);

// Run roof - A-frame structure (matching OpenSCAD approach)
const run_roof_pitch = 30;
const half_width = run_width / 2;
const rise = half_width * Math.tan(run_roof_pitch * Math.PI / 180);
const beam_size = 48; // Match OpenSCAD beam cross-section
const beam_length = Math.sqrt(half_width * half_width + rise * rise);
const beam_angle = Math.atan2(rise, half_width) * 180 / Math.PI;
const post_top_z = run_base_z + run_height;
const beam_base_z = post_top_z - beam_size;
const ridge_z = post_top_z + rise;
const beam_spacing = 1000;

// Ridge beam running along length at peak
const ridge_beam = translate(
  cube({ size: [run_length + 50, beam_size, beam_size], center: false }),
  [run_base_x, run_base_y + half_width - beam_size / 2, ridge_z - beam_size]
);

// A-frame diagonal beams - proper triangular A-frames meeting at ridge
// Mirror around the run's centerline (Y = run_base_y + half_width)
const run_center_y = run_base_y + half_width;
const run_rafters = [];
for (let x_offset = 0; x_offset <= run_length; x_offset += beam_spacing) {
  const x = run_base_x + x_offset;
  const x_clamped = Math.min(x, run_base_x + run_length - beam_size);

  // LEFT rafter - starts at front rail, goes UP to ridge
  let left_beam = cube({ size: [beam_size, beam_length, beam_size], center: false });
  left_beam = translate(left_beam, [0, -beam_size / 2, 0]);
  left_beam = rotate(left_beam, [beam_angle, 0, 0]);
  left_beam = translate(left_beam, [0, beam_size / 2, 0]);
  left_beam = translate(left_beam, [x_clamped, run_base_y, beam_base_z]);

  // RIGHT rafter - mirror left beam around the run's centerline
  let right_beam = cube({ size: [beam_size, beam_length, beam_size], center: false });
  right_beam = translate(right_beam, [0, -beam_size / 2, 0]);
  right_beam = rotate(right_beam, [beam_angle, 0, 0]);
  right_beam = translate(right_beam, [0, beam_size / 2, 0]);
  right_beam = translate(right_beam, [x_clamped, run_base_y, beam_base_z]);
  // Move to center the run at Y=0, mirror, then move back
  right_beam = translate(right_beam, [0, -run_center_y, 0]);
  right_beam = scale(right_beam, [1, -1, 1]);
  right_beam = translate(right_beam, [0, run_center_y, 0]);

  run_rafters.push(left_beam, right_beam);
}

// Export individual run components for step-by-step assembly
// Corner posts as separate union (4 posts)
const run_corner_posts = union(...run_posts);

// Gate post (single post at gate opening)
const run_gate_post = gate_post;

// Top rails connecting posts (all 4 rails)
const run_top_rails_combined = union(...run_top_rails);

// Lower rails for mesh attachment
const run_lower_rails_combined = union(...run_lower_rails);

// Gate top beam
const run_gate_beam = gate_beam;

// Ridge beam at roof peak
const run_ridge_beam = ridge_beam;

// A-frame rafters (all paired rafters)
const run_roof_rafters_combined = union(...run_rafters);

// Full frame for backwards compatibility
const run_frame = union(
  ...run_posts, ...run_top_rails, ...run_lower_rails,
  gate_post, gate_beam, ridge_beam, ...run_rafters
);

// ============================================================================
// HARDWARE CLOTH WALLS - Wire frame showing mesh enclosure boundaries
// ============================================================================

// Wire mesh grid - visible frame with horizontal/vertical wires
const wire_diameter = 6;  // Individual wire thickness
const wire_spacing = 50;  // Dense grid spacing for realistic hardware cloth look
const mesh_bottom_z = lower_rail_z + post_sec[0] / 2;
const mesh_top_z = run_base_z + run_height - post_sec[0];
const mesh_height = mesh_top_z - mesh_bottom_z;

// Helper to create a wire mesh grid for a wall panel
function createWireMesh(width, height, thickness, orientation) {
  // orientation: 'xz' for front/back walls, 'yz' for side walls, 'xy' for roof
  const wires = [];

  if (orientation === 'xz') {
    // Horizontal wires (along X)
    const numHorizontal = Math.floor(height / wire_spacing);
    for (let i = 0; i <= numHorizontal; i++) {
      const z = i * wire_spacing;
      if (z <= height) {
        wires.push(translate(
          cube({ size: [width, thickness, wire_diameter], center: false }),
          [0, 0, z]
        ));
      }
    }
    // Vertical wires (along Z)
    const numVertical = Math.floor(width / wire_spacing);
    for (let i = 0; i <= numVertical; i++) {
      const x = i * wire_spacing;
      if (x <= width) {
        wires.push(translate(
          cube({ size: [wire_diameter, thickness, height], center: false }),
          [x, 0, 0]
        ));
      }
    }
  } else if (orientation === 'yz') {
    // YZ orientation - horizontal wires (along Y)
    const numHorizontal = Math.floor(height / wire_spacing);
    for (let i = 0; i <= numHorizontal; i++) {
      const z = i * wire_spacing;
      if (z <= height) {
        wires.push(translate(
          cube({ size: [thickness, width, wire_diameter], center: false }),
          [0, 0, z]
        ));
      }
    }
    // Vertical wires (along Z)
    const numVertical = Math.floor(width / wire_spacing);
    for (let i = 0; i <= numVertical; i++) {
      const y = i * wire_spacing;
      if (y <= width) {
        wires.push(translate(
          cube({ size: [thickness, wire_diameter, height], center: false }),
          [0, y, 0]
        ));
      }
    }
  } else if (orientation === 'xy') {
    // XY orientation for roof - horizontal mesh
    // Wires along X axis
    const numAlongY = Math.floor(height / wire_spacing);  // height = depth in this case
    for (let i = 0; i <= numAlongY; i++) {
      const y = i * wire_spacing;
      if (y <= height) {
        wires.push(translate(
          cube({ size: [width, wire_diameter, thickness], center: false }),
          [0, y, 0]
        ));
      }
    }
    // Wires along Y axis
    const numAlongX = Math.floor(width / wire_spacing);
    for (let i = 0; i <= numAlongX; i++) {
      const x = i * wire_spacing;
      if (x <= width) {
        wires.push(translate(
          cube({ size: [wire_diameter, height, thickness], center: false }),
          [x, 0, 0]
        ));
      }
    }
  }

  return wires.length > 0 ? union(...wires) : cube({ size: [1, 1, 1], center: false });
}

// Front wall mesh (south side) - sections around gate opening
// Main section: from gate post to far right corner (full height)
const front_width = run_length - gate_width - post_sec[0] * 2;
const run_mesh_front = translate(
  createWireMesh(front_width, mesh_height, wire_diameter, 'xz'),
  [run_base_x + gate_width + post_sec[0], run_base_y + post_sec[1] / 2 - wire_diameter / 2, mesh_bottom_z]
);

// Above gate section: mesh above the gate beam
const gate_beam_top_z = run_base_z + run_height - post_sec[0];
const above_gate_height = mesh_top_z - gate_beam_top_z;
const run_mesh_front_above_gate = above_gate_height > 0 ? translate(
  createWireMesh(gate_width - post_sec[0], above_gate_height, wire_diameter, 'xz'),
  [run_base_x + post_sec[0], run_base_y + post_sec[1] / 2 - wire_diameter / 2, gate_beam_top_z]
) : null;

// Back wall mesh (north side) - full length
const back_width = run_length - post_sec[0] * 2;
const run_mesh_back = translate(
  createWireMesh(back_width, mesh_height, wire_diameter, 'xz'),
  [run_base_x + post_sec[0], run_base_y + run_width - post_sec[1] / 2 - wire_diameter / 2, mesh_bottom_z]
);

// Right wall mesh (east side) - full width
const right_width = run_width - post_sec[1] * 2;
const run_mesh_right = translate(
  createWireMesh(right_width, mesh_height, wire_diameter, 'yz'),
  [run_base_x + run_length - post_sec[0] / 2 - wire_diameter / 2, run_base_y + post_sec[1], mesh_bottom_z]
);

// Left wall mesh (west side) - sections around chicken door opening only
// Only cut mesh for the small chicken door (not the entire tunnel face)
const left_width = run_width - post_sec[1] * 2;
const mesh_x_left = run_base_x + post_sec[0] / 2 - wire_diameter / 2;

// Chicken door position relative to run base Y
const chicken_door_center_y = tunnel_base_y + tunnel_width / 2 - run_base_y;
const chicken_door_start_y = chicken_door_center_y - chicken_door_width / 2;
const chicken_door_end_y = chicken_door_start_y + chicken_door_width;
const chicken_door_top_z = tunnel_base_z + tunnel_wall_t + chicken_door_height;

// Top section - full width, above the chicken door
const left_top_height = mesh_top_z - chicken_door_top_z;
const run_mesh_left_top = left_top_height > 0 ? translate(
  createWireMesh(left_width, left_top_height, wire_diameter, 'yz'),
  [mesh_x_left, run_base_y + post_sec[1], chicken_door_top_z]
) : null;

// Bottom section - full width, below the chicken door (from mesh bottom to tunnel floor)
const left_bottom_height = (tunnel_base_z + tunnel_wall_t) - mesh_bottom_z;
const run_mesh_left_bottom = left_bottom_height > 0 ? translate(
  createWireMesh(left_width, left_bottom_height, wire_diameter, 'yz'),
  [mesh_x_left, run_base_y + post_sec[1], mesh_bottom_z]
) : null;

// Middle-left section (from front post to chicken door opening, at door height)
const mid_height = chicken_door_height;
const front_lower_width = chicken_door_start_y - post_sec[1];
const run_mesh_left_front_lower = front_lower_width > 0 ? translate(
  createWireMesh(front_lower_width, mid_height, wire_diameter, 'yz'),
  [mesh_x_left, run_base_y + post_sec[1], tunnel_base_z + tunnel_wall_t]
) : null;

// Middle-right section (from chicken door opening to back post, at door height)
const back_lower_start = chicken_door_end_y;
const back_lower_width = run_width - post_sec[1] - back_lower_start;
const run_mesh_left_back_lower = back_lower_width > 0 ? translate(
  createWireMesh(back_lower_width, mid_height, wire_diameter, 'yz'),
  [mesh_x_left, run_base_y + back_lower_start, tunnel_base_z + tunnel_wall_t]
) : null;

// Roof mesh - two sloped panels following the A-frame roof structure
// Copy exact rotation approach used for rafters
const roof_mesh_x_start = run_base_x + post_sec[0];
const roof_mesh_len = run_length - post_sec[0] * 2;

// LEFT (front) roof mesh - same rotation as left rafters
let left_roof_mesh = createWireMesh(roof_mesh_len, beam_length, wire_diameter, 'xy');
left_roof_mesh = translate(left_roof_mesh, [0, -wire_diameter / 2, 0]);  // Center on Y
left_roof_mesh = rotate(left_roof_mesh, [beam_angle, 0, 0]);  // Same angle as rafters
left_roof_mesh = translate(left_roof_mesh, [0, wire_diameter / 2, 0]);  // Uncenter
const run_mesh_roof_left = translate(left_roof_mesh, [roof_mesh_x_start, run_base_y, beam_base_z]);

// RIGHT (back) roof mesh - mirror the left mesh around run center (same as right rafters)
let right_roof_mesh = createWireMesh(roof_mesh_len, beam_length, wire_diameter, 'xy');
right_roof_mesh = translate(right_roof_mesh, [0, -wire_diameter / 2, 0]);
right_roof_mesh = rotate(right_roof_mesh, [beam_angle, 0, 0]);
right_roof_mesh = translate(right_roof_mesh, [0, wire_diameter / 2, 0]);
right_roof_mesh = translate(right_roof_mesh, [roof_mesh_x_start, run_base_y, beam_base_z]);
// Mirror around run center
right_roof_mesh = translate(right_roof_mesh, [0, -run_center_y, 0]);
right_roof_mesh = scale(right_roof_mesh, [1, -1, 1]);
right_roof_mesh = translate(right_roof_mesh, [0, run_center_y, 0]);

// Gable end mesh - triangular sections at each end of run
// Gable geometry: triangle from post_top_z up to ridge_z, spanning run_width
const gable_base_z = post_top_z;
const gable_peak_z = ridge_z;
const gable_height = gable_peak_z - gable_base_z;
const gable_base_width = run_width - post_sec[1] * 2;

// Create triangular gable mesh with horizontal wires
function createGableMesh(baseWidth, height, thickness) {
  const wires = [];
  const numHorizontal = Math.floor(height / wire_spacing);

  for (let i = 0; i <= numHorizontal; i++) {
    const z = i * wire_spacing;
    if (z <= height) {
      // Width decreases linearly as we go up
      const widthAtHeight = baseWidth * (1 - z / height);
      const offset = (baseWidth - widthAtHeight) / 2;
      if (widthAtHeight > wire_diameter) {
        wires.push(translate(
          cube({ size: [thickness, widthAtHeight, wire_diameter], center: false }),
          [0, offset, z]
        ));
      }
    }
  }

  // Vertical wires
  const numVertical = Math.floor(baseWidth / wire_spacing);
  for (let i = 0; i <= numVertical; i++) {
    const y = i * wire_spacing;
    // Calculate height at this Y position (triangle shape)
    const distFromCenter = Math.abs(y - baseWidth / 2);
    const maxHeightAtY = height * (1 - distFromCenter / (baseWidth / 2));
    if (maxHeightAtY > wire_diameter) {
      wires.push(translate(
        cube({ size: [thickness, wire_diameter, maxHeightAtY], center: false }),
        [0, y, 0]
      ));
    }
  }

  return wires.length > 0 ? union(...wires) : null;
}

// Right gable (east end of run)
const right_gable_mesh = createGableMesh(gable_base_width, gable_height, wire_diameter);
const run_mesh_gable_right = right_gable_mesh ? translate(
  right_gable_mesh,
  [run_base_x + run_length - post_sec[0] / 2 - wire_diameter / 2, run_base_y + post_sec[1], gable_base_z]
) : null;

// Left gable (west end) - note: this overlaps with tunnel area but above mesh_height it's open
const left_gable_mesh = createGableMesh(gable_base_width, gable_height, wire_diameter);
const run_mesh_gable_left = left_gable_mesh ? translate(
  left_gable_mesh,
  [run_base_x + post_sec[0] / 2 - wire_diameter / 2, run_base_y + post_sec[1], gable_base_z]
) : null;

// Combine all mesh walls including sloped roof panels and gables
const left_wall_parts = [];
if (run_mesh_left_top) left_wall_parts.push(run_mesh_left_top);
if (run_mesh_left_bottom) left_wall_parts.push(run_mesh_left_bottom);
if (run_mesh_left_front_lower) left_wall_parts.push(run_mesh_left_front_lower);
if (run_mesh_left_back_lower) left_wall_parts.push(run_mesh_left_back_lower);
const front_wall_parts = [run_mesh_front];
if (run_mesh_front_above_gate) front_wall_parts.push(run_mesh_front_above_gate);
const gable_parts = [];
if (run_mesh_gable_right) gable_parts.push(run_mesh_gable_right);
if (run_mesh_gable_left) gable_parts.push(run_mesh_gable_left);
const run_mesh_walls = union(...front_wall_parts, run_mesh_back, run_mesh_right, ...left_wall_parts, run_mesh_roof_left, right_roof_mesh, ...gable_parts);

// ============================================================================
// CHICKEN GYM - Multi-level enrichment structure inside run
// ============================================================================

const gym_width = 1500;
const gym_depth = 1000;
const gym_height = 1800;
const gym_stud = 98;
const gym_platform_t = 18;

// Gym position - in the back portion of the run
const gym_base_x = run_base_x + run_length - gym_width - 200;
const gym_base_y = run_base_y + run_width / 2 - gym_depth / 2;
const gym_base_z = run_base_z;

// Main vertical posts
const gym_post_1 = translate(
  cube({ size: [gym_stud, gym_stud, gym_height * 0.85], center: false }),
  [gym_base_x + gym_width * 0.3, gym_base_y + gym_depth * 0.4, gym_base_z]
);
const gym_post_2 = translate(
  cube({ size: [gym_stud, gym_stud, gym_height * 0.7], center: false }),
  [gym_base_x + gym_width * 0.65, gym_base_y + gym_depth * 0.55, gym_base_z]
);
const gym_post_3 = translate(
  cube({ size: [gym_stud, gym_stud, gym_height * 0.95], center: false }),
  [gym_base_x + gym_width * 0.45, gym_base_y + gym_depth * 0.25, gym_base_z]
);

// Platforms at various heights
const gym_platform_1 = translate(
  cube({ size: [400, 350, gym_platform_t], center: false }),
  [gym_base_x + gym_width * 0.3 - 100, gym_base_y + gym_depth * 0.4 - 80, gym_base_z + 400]
);
const gym_platform_2 = translate(
  cube({ size: [380, 380, gym_platform_t], center: false }),
  [gym_base_x + gym_width * 0.65 - 80, gym_base_y + gym_depth * 0.55 - 100, gym_base_z + 480]
);
const gym_platform_3 = translate(
  cube({ size: [420, 320, gym_platform_t], center: false }),
  [gym_base_x + gym_width * 0.45 - 120, gym_base_y + gym_depth * 0.25 - 60, gym_base_z + 720]
);
const gym_platform_4 = translate(
  cube({ size: [360, 340, gym_platform_t], center: false }),
  [gym_base_x + gym_width * 0.3 - 90, gym_base_y + gym_depth * 0.4 - 100, gym_base_z + 1050]
);

// Perches between posts (horizontal bars)
const gym_perch_1 = translate(
  rotate(
    cylinder({ height: gym_width * 0.4, radius: 25, center: false }),
    [0, 90, 0]
  ),
  [gym_base_x + gym_width * 0.3, gym_base_y + gym_depth * 0.4, gym_base_z + 550]
);
const gym_perch_2 = translate(
  rotate(
    cylinder({ height: gym_width * 0.3, radius: 25, center: false }),
    [0, 90, 0]
  ),
  [gym_base_x + gym_width * 0.45, gym_base_y + gym_depth * 0.25, gym_base_z + 850]
);
const gym_perch_3 = translate(
  rotate(
    cylinder({ height: gym_depth * 0.5, radius: 25, center: false }),
    [90, 0, 0]
  ),
  [gym_base_x + gym_width * 0.5, gym_base_y + gym_depth * 0.55 + gym_depth * 0.5, gym_base_z + 1200]
);

// Combine gym structure
const chicken_gym = union(
  gym_post_1, gym_post_2, gym_post_3,
  gym_platform_1, gym_platform_2, gym_platform_3, gym_platform_4,
  gym_perch_1, gym_perch_2, gym_perch_3
);

// ============================================================================
// DECORATIVE BUSHES - around the run
// ============================================================================

// Simple bush approximation using spheres
function bush(size, position) {
  // Create a bush using a large sphere for the main body
  const main = translate(
    sphere({ radius: size * 0.5 }),
    [position[0], position[1], position[2] + size * 0.3]
  );
  return main;
}

// Place bushes around the run
const bush_positions = [
  [run_base_x + 500, run_base_y - 300, run_base_z],
  [run_base_x + run_length - 500, run_base_y - 300, run_base_z],
  [run_base_x + run_length + 200, run_base_y + run_width / 2, run_base_z],
  [run_base_x + run_length - 500, run_base_y + run_width + 300, run_base_z]
];

const bushes = bush_positions.map(pos => bush(400, pos));
const all_bushes = union(...bushes);

// ============================================================================
// FINNISH NATURE - Sipoonkorpi-inspired landscape
// ============================================================================

// Pine tree: trunk + layered cone canopy
function pine_tree(height, trunk_r, position) {
  const trunk = translate(
    cylinder({ height: height * 0.6, radius: trunk_r, center: false }),
    [position[0], position[1], position[2]]
  );
  const layers = [];
  const canopy_base = height * 0.3;
  const canopy_top = height;
  const layer_count = 4;
  for (let i = 0; i < layer_count; i++) {
    const t = i / layer_count;
    const layer_z = canopy_base + (canopy_top - canopy_base) * t;
    const layer_r = height * 0.28 * (1 - t * 0.6);
    const layer_h = (canopy_top - canopy_base) / layer_count * 1.3;
    layers.push(translate(
      cylinder({ height: layer_h, radius: layer_r, radiusTop: layer_r * 0.15, segments: 8, center: false }),
      [position[0], position[1], position[2] + layer_z]
    ));
  }
  return { trunk, canopy: union(...layers) };
}

// Birch tree: white trunk + oval canopy
function birch_tree(height, position) {
  const trunk_r = height * 0.025;
  const trunk = translate(
    cylinder({ height: height * 0.65, radius: trunk_r, center: false }),
    [position[0], position[1], position[2]]
  );
  const canopy_r = height * 0.22;
  const canopy_h = height * 0.55;
  const canopy = translate(
    scale(sphere({ radius: canopy_r }), [1.0, 1.0, canopy_h / canopy_r]),
    [position[0], position[1], position[2] + height * 0.65]
  );
  return { trunk, canopy };
}

// Small spruce: dense conical shape
function spruce(height, position) {
  const trunk = translate(
    cylinder({ height: height * 0.9, radius: height * 0.03, center: false }),
    [position[0], position[1], position[2]]
  );
  const canopy = translate(
    cylinder({ height: height * 0.85, radius: height * 0.3, radiusTop: 0, segments: 8, center: false }),
    [position[0], position[1], position[2] + height * 0.15]
  );
  return { trunk, canopy };
}

// Ground cover: flat rounded moss/grass patches
function ground_patch(radius, position) {
  return translate(
    cylinder({ height: 30, radius: radius, segments: 12, center: false }),
    [position[0], position[1], position[2]]
  );
}

// Place trees around the scene - scattered like a Finnish forest clearing
const coop_center_x = coop_len / 2;
const coop_center_y = coop_w / 2;

// Background pines (well away from coop to avoid roof shadows)
const pine1 = pine_tree(3500, 80, [-4000, coop_center_y + 2500, 0]);
const pine2 = pine_tree(4200, 90, [-4500, coop_center_y - 1500, 0]);
const pine3 = pine_tree(3800, 85, [-3000, -3500, 0]);
const pine4 = pine_tree(4500, 95, [coop_len + 8000, coop_center_y + 3500, 0]);
const pine5 = pine_tree(3200, 75, [coop_len + 7500, -2500, 0]);
const pine6 = pine_tree(3900, 85, [-5000, coop_center_y, 0]);
const pine7 = pine_tree(3600, 80, [coop_len + 9000, coop_center_y, 0]);

// Birch trees (lighter, scattered — iconic Finnish landscape)
const birch1 = birch_tree(3800, [-3500, -2500, 0]);
const birch2 = birch_tree(3200, [coop_len + 8500, coop_center_y - 1000, 0]);
const birch3 = birch_tree(4000, [-5500, coop_center_y + 3500, 0]);
const birch4 = birch_tree(3500, [coop_len + 7000, -3000, 0]);
const birch5 = birch_tree(3000, [-3800, coop_center_y + 4000, 0]);

// Small spruces (forest understory, still clear of coop)
const spruce1 = spruce(2200, [-2500, coop_center_y + 4000, 0]);
const spruce2 = spruce(1800, [coop_len + 9500, coop_center_y + 2500, 0]);
const spruce3 = spruce(2000, [-4500, -2000, 0]);

// Collect all tree parts
const all_pine_trunks = union(
  pine1.trunk, pine2.trunk, pine3.trunk, pine4.trunk, pine5.trunk, pine6.trunk, pine7.trunk
);
const all_pine_canopies = union(
  pine1.canopy, pine2.canopy, pine3.canopy, pine4.canopy, pine5.canopy, pine6.canopy, pine7.canopy
);
const all_birch_trunks = union(birch1.trunk, birch2.trunk, birch3.trunk, birch4.trunk, birch5.trunk);
const all_birch_canopies = union(birch1.canopy, birch2.canopy, birch3.canopy, birch4.canopy, birch5.canopy);
const all_spruce_trunks = union(spruce1.trunk, spruce2.trunk, spruce3.trunk);
const all_spruce_canopies = union(spruce1.canopy, spruce2.canopy, spruce3.canopy);

// Ground cover patches (moss, grass, blueberry)
const ground_patches_list = [
  ground_patch(600, [-1500, coop_center_y, 0]),
  ground_patch(800, [coop_len + 4500, coop_center_y + 1000, 0]),
  ground_patch(500, [-2800, coop_center_y + 2000, 0]),
  ground_patch(700, [coop_len + 5500, -800, 0]),
  ground_patch(900, [-1000, -1500, 0]),
  ground_patch(650, [coop_len + 6500, coop_center_y + 2800, 0]),
];
const all_ground_patches = union(...ground_patches_list);

// Stone/boulder accents (Finnish granite)
const boulder1 = translate(
  scale(sphere({ radius: 250 }), [1.3, 1.0, 0.6]),
  [-2500, coop_center_y + 3000, 80]
);
const boulder2 = translate(
  scale(sphere({ radius: 200 }), [1.0, 1.2, 0.5]),
  [coop_len + 7000, -1500, 60]
);
const boulder3 = translate(
  scale(sphere({ radius: 280 }), [1.1, 0.9, 0.55]),
  [-3500, -1800, 90]
);
const boulder4 = translate(
  scale(sphere({ radius: 160 }), [1.2, 1.1, 0.5]),
  [coop_len + 8000, coop_center_y + 2000, 50]
);
const all_boulders = union(boulder1, boulder2, boulder3, boulder4);

// Gravel path leading to the door
const path_width = 600;
const path1 = translate(
  cube({ size: [path_width, 3000, 15], center: false }),
  [-2500, coop_center_y - path_width / 2, 0]
);
const all_paths = path1;

// Log pile (firewood stack — very Finnish)
function log_row(count, log_r, log_len, base_pos) {
  const logs = [];
  for (let i = 0; i < count; i++) {
    logs.push(translate(
      rotate(
        cylinder({ height: log_len, radius: log_r, segments: 8, center: false }),
        [0, 90, 0]
      ),
      [base_pos[0], base_pos[1] + i * log_r * 2.1, base_pos[2] + log_r]
    ));
  }
  return union(...logs);
}
const log_stack_row1 = log_row(5, 60, 500, [-1800, coop_center_y - 400, 0]);
const log_stack_row2 = log_row(4, 60, 500, [-1800, coop_center_y - 400 + 63, 130]);
const log_stack = union(log_stack_row1, log_stack_row2);

// ============================================================================
// TUNNEL SKIRTING - Covers tunnel foundation
// ============================================================================

// Front skirting starts at tunnel_base_x (outer cladding face)
const tunnel_skirting_front_x = tunnel_base_x;
const tunnel_skirting_front = translate(
  cube({ size: [skirting_t, tunnel_width, floor_stack], center: false }),
  [tunnel_skirting_front_x, tunnel_base_y, 0]
);
const tunnel_skirting_back = translate(
  cube({ size: [skirting_t, tunnel_width, floor_stack], center: false }),
  [tunnel_base_x + tunnel_length, tunnel_base_y, 0]
);
// Left/right skirting starts at outer cladding face, not inside the wall
const tunnel_skirting_len = tunnel_base_x + tunnel_length - tunnel_skirting_front_x;
const tunnel_skirting_left = translate(
  cube({ size: [tunnel_skirting_len, skirting_t, floor_stack], center: false }),
  [tunnel_skirting_front_x, tunnel_base_y - skirting_t, 0]
);
const tunnel_skirting_right = translate(
  cube({ size: [tunnel_skirting_len, skirting_t, floor_stack], center: false }),
  [tunnel_skirting_front_x, tunnel_base_y + tunnel_width, 0]
);
const tunnel_skirting = union(tunnel_skirting_front, tunnel_skirting_back, tunnel_skirting_left, tunnel_skirting_right);

// ============================================================================
// FEEDER AND WATERER - Inside viewing tunnel
// ============================================================================

// Feeder - compact gravity feeder with tray and stand
function chicken_feeder(diameter = 180, height = 240) {
  const hopper = translate(
    cylinder({ height: height * 0.65, radius: diameter * 0.27, center: false }),
    [0, 0, height * 0.33]
  );
  const tray = cylinder({ height: height * 0.12, radius: diameter * 0.45, center: false });
  const stand = translate(
    cylinder({ height: height * 0.25, radius: diameter * 0.11, center: false }),
    [0, 0, height * 0.08]
  );
  return union(hopper, tray, stand);
}

// Waterer - compact bell waterer with trough and stand
function chicken_waterer(diameter = 170, height = 220) {
  const reservoir = translate(
    cylinder({ height: height * 0.58, radius: diameter * 0.25, center: false }),
    [0, 0, height * 0.34]
  );
  const trough = cylinder({ height: height * 0.12, radius: diameter * 0.42, center: false });
  const stand = translate(
    cylinder({ height: height * 0.24, radius: diameter * 0.1, center: false }),
    [0, 0, height * 0.1]
  );
  return union(reservoir, trough, stand);
}

// Position feeder and waterer in tunnel
const shelf_x = tunnel_base_x + tunnel_length - tunnel_wall_t - shelf_depth - tunnel_post_sec;
const shelf_y = tunnel_base_y + tunnel_wall_t + tunnel_post_sec;
const shelf_z = tunnel_base_z + tunnel_wall_t + shelf_height + shelf_thickness;

const feeder = translate(
  chicken_feeder(180, 240),
  [shelf_x + shelf_depth * 0.64, shelf_y + shelf_width * 0.36, shelf_z]
);
const waterer = translate(
  chicken_waterer(170, 220),
  [shelf_x + shelf_depth * 0.35, shelf_y + shelf_width * 0.72, shelf_z]
);

// ============================================================================
// RUN GATE - Hinged gate panel
// ============================================================================

const gate_height = 1800;
const gate_frame_w = 48;

// Gate frame
const gate_left_stile = translate(
  cube({ size: [gate_frame_w, gate_frame_w, gate_height], center: false }),
  [run_base_x, run_base_y - gate_frame_w, run_base_z]
);
const gate_right_stile = translate(
  cube({ size: [gate_frame_w, gate_frame_w, gate_height], center: false }),
  [run_base_x + gate_width - gate_frame_w, run_base_y - gate_frame_w, run_base_z]
);
const gate_top_rail = translate(
  cube({ size: [gate_width, gate_frame_w, gate_frame_w], center: false }),
  [run_base_x, run_base_y - gate_frame_w, run_base_z + gate_height - gate_frame_w]
);
const gate_bottom_rail = translate(
  cube({ size: [gate_width, gate_frame_w, gate_frame_w], center: false }),
  [run_base_x, run_base_y - gate_frame_w, run_base_z]
);
const gate_mid_rail = translate(
  cube({ size: [gate_width, gate_frame_w, gate_frame_w], center: false }),
  [run_base_x, run_base_y - gate_frame_w, run_base_z + gate_height / 2]
);

// Combine gate frame, then apply rotation based on run_gate_angle parameter
// Gate hinges on left edge, swings outward (negative Y direction)
const run_gate_frame = union(gate_left_stile, gate_right_stile, gate_top_rail, gate_bottom_rail, gate_mid_rail);
const run_gate = translate(
  rotate(
    translate(run_gate_frame, [-run_base_x, -run_base_y + gate_frame_w, -run_base_z]),  // Move to origin for rotation
    [0, 0, -run_gate_angle]  // Swing outward
  ),
  [run_base_x, run_base_y - gate_frame_w, run_base_z]  // Move back to position
);

// ============================================================================
// RUN ROOF - Ridge beam only (rafters disabled - too complex for now)
// ============================================================================

// The ridge beam is already in run_frame, no additional rafters needed
// Just create a dummy object for the rafters variable
const run_roof_rafters = cube({ size: [1, 1, 1], center: false });

// ============================================================================
// CHICKENS - Parametric chicken models
// ============================================================================

// Simple chicken model using basic primitives
function chicken(scale_factor = 1.0, pose = 0) {
  const s = scale_factor * 100;

  // Body (ellipsoid approximated by scaled sphere)
  const body = translate(
    sphere({ radius: s * 0.4 }),
    [0, 0, s * 0.5]
  );

  // Head
  const head = translate(
    sphere({ radius: s * 0.15 }),
    [s * 0.35, 0, s * 0.75]
  );

  // Beak (small cone approximated by cylinder)
  const beak = translate(
    rotate(
      cylinder({ height: s * 0.12, radius: s * 0.04, center: false }),
      [0, 90, 0]
    ),
    [s * 0.45, 0, s * 0.72]
  );

  // Comb (on top of head)
  const comb = translate(
    cube({ size: [s * 0.08, s * 0.03, s * 0.12], center: true }),
    [s * 0.32, 0, s * 0.88]
  );

  // Tail
  const tail = translate(
    rotate(
      cube({ size: [s * 0.15, s * 0.08, s * 0.35], center: true }),
      [30, 0, 0]
    ),
    [-s * 0.35, 0, s * 0.65]
  );

  // Legs (two cylinders)
  const leg1 = translate(
    cylinder({ height: s * 0.25, radius: s * 0.03, center: false }),
    [s * 0.05, s * 0.08, 0]
  );
  const leg2 = translate(
    cylinder({ height: s * 0.25, radius: s * 0.03, center: false }),
    [s * 0.05, -s * 0.08, 0]
  );

  return union(body, head, beak, comb, tail, leg1, leg2);
}

// Place chickens around the scene
const chicken_scale = 4.2;

// Chicken in run near entrance
const chicken1 = translate(
  rotate(chicken(chicken_scale, 0), [0, 0, 45]),
  [run_base_x + 600, run_base_y + 800, run_base_z]
);

// Chicken mid-run
const chicken2 = translate(
  rotate(chicken(chicken_scale, 0.1), [0, 0, -120]),
  [run_base_x + run_length * 0.4, run_base_y + run_width * 0.3, run_base_z]
);

// Chicken near gym
const chicken3 = translate(
  rotate(chicken(chicken_scale, 0.4), [0, 0, 200]),
  [run_base_x + run_length * 0.7, run_base_y + run_width * 0.6, run_base_z]
);

// Chicken in viewing tunnel
const chicken4 = translate(
  rotate(chicken(chicken_scale * 0.9, 0.9), [0, 0, -45]),
  [tunnel_base_x + tunnel_length - 320, tunnel_base_y + tunnel_width / 2 - 70, tunnel_base_z + 18]
);

// Chicken at waterer
const chicken5 = translate(
  rotate(chicken(chicken_scale * 0.9, 0.7), [0, 0, 120]),
  [tunnel_base_x + tunnel_length - 560, tunnel_base_y + tunnel_width / 2 + 110, tunnel_base_z + 18]
);

// Chicken on gym platform
const chicken6 = translate(
  rotate(chicken(chicken_scale * 0.9, 0), [0, 0, 90]),
  [gym_base_x + gym_width * 0.4, gym_base_y + gym_depth * 0.4, gym_base_z + 420]
);

// Chicken in nesting box
const chicken7 = translate(
  rotate(chicken(chicken_scale * 0.8, 0), [0, 0, 90]),
  [nest_box_x + nest_spacing + nest_box_w / 2, nest_box_d / 2, floor_stack + 68]
);

// Another in run
const chicken8 = translate(
  rotate(chicken(chicken_scale, 0.6), [0, 0, -30]),
  [run_base_x + run_length * 0.5, run_base_y + run_width * 0.6, run_base_z]
);

// Perched birds for roost ergonomics/readability in architectural shots.
const chicken9 = translate(
  rotate(chicken(chicken_scale * 0.82, 0.3), [0, 0, -90]),
  [coop_len / 2 - door_w / 2 - nest_total_w / 2, stud_sec[1] + 180, lower_roost_h + roost_dia / 2]
);
const chicken10 = translate(
  rotate(chicken(chicken_scale * 0.78, 0.5), [0, 0, 90]),
  [stud_sec[1] + 100 + mid_roost_length * 0.58, coop_w * 0.75, mid_roost_h + roost_dia / 2]
);

// Additional perched birds on chicken-gym bars for interior behavioral reads.
const chicken11 = translate(
  rotate(chicken(chicken_scale * 0.72, 0.2), [0, 0, -90]),
  [gym_base_x + gym_width * 0.3 + gym_width * 0.14, gym_base_y + gym_depth * 0.4 - 25, gym_base_z + 575]
);
const chicken12 = translate(
  rotate(chicken(chicken_scale * 0.70, 0.35), [0, 0, 90]),
  [gym_base_x + gym_width * 0.45 + gym_width * 0.18, gym_base_y + gym_depth * 0.25 + 10, gym_base_z + 875]
);
const chicken13 = translate(
  rotate(chicken(chicken_scale * 0.66, 0.1), [0, 0, 0]),
  [gym_base_x + gym_width * 0.52, gym_base_y + gym_depth * 0.78, gym_base_z + 1225]
);

const all_chickens = union(
  chicken1, chicken2, chicken3, chicken4, chicken5, chicken6, chicken7, chicken8,
  chicken9, chicken10, chicken11, chicken12, chicken13
);

// ============================================================================
// MESH APRON - Predator-proof skirt around run base
// ============================================================================

const apron_width = 400;
const apron_thickness = 5;

// Front apron (extends outward from front of run)
const apron_front = translate(
  cube({ size: [run_length, apron_width, apron_thickness], center: false }),
  [run_base_x, run_base_y - apron_width, run_base_z]
);

// Back apron
const apron_back = translate(
  cube({ size: [run_length, apron_width, apron_thickness], center: false }),
  [run_base_x, run_base_y + run_width, run_base_z]
);

// Left apron (at tunnel end)
const apron_left = translate(
  cube({ size: [apron_width, run_width + 2 * apron_width, apron_thickness], center: false }),
  [run_base_x - apron_width, run_base_y - apron_width, run_base_z]
);

// Right apron (far end)
const apron_right = translate(
  cube({ size: [apron_width, run_width + 2 * apron_width, apron_thickness], center: false }),
  [run_base_x + run_length, run_base_y - apron_width, run_base_z]
);

const mesh_apron = union(apron_front, apron_back, apron_left, apron_right);

// ============================================================================
// L-EXTENSION - Optional L-shaped extension to run
// ============================================================================

const l_extension_enabled = true;
const l_extension_length = 2000;  // Along X from corner
const l_extension_width = 4000;   // Along -Y (extending forward)

// L-extension position - extends from back-right corner of run
const l_junction_x = run_base_x + run_length - l_extension_length;
const l_junction_y = run_base_y;
const l_junction_z = run_base_z;

// L-extension corner posts
const l_posts = [];
if (l_extension_enabled) {
  // Front-left corner (at junction)
  l_posts.push(translate(
    cube({ size: [post_sec[0], post_sec[1], run_height], center: false }),
    [l_junction_x, l_junction_y - l_extension_width, l_junction_z]
  ));

  // Front-right corner
  l_posts.push(translate(
    cube({ size: [post_sec[0], post_sec[1], run_height], center: false }),
    [l_junction_x + l_extension_length - post_sec[0], l_junction_y - l_extension_width, l_junction_z]
  ));

  // Back-right corner (connects to main run)
  l_posts.push(translate(
    cube({ size: [post_sec[0], post_sec[1], run_height], center: false }),
    [l_junction_x + l_extension_length - post_sec[0], l_junction_y - post_sec[1], l_junction_z]
  ));
}

// L-extension top rails
const l_top_rails = [];
if (l_extension_enabled) {
  // Front rail (along X)
  l_top_rails.push(translate(
    cube({ size: [l_extension_length, post_sec[1], post_sec[0]], center: false }),
    [l_junction_x, l_junction_y - l_extension_width, l_junction_z + run_height - post_sec[0]]
  ));

  // Left rail (along Y)
  l_top_rails.push(translate(
    cube({ size: [post_sec[0], l_extension_width, post_sec[1]], center: false }),
    [l_junction_x, l_junction_y - l_extension_width, l_junction_z + run_height - post_sec[0]]
  ));

  // Right rail (along Y, connecting to main run)
  l_top_rails.push(translate(
    cube({ size: [post_sec[0], l_extension_width - post_sec[1], post_sec[1]], center: false }),
    [l_junction_x + l_extension_length - post_sec[0], l_junction_y - l_extension_width + post_sec[1], l_junction_z + run_height - post_sec[0]]
  ));
}

// L-extension ridge beam - DISABLED for now (was flying off)
// The L-extension has different dimensions (4000mm wide) so its ridge would be much higher
// For now, just use posts and rails without a ridge
const l_ridge_rise = (l_extension_width / 2) * Math.tan(run_roof_pitch * Math.PI / 180);
// const l_ridge_beam = ...disabled...

const l_extension_frame = l_extension_enabled ? union(...l_posts, ...l_top_rails) : cube({ size: [1, 1, 1], center: false });

// ============================================================================
// LOUNGE AREA - Table and chairs in L-extension corner
// ============================================================================

const table_diameter = 760;
const table_height = 560;
const chair_spacing = 760;

// Table position - in center of L-extension
const table_x = l_junction_x + l_extension_length / 2;
const table_y = l_junction_y - l_extension_width / 2;
const table_z = l_junction_z;

// Table top with a thin lip for a more furniture-like profile
const table_top = translate(
  cylinder({ height: 28, radius: table_diameter / 2, center: false }),
  [table_x, table_y, table_z + table_height]
);
const table_top_lip = translate(
  cylinder({ height: 18, radius: table_diameter / 2 - 35, center: false }),
  [table_x, table_y, table_z + table_height + 28]
);

// Table pedestal and base ring
const table_pedestal = translate(
  cylinder({ height: table_height, radius: 55, center: false }),
  [table_x, table_y, table_z]
);
const table_base_ring = translate(
  cylinder({ height: 22, radius: 170, center: false }),
  [table_x, table_y, table_z]
);
const table_base_cross = union(
  translate(cube({ size: [300, 36, 24], center: true }), [table_x, table_y, table_z + 12]),
  translate(cube({ size: [36, 300, 24], center: true }), [table_x, table_y, table_z + 12])
);

// Slightly more refined outdoor chair
function make_chair(x, y, z, angle) {
  const seat_w = 430;
  const seat_h = 430;
  const seat_th = 34;
  const leg_r = 16;
  const back_h = 360;
  const back_t = 30;
  const arm_h = 610;

  const seat = translate(
    rotate(
      cube({ size: [seat_w, seat_w - 20, seat_th], center: true }),
      [0, 0, angle]
    ),
    [x, y, z + seat_h + seat_th / 2]
  );

  const seat_support = translate(
    rotate(
      cylinder({ height: 16, radius: 130, center: false }),
      [0, 0, angle]
    ),
    [x, y, z + seat_h - 8]
  );

  const back = translate(
    rotate(
      rotate(
        cube({ size: [seat_w - 30, back_t, back_h], center: true }),
        [10, 0, 0]
      ),
      [0, 0, angle]
    ),
    [x - seat_w * 0.34 * Math.cos(angle * Math.PI / 180),
     y - seat_w * 0.34 * Math.sin(angle * Math.PI / 180),
     z + seat_h + back_h * 0.52]
  );

  const arm_left = translate(
    rotate(cube({ size: [seat_w * 0.82, back_t, 24], center: true }), [0, 0, angle]),
    [x, y - seat_w * 0.23, z + arm_h]
  );
  const arm_right = translate(
    rotate(cube({ size: [seat_w * 0.82, back_t, 24], center: true }), [0, 0, angle]),
    [x, y + seat_w * 0.23, z + arm_h]
  );

  const legs = [];
  for (let i = 0; i < 4; i += 1) {
    const leg_angle = i * 90 + 45;
    const leg_x = x + 145 * Math.cos((angle + leg_angle) * Math.PI / 180);
    const leg_y = y + 128 * Math.sin((angle + leg_angle) * Math.PI / 180);
    legs.push(translate(
      cylinder({ height: seat_h + seat_th, radius: leg_r, center: false }),
      [leg_x, leg_y, z]
    ));
  }
  return union(seat, seat_support, back, arm_left, arm_right, ...legs);
}

// Four chairs around the table
const chair1 = l_extension_enabled ? make_chair(table_x + chair_spacing, table_y, table_z, 180) : cube({ size: [1, 1, 1], center: false });
const chair2 = l_extension_enabled ? make_chair(table_x - chair_spacing, table_y, table_z, 0) : cube({ size: [1, 1, 1], center: false });
const chair3 = l_extension_enabled ? make_chair(table_x, table_y + chair_spacing, table_z, 270) : cube({ size: [1, 1, 1], center: false });
const chair4 = l_extension_enabled ? make_chair(table_x, table_y - chair_spacing, table_z, 90) : cube({ size: [1, 1, 1], center: false });

const lounge_table = l_extension_enabled ? union(table_top, table_top_lip, table_pedestal, table_base_ring, table_base_cross) : cube({ size: [1, 1, 1], center: false });
const lounge_chairs = l_extension_enabled ? union(chair1, chair2, chair3, chair4) : cube({ size: [1, 1, 1], center: false });

// ============================================================================
// LUMBER PILE - Cut wall lumber visualization for assembly step 3
// Shows studs and plates stacked next to the floor deck
// ============================================================================

function build_lumber_pile(num_studs, stud_length, stud_w, stud_h, num_plates, plate_lengths) {
  const pieces = [];
  const gap = 5;  // Small gap between stacked pieces
  const pile_x = -400;  // Position to the left of the building
  const pile_y = 200;
  const pile_z = floor_stack + 50;  // Slightly above floor level (on sawhorses)

  // Stack studs (horizontal pile)
  let stud_z = pile_z;
  let studs_per_layer = 6;
  for (let i = 0; i < Math.min(num_studs, 24); i++) {  // Cap at 24 for visual clarity
    const layer = Math.floor(i / studs_per_layer);
    const pos_in_layer = i % studs_per_layer;
    const x = pile_x;
    const y = pile_y + pos_in_layer * (stud_w + gap);
    const z = stud_z + layer * (stud_h + gap);

    // Stud lying horizontally (length along X)
    const stud = translate(
      cube({ size: [stud_length, stud_w, stud_h], center: false }),
      [x, y, z]
    );
    pieces.push(stud);
  }

  // Stack plates (separate pile, slightly offset)
  const plate_pile_y = pile_y + 600;
  let plate_z = pile_z;
  for (let i = 0; i < plate_lengths.length && i < 8; i++) {  // Cap at 8 plates
    const layer = Math.floor(i / 2);
    const pos_in_layer = i % 2;
    const x = pile_x - 100;  // Offset X a bit
    const y = plate_pile_y + pos_in_layer * (stud_w + gap);
    const z = plate_z + layer * (stud_h + gap);

    // Plate lying horizontally
    const plate = translate(
      cube({ size: [plate_lengths[i], stud_w, stud_h], center: false }),
      [x, y, z]
    );
    pieces.push(plate);
  }

  // Add sawhorses (simple support structure)
  const sawhorse_h = 50;
  const sawhorse_w = 60;
  const sawhorse1 = translate(
    cube({ size: [sawhorse_w, 800, sawhorse_h], center: false }),
    [pile_x + 200, pile_y - 50, floor_stack]
  );
  const sawhorse2 = translate(
    cube({ size: [sawhorse_w, 800, sawhorse_h], center: false }),
    [pile_x + stud_length - 200, pile_y - 50, floor_stack]
  );
  pieces.push(sawhorse1, sawhorse2);

  return union(...pieces);
}

// Calculate lumber pile parameters
const stud_cut_length = wall_h - 2 * stud_sec[0];  // Wall height minus two plates (top and bottom)
const plate_cut_lengths = [
  coop_len,  // Front/back plates
  coop_len,  // Front/back plates
  coop_w - 2 * stud_sec[1],  // Side plates (fit between front/back)
  coop_w - 2 * stud_sec[1]   // Side plates
];

// Build the lumber pile
const lumber_pile = build_lumber_pile(
  wall_studs,        // Number of studs
  stud_cut_length,   // Stud length
  stud_sec[0],       // Stud width (48mm)
  stud_sec[1],       // Stud height (98mm)
  8,                 // Number of plates (4 bottom + 4 top)
  plate_cut_lengths  // Plate lengths
);

// ============================================================================
// WALL ASSEMBLY COMPONENTS - Step-by-step wall construction visualization
// Shows individual components for IKEA-style progressive assembly
// ============================================================================

// Front wall parameters
const front_wall_length = coop_len;
const front_wall_stud_count = Math.floor(front_wall_length / stud_sp) + 1;
const front_stud_height = wall_h - 2 * stud_sec[0];  // Height minus top and bottom plates

// Position for wall assembly (flat on floor deck, in front of building)
const wall_assembly_y = -500;  // In front of the floor deck
const wall_assembly_z = floor_stack + stud_sec[1];  // Lying flat on floor

// Step 1: Bottom plate laid flat on floor deck (ready for marking)
function build_front_bottom_plate() {
  return translate(
    cube({ size: [front_wall_length, stud_sec[0], stud_sec[1]], center: false }),
    [0, wall_assembly_y, floor_stack]
  );
}

// Step 2: Top plate laid parallel to bottom plate (spaced for studs)
function build_front_top_plate() {
  return translate(
    cube({ size: [front_wall_length, stud_sec[0], stud_sec[1]], center: false }),
    [0, wall_assembly_y - front_stud_height - stud_sec[0], floor_stack]
  );
}

// Door opening boundaries (for stud placement)
const door_center_x = front_wall_length / 2;
const door_opening_left = door_center_x - door_w / 2 - stud_sec[0] * 2;  // King stud position
const door_opening_right = door_center_x + door_w / 2 + stud_sec[0];     // After right king stud

// Step 3: Individual studs positioned between plates (laying flat)
// SKIP the door opening area - those studs are part of door framing
function build_front_studs_flat() {
  const studs = [];

  // Always add end studs (required for proper wall framing)
  // Left end stud at x=0
  studs.push(translate(
    cube({ size: [stud_sec[0], front_stud_height, stud_sec[1]], center: false }),
    [0, wall_assembly_y - front_stud_height, floor_stack]
  ));

  // Right end stud at wall end
  studs.push(translate(
    cube({ size: [stud_sec[0], front_stud_height, stud_sec[1]], center: false }),
    [front_wall_length - stud_sec[0], wall_assembly_y - front_stud_height, floor_stack]
  ));

  // Interior studs at regular spacing, skipping door area
  for (let i = 1; i < front_wall_stud_count - 1; i++) {
    const x = i * stud_sp;
    if (x + stud_sec[0] <= front_wall_length - stud_sec[0]) {
      // Skip studs in door opening area (will be handled by door framing)
      if (x >= door_opening_left && x <= door_opening_right) {
        continue;
      }
      // Stud lying flat, spanning from bottom plate to top plate
      const stud = translate(
        cube({ size: [stud_sec[0], front_stud_height, stud_sec[1]], center: false }),
        [x, wall_assembly_y - front_stud_height, floor_stack]
      );
      studs.push(stud);
    }
  }
  return union(...studs);
}

// Step 4: Door header components (king studs, jack studs, header)
function build_door_framing() {
  const pieces = [];
  // door_center_x already defined above
  const king_stud_left_x = door_center_x - door_w / 2 - stud_sec[0];
  const king_stud_right_x = door_center_x + door_w / 2;
  const jack_stud_height = door_h - stud_sec[0];  // Height to bottom of header
  const header_height = front_stud_height - jack_stud_height;

  // King studs (full height, next to door opening)
  pieces.push(translate(
    cube({ size: [stud_sec[0], front_stud_height, stud_sec[1]], center: false }),
    [king_stud_left_x, wall_assembly_y - front_stud_height, floor_stack]
  ));
  pieces.push(translate(
    cube({ size: [stud_sec[0], front_stud_height, stud_sec[1]], center: false }),
    [king_stud_right_x, wall_assembly_y - front_stud_height, floor_stack]
  ));

  // Jack studs (trimmer studs, support header)
  const jack_left_x = king_stud_left_x + stud_sec[0];
  const jack_right_x = king_stud_right_x - stud_sec[0];
  pieces.push(translate(
    cube({ size: [stud_sec[0], jack_stud_height, stud_sec[1]], center: false }),
    [jack_left_x, wall_assembly_y - jack_stud_height, floor_stack]
  ));
  pieces.push(translate(
    cube({ size: [stud_sec[0], jack_stud_height, stud_sec[1]], center: false }),
    [jack_right_x, wall_assembly_y - jack_stud_height, floor_stack]
  ));

  // Header (double 2x, spans door opening, sits on jack studs)
  const header_width = door_w + 2 * stud_sec[0];  // Spans between king studs
  pieces.push(translate(
    cube({ size: [header_width, stud_sec[0] * 2, stud_sec[1]], center: false }),
    [jack_left_x, wall_assembly_y - jack_stud_height - stud_sec[0] * 2, floor_stack]
  ));

  // Cripple studs above header
  const cripple_height = header_height - stud_sec[0] * 2;
  if (cripple_height > 50) {
    const cripple_x = door_center_x - stud_sec[0] / 2;
    pieces.push(translate(
      cube({ size: [stud_sec[0], cripple_height, stud_sec[1]], center: false }),
      [cripple_x, wall_assembly_y - front_stud_height, floor_stack]
    ));
  }

  return union(...pieces);
}

// Step 5: Complete front wall frame (lying flat, ready to raise)
// Includes plates, regular studs, AND door framing
function build_front_wall_flat() {
  return union(
    build_front_bottom_plate(),
    build_front_top_plate(),
    build_front_studs_flat(),
    build_door_framing()
  );
}

// Step 6: Front wall raised (vertical, in final position)
// This is the existing front_wall geometry

// Build all wall assembly components
const front_bottom_plate = build_front_bottom_plate();
const front_top_plate = build_front_top_plate();
const front_studs_flat = build_front_studs_flat();
const front_door_framing = build_door_framing();
const front_wall_flat = build_front_wall_flat();

// ============================================================================
// MATERIAL HELPER - Use material references from materials.json database
// ============================================================================

// Helper to create object with material reference (colors auto-loaded from materials.json)
// Optional objectId for fine-grained assembly step filtering
function withMaterial(geometry, materialId, objectId = null) {
  const obj = { geometry: geometry, material: materialId };
  if (objectId) obj.objectId = objectId;
  return obj;
}

// Helper to create explicitly colored object with optional objectId
function withColorId(geometry, color, objectId = null) {
  const obj = withColor(geometry, color);
  if (objectId) obj.objectId = objectId;
  return obj;
}

// Define realistic colors for architectural elements (fallback for non-material items)
const CONCRETE_GRAY = [0.65, 0.65, 0.68];     // Pavers
const WOOD_TAN = [0.76, 0.60, 0.42];          // Skids (pressure-treated wood)
const PLYWOOD_LIGHT = [0.85, 0.75, 0.60];     // Floor
const WOOD_NATURAL = [0.72, 0.57, 0.38];      // Wall framing
const ROOF_CHARCOAL = [0.30, 0.30, 0.32];     // Roof shingles
const SKIRTING_DARK = [0.45, 0.36, 0.28];     // Skirting panels
const NEST_BOX_WOOD = [0.68, 0.53, 0.35];     // Nesting boxes (slightly darker wood)
const DOOR_WOOD = [0.60, 0.45, 0.30];         // Doors (darker stained wood)
const ROOST_BROWN = [0.55, 0.35, 0.20];       // Roosting perches
const RAMP_WOOD = [0.65, 0.50, 0.32];         // Ramps

// Scale down for display and apply colors/materials
// Using material references from materials.json where applicable
const scaledFoundationPavers = withMaterial(scale(foundationPavers, DISPLAY_SCALE), 'concrete_block', 'foundation_pavers');
const scaledFoundationSkids = withMaterial(scale(foundationSkids, DISPLAY_SCALE), 'pressure_treated_148x148', 'foundation_skids');
const scaledSkirting = withColorId(scale(skirting, DISPLAY_SCALE), SKIRTING_DARK, 'coop_skirting');
const scaledFloor = withMaterial(scale(floor, DISPLAY_SCALE), 'osb_18mm', 'floor_deck');
const scaledFloorHangers = withMaterial(scale(floor_hangers, DISPLAY_SCALE), 'joist_hanger', 'floor_hangers');
const scaledLumberPile = withMaterial(scale(lumber_pile, DISPLAY_SCALE), 'assembly_lumber_preview', 'lumber_pile');

// Wall assembly step-by-step components (use assembly_lumber_preview material to avoid showing in later steps)
const scaledFrontBottomPlate = withMaterial(scale(front_bottom_plate, DISPLAY_SCALE), 'assembly_lumber_preview', 'front_bottom_plate');
const scaledFrontTopPlate = withMaterial(scale(front_top_plate, DISPLAY_SCALE), 'assembly_lumber_preview', 'front_top_plate');
const scaledFrontStudsFlat = withMaterial(scale(front_studs_flat, DISPLAY_SCALE), 'assembly_lumber_preview', 'front_studs_flat');
const scaledFrontDoorFraming = withMaterial(scale(front_door_framing, DISPLAY_SCALE), 'assembly_lumber_preview', 'front_door_framing');
const scaledFrontWallFlat = withMaterial(scale(front_wall_flat, DISPLAY_SCALE), 'assembly_lumber_preview', 'front_wall_flat');

const scaledFrontWall = withMaterial(scale(front_wall, DISPLAY_SCALE), 'pine_48x98_c24', 'front_wall');
const scaledBackWall = withMaterial(scale(back_wall, DISPLAY_SCALE), 'pine_48x98_c24', 'back_wall');
const scaledLeftWall = withMaterial(scale(left_wall, DISPLAY_SCALE), 'pine_48x98_c24', 'left_wall');
const scaledRightWall = withMaterial(scale(right_wall, DISPLAY_SCALE), 'pine_48x98_c24', 'right_wall');
const scaledRightInteriorPanel = withColorId(scale(right_interior_panel, DISPLAY_SCALE), PLYWOOD_LIGHT, 'right_interior_panel');
const scaledTunnelAccessFrame = withColorId(scale(tunnel_access_interior_frame, DISPLAY_SCALE), WOOD_NATURAL, 'tunnel_access_interior_frame');
const scaledTunnelAccessRamp = withColorId(scale(tunnel_access_ramp, DISPLAY_SCALE), RAMP_WOOD, 'tunnel_access_ramp');
const scaledRoof = withMaterial(scale(roof, DISPLAY_SCALE), 'galvanized_roofing', 'roof');
const scaledNestSupport = withMaterial(scale(nest_support_structure, DISPLAY_SCALE), 'pine_48x98_c24', 'nest_support');
const scaledNestingBoxes = withMaterial(scale(nesting_box_array, DISPLAY_SCALE), 'nest_box_plywood', 'nesting_boxes');
const scaledNestDoors = withColorId(scale(nesting_box_doors, DISPLAY_SCALE), DOOR_WOOD, 'nest_doors');
const scaledNestDoorHandles = withColorId(scale(nesting_box_handles, DISPLAY_SCALE), [0.25, 0.25, 0.27], 'nest_door_handles');

// Cladding - boards use selected color, backing gets darker shadow version
// Shadow color is a darkened version of the main cladding color
const SHADOW_COLOR = [
  CLADDING_RGB[0] * 0.25,
  CLADDING_RGB[1] * 0.22,
  CLADDING_RGB[2] * 0.18
];

// Front cladding
const scaledFrontBacking = withColorId(scale(front_cladding.backing, DISPLAY_SCALE), SHADOW_COLOR, 'front_cladding_backing');
const scaledFrontBoards = withColorId(scale(front_cladding.boards, DISPLAY_SCALE), CLADDING_RGB, 'front_cladding_boards');
const scaledFrontTrim = withMaterial(scale(front_cladding.trim, DISPLAY_SCALE), 'exterior_paint_white', 'front_cladding_trim');
// Back cladding
const scaledBackBacking = withColorId(scale(back_cladding.backing, DISPLAY_SCALE), SHADOW_COLOR, 'back_cladding_backing');
const scaledBackBoards = withColorId(scale(back_cladding.boards, DISPLAY_SCALE), CLADDING_RGB, 'back_cladding_boards');
const scaledBackTrim = withMaterial(scale(back_cladding.trim, DISPLAY_SCALE), 'exterior_paint_white', 'back_cladding_trim');
// Left cladding
const scaledLeftBacking = withColorId(scale(left_cladding.backing, DISPLAY_SCALE), SHADOW_COLOR, 'left_cladding_backing');
const scaledLeftBoards = withColorId(scale(left_cladding.boards, DISPLAY_SCALE), CLADDING_RGB, 'left_cladding_boards');
const scaledLeftTrim = withMaterial(scale(left_cladding.trim, DISPLAY_SCALE), 'exterior_paint_white', 'left_cladding_trim');
// Right cladding
const scaledRightBacking = withColorId(scale(right_cladding.backing, DISPLAY_SCALE), SHADOW_COLOR, 'right_cladding_backing');
const scaledRightBoards = withColorId(scale(right_cladding.boards, DISPLAY_SCALE), CLADDING_RGB, 'right_cladding_boards');
const scaledRightTrim = withMaterial(scale(right_cladding.trim, DISPLAY_SCALE), 'exterior_paint_white', 'right_cladding_trim');

// Doors - Finnish gray painted wood with metal hardware
const DOOR_NAVY = [0.12, 0.17, 0.30];  // Navy blue - classic complement to yellow
const HARDWARE_METAL = [0.25, 0.25, 0.27];  // Dark metal/iron
const scaledHumanDoorBody = withColorId(scale(human_door_body, DISPLAY_SCALE), DOOR_NAVY, 'human_door_body');
const scaledHumanDoorHardware = withColorId(scale(human_door_hardware, DISPLAY_SCALE), HARDWARE_METAL, 'human_door_hardware');
const scaledHumanDoorFrame = withMaterial(scale(human_door_frame, DISPLAY_SCALE), 'exterior_paint_white', 'human_door_frame');
const scaledNestBoxFrame = withMaterial(scale(nest_box_frame, DISPLAY_SCALE), 'exterior_paint_white', 'nest_box_frame');
const scaledHumanDoor = withMaterial(scale(human_door, DISPLAY_SCALE), 'door_thermal_bridge');

// Roosting perches
const scaledLowerRoost = withColorId(scale(lower_roost, DISPLAY_SCALE), ROOST_BROWN, 'lower_roost');
const scaledMidRoost = withColorId(scale(mid_roost, DISPLAY_SCALE), ROOST_BROWN, 'mid_roost');
const scaledUpperRoost = withColorId(scale(upper_roost, DISPLAY_SCALE), ROOST_BROWN, 'upper_roost');

// Viewing tunnel
const TUNNEL_WALL_COLOR = [0.87, 0.72, 0.53];  // BurlyWood
const scaledTunnelWalls = withColorId(scale(tunnel_walls, DISPLAY_SCALE), TUNNEL_WALL_COLOR, 'tunnel_walls');
const scaledTunnelRoof = withColorId(scale(tunnel_roof, DISPLAY_SCALE), ROOF_CHARCOAL, 'tunnel_roof');
const scaledTunnelSkid = withColorId(scale(tunnel_skid, DISPLAY_SCALE), WOOD_TAN, 'tunnel_skid');
const scaledTunnelAccessDoorBody = withColorId(scale(tunnel_access_door_body, DISPLAY_SCALE), DOOR_WOOD, 'tunnel_access_door_body');
const scaledTunnelAccessDoorHardware = withColorId(scale(tunnel_access_door_hardware, DISPLAY_SCALE), HARDWARE_METAL, 'tunnel_access_door_hardware');
const scaledTunnelDoorFrame = withMaterial(scale(tunnel_door_frame, DISPLAY_SCALE), 'exterior_paint_white', 'tunnel_door_frame');
const scaledTunnelPosts = withColorId(scale(tunnel_posts, DISPLAY_SCALE), WOOD_NATURAL, 'tunnel_posts');
const scaledTunnelShelf = withColorId(scale(tunnel_shelf, DISPLAY_SCALE), PLYWOOD_LIGHT, 'tunnel_shelf');
const scaledChickenDoorFrame = withMaterial(scale(chicken_door_frame, DISPLAY_SCALE), 'exterior_paint_white', 'tunnel_chicken_door_frame');

// Run structure - individual components for step-by-step assembly
const scaledRunCornerPosts = withMaterial(scale(run_corner_posts, DISPLAY_SCALE), 'cedar_post_98x98', 'run_corner_posts');
const scaledRunGatePost = withMaterial(scale(run_gate_post, DISPLAY_SCALE), 'cedar_post_98x98', 'run_gate_post');
const scaledRunTopRails = withMaterial(scale(run_top_rails_combined, DISPLAY_SCALE), 'cedar_post_98x98', 'run_top_rails');
const scaledRunLowerRails = withMaterial(scale(run_lower_rails_combined, DISPLAY_SCALE), 'cedar_post_98x98', 'run_lower_rails');
const scaledRunGateBeam = withMaterial(scale(run_gate_beam, DISPLAY_SCALE), 'cedar_post_98x98', 'run_gate_beam');
const scaledRunRidgeBeam = withMaterial(scale(run_ridge_beam, DISPLAY_SCALE), 'cedar_post_98x98', 'run_ridge_beam');
const scaledRunRoofRafters = withMaterial(scale(run_roof_rafters_combined, DISPLAY_SCALE), 'cedar_post_98x98', 'run_roof_rafters');
// Full frame for backwards compatibility (hidden in favor of components)
const scaledRunFrame = withMaterial(scale(run_frame, DISPLAY_SCALE), 'cedar_post_98x98', 'run_frame');

// Chicken gym
const scaledChickenGym = withMaterial(scale(chicken_gym, DISPLAY_SCALE), 'cedar_post_98x98', 'chicken_gym');

// Bushes
const BUSH_GREEN = [0.33, 0.42, 0.18];  // DarkOliveGreen
const scaledBushes = withColor(scale(all_bushes, DISPLAY_SCALE), BUSH_GREEN);

// Finnish nature colors
const PINE_TRUNK = [0.40, 0.28, 0.18];
const PINE_GREEN = [0.18, 0.32, 0.15];
const BIRCH_WHITE = [0.88, 0.86, 0.82];
const BIRCH_LEAF = [0.38, 0.52, 0.22];
const SPRUCE_GREEN = [0.12, 0.25, 0.12];
const MOSS_GREEN = [0.28, 0.38, 0.15];
const BOULDER_GRAY = [0.52, 0.50, 0.48];

const scaledPineTrunks = withColor(scale(all_pine_trunks, DISPLAY_SCALE), PINE_TRUNK);
const scaledPineCanopies = withColor(scale(all_pine_canopies, DISPLAY_SCALE), PINE_GREEN);
const scaledBirchTrunks = withColor(scale(all_birch_trunks, DISPLAY_SCALE), BIRCH_WHITE);
const scaledBirchCanopies = withColor(scale(all_birch_canopies, DISPLAY_SCALE), BIRCH_LEAF);
const scaledSpruceTrunks = withColor(scale(all_spruce_trunks, DISPLAY_SCALE), SPRUCE_GREEN);
const scaledSpruceCanopies = withColor(scale(all_spruce_canopies, DISPLAY_SCALE), SPRUCE_GREEN);
const scaledGroundPatches = withColor(scale(all_ground_patches, DISPLAY_SCALE), MOSS_GREEN);
const scaledBoulders = withColor(scale(all_boulders, DISPLAY_SCALE), BOULDER_GRAY);

const GRAVEL_BEIGE = [0.72, 0.68, 0.60];
const LOG_BROWN = [0.45, 0.30, 0.18];
const scaledPaths = withColor(scale(all_paths, DISPLAY_SCALE), GRAVEL_BEIGE);
const scaledLogStack = withColor(scale(log_stack, DISPLAY_SCALE), LOG_BROWN);

// Tunnel skirting
const scaledTunnelSkirting = withColorId(scale(tunnel_skirting, DISPLAY_SCALE), SKIRTING_DARK, 'tunnel_skirting');

// Feeder and waterer
const FEEDER_RED = [0.8, 0.2, 0.15];
const WATERER_BLUE = [0.2, 0.4, 0.8];
const scaledFeeder = withColorId(scale(feeder, DISPLAY_SCALE), FEEDER_RED, 'tunnel_feeder');
const scaledWaterer = withColorId(scale(waterer, DISPLAY_SCALE), WATERER_BLUE, 'tunnel_waterer');

// Run gate (the swinging door, not the frame)
const scaledRunGate = withMaterial(scale(run_gate, DISPLAY_SCALE), 'cedar_post_98x98', 'run_gate');

// Hardware cloth mesh walls for run enclosure
const scaledRunMeshWalls = withMaterial(scale(run_mesh_walls, DISPLAY_SCALE), 'hardware_cloth', 'run_mesh_walls');

// L-extension frame - now with objectId
const scaledLExtension = withMaterial(scale(l_extension_frame, DISPLAY_SCALE), 'cedar_post_98x98', 'l_extension');

// Chickens - decorative but need objectId for final assembly stage
const CHICKEN_WHITE = [0.82, 0.74, 0.58];
const scaledChickensGeom = scale(all_chickens, DISPLAY_SCALE);
const scaledChickens = { geometry: scaledChickensGeom, color: CHICKEN_WHITE, objectId: 'chickens' };

// Mesh apron - hardware cloth for predator protection
const scaledMeshApron = withMaterial(scale(mesh_apron, DISPLAY_SCALE), 'hardware_cloth', 'mesh_apron');

// Insulation - 100mm mineral wool batts
const scaledRoofInsulation = withMaterial(scale(roof_insulation, DISPLAY_SCALE), 'insulation_100mm');
// Wall insulation as separate panels (so thermal area calculation can detect them as thin slabs)
const scaledFrontWallInsulation = withMaterial(scale(front_wall_insulation, DISPLAY_SCALE), 'insulation_100mm');
const scaledBackWallInsulation = withMaterial(scale(back_wall_insulation, DISPLAY_SCALE), 'insulation_100mm');
const scaledLeftWallInsulation = withMaterial(scale(left_wall_insulation, DISPLAY_SCALE), 'insulation_100mm');
const scaledRightWallInsulation = withMaterial(scale(right_wall_insulation, DISPLAY_SCALE), 'insulation_100mm');
const scaledFloorInsulation = withMaterial(scale(floor_insulation, DISPLAY_SCALE), 'insulation_100mm');

// Lounge area
const TABLE_WOOD = [0.70, 0.58, 0.44];
const CHAIR_WOOD = [0.74, 0.64, 0.52];
const scaledLoungeTable = withColorId(scale(lounge_table, DISPLAY_SCALE), TABLE_WOOD, 'lounge_table');
const scaledLoungeChairs = withColorId(scale(lounge_chairs, DISPLAY_SCALE), CHAIR_WOOD, 'lounge_chairs');

// Export as array of colored objects (with visibility toggles)
export const scene = [
  // Foundation & base (conditional)
  ...(show_floor ? [scaledFoundationPavers, scaledFoundationSkids, scaledSkirting, scaledFloor, scaledFloorHangers] : []),
  // Wall framing (conditional)
  ...(show_walls ? [scaledFrontWall, scaledBackWall, scaledLeftWall, scaledRightWall] : []),
  // Cladding (conditional) - backing (dark shadow) + boards (yellow) + trim (white)
  ...(show_cladding ? [
    scaledFrontBacking, scaledFrontBoards, scaledFrontTrim,
    scaledBackBacking, scaledBackBoards, scaledBackTrim,
    scaledLeftBacking, scaledLeftBoards, scaledLeftTrim,
    scaledRightBacking, scaledRightBoards, scaledRightTrim
  ] : []),
  // Roof (conditional)
  ...(show_roof ? [scaledRoof] : []),
  // Insulation (conditional)
  ...(show_insulation && show_roof ? [scaledRoofInsulation] : []),
  ...(show_insulation && show_walls ? [scaledFrontWallInsulation, scaledBackWallInsulation, scaledLeftWallInsulation, scaledRightWallInsulation] : []),
  ...(show_insulation && show_floor ? [scaledFloorInsulation] : []),
  // Interior elements (nesting, roosts, interior panel) - conditional
  ...(show_interior ? [
    scaledNestSupport,
    scaledNestingBoxes,
    scaledNestDoors,
    scaledNestDoorHandles,
    scaledLowerRoost,
    scaledMidRoost,
    scaledUpperRoost,
    scaledRightInteriorPanel,
    scaledTunnelAccessFrame,
    scaledTunnelAccessRamp
  ] : []),
  // Doors (show with cladding OR insulation for thermal calculation)
  ...((show_cladding || show_insulation) ? [scaledHumanDoorBody, scaledHumanDoorHardware, scaledHumanDoorFrame, scaledNestBoxFrame] : []),
  // Viewing tunnel (conditional)
  ...(show_tunnel ? [
    scaledTunnelWalls,
    scaledTunnelSkid,
    scaledTunnelAccessDoorBody,
    scaledTunnelAccessDoorHardware,
    scaledTunnelDoorFrame,
    scaledTunnelPosts,
    scaledTunnelShelf,
    scaledChickenDoorFrame,
    scaledTunnelSkirting,
    scaledFeeder,
    scaledWaterer
  ] : []),
  ...(show_tunnel && show_roof ? [scaledTunnelRoof] : []),
  // Attached run (conditional) - individual components for step-by-step assembly
  ...(show_run ? [
    scaledRunCornerPosts,
    scaledRunGatePost,
    scaledRunTopRails,
    scaledRunLowerRails,
    scaledRunGateBeam,
    scaledRunRidgeBeam,
    scaledRunRoofRafters,
    scaledRunGate,
    scaledRunMeshWalls,  // Hardware cloth enclosure walls
    // scaledMeshApron moved to assemblyOnlyObjects
    scaledChickenGym,
    scaledLExtension
  ] : []),
  // Landscaping (always shown)
  scaledBushes,
  // Finnish nature - trees and ground cover
  scaledPineTrunks, scaledPineCanopies,
  scaledBirchTrunks, scaledBirchCanopies,
  scaledSpruceTrunks, scaledSpruceCanopies,
  scaledGroundPatches, scaledBoulders, scaledPaths, scaledLogStack,
  // Chickens (conditional)
  ...(show_chickens ? [scaledChickens] : []),
  // Lounge area (always shown)
  scaledLoungeTable,
  scaledLoungeChairs
];
