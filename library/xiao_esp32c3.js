const PCB_L = 21.0;
const PCB_W = 17.5;
const PCB_T = 0.8;

const MH_D = 2.0;
const MH_X = 11.4 / 2;
const MH_Y = 11.4 / 2;

const USB_W = 8.0;
const USB_D = 6.0;
const USB_H = 3.0;
const USB_Z = PCB_T;

const SHIELD_L = 12.0;
const SHIELD_W = 10.0;
const SHIELD_H = 1.4;

const ANTENNA_L = 8.5;
const ANTENNA_W = 3.0;
const ANTENNA_H = 0.4;

const LED_L = 1.4;
const LED_W = 1.8;
const LED_H = 0.5;

const CASTELLATION_COUNT = 11;
const CASTELLATION_PITCH = 2.0;
const CASTELLATION_WIDTH = 1.0;
const CASTELLATION_DEPTH = 1.4;

export function buildXiaoEsp32C3() {
  const pcb = translate(
    cube({ size: [PCB_L, PCB_W, PCB_T], center: true }),
    [0, 0, PCB_T / 2]
  );

  const holeHeight = PCB_T + 0.4;
  const hole = (x, y) =>
    translate(
      cylinder({ height: holeHeight, radius: MH_D / 2, center: true }),
      [x, y, PCB_T / 2]
    );

  const holes = union(
    hole(MH_X, MH_Y),
    hole(MH_X, -MH_Y),
    hole(-MH_X, MH_Y),
    hole(-MH_X, -MH_Y)
  );

  const castellations = (() => {
    const notches = [];
    const xStart = -((CASTELLATION_COUNT - 1) / 2) * CASTELLATION_PITCH;
    for (let i = 0; i < CASTELLATION_COUNT; ++i) {
      const x = xStart + i * CASTELLATION_PITCH;
      const makeNotch = sign =>
        translate(
          cube({
            size: [CASTELLATION_WIDTH, CASTELLATION_DEPTH, PCB_T + 0.2],
            center: true,
          }),
          [x, sign * (PCB_W / 2 - CASTELLATION_DEPTH / 2 + 0.05), PCB_T / 2]
        );
      notches.push(makeNotch(1));
      notches.push(makeNotch(-1));
    }
    return union(...notches);
  })();

  const boardProfile = difference(pcb, union(holes, castellations));

  const usb = translate(
    cube({ size: [USB_D, USB_W, USB_H], center: true }),
    [PCB_L / 2 + USB_D / 2 - 0.1, 0, USB_Z + USB_H / 2]
  );

  const shield = translate(
    cube({ size: [SHIELD_L, SHIELD_W, SHIELD_H], center: true }),
    [-2.0, 0, PCB_T + SHIELD_H / 2]
  );

  const antenna = translate(
    cube({ size: [ANTENNA_L, ANTENNA_W, ANTENNA_H], center: true }),
    [PCB_L / 2 - ANTENNA_L / 2 - 1.0, 0, PCB_T + ANTENNA_H / 2]
  );

  const statusLed = translate(
    cube({ size: [LED_L, LED_W, LED_H], center: true }),
    [-PCB_L / 2 + LED_L, -4.0, PCB_T + LED_H / 2]
  );

  return union(boardProfile, usb, shield, antenna, statusLed);
}

export default buildXiaoEsp32C3;

export function importXiaoEsp32C3({ path = './models/seedespc3.dxf', forceCleanup = true } = {}) {
  if (typeof loadMesh !== 'function') {
    throw new Error('loadMesh binding is not available; rebuild the viewer with mesh import support.');
  }
  return loadMesh(path, forceCleanup);
}

