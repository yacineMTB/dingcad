import buildDTSPCB from './library/DTSPCB.js';
import buildXiaoEsp32C3, { importXiaoEsp32C3 } from './library/xiao_esp32c3.js';

const pcbAssembly = buildDTSPCB();

const modelPath = '~/Downloads/models/seedespc3.stl';
let xiaoBoard;
try {
  xiaoBoard = importXiaoEsp32C3({ path: modelPath });
} catch (error) {
  xiaoBoard = buildXiaoEsp32C3();
}

const pcbBounds = boundingBox(pcbAssembly);
const xiaoBounds = boundingBox(xiaoBoard);
const gap = 0;

const shiftX = pcbBounds.max[0] + gap - xiaoBounds.min[0];
const pcbCenterY = (pcbBounds.min[1] + pcbBounds.max[1]) / 2;
const xiaoCenterY = (xiaoBounds.min[1] + xiaoBounds.max[1]) / 2;
const shiftY = pcbCenterY - xiaoCenterY;
const shiftZ = pcbBounds.min[2] - xiaoBounds.min[2];

const xiaoAligned = translate(xiaoBoard, [shiftX, shiftY, shiftZ]);

export const scene = union(pcbAssembly, xiaoAligned);
export const dtsPcb = pcbAssembly;
export const xiaoEsp32C3 = xiaoAligned;
