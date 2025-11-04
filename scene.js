import buildDTSPCB from './library/DTSPCB.js';

const dts = buildDTSPCB();
const bounds = boundingBox(dts);
const padding = 2;
const box = translate(
  cube({
    size: [
      bounds.max[0] - bounds.min[0] + padding,
      bounds.max[1] - bounds.min[1] + padding,
      bounds.max[2] - bounds.min[2] + padding,
    ],
    center: false,
  }),
  [bounds.min[0], bounds.min[1], bounds.min[2]]
);

export const scene = difference(box, dts);
