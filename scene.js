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

export const scene = union(pcbAssembly, translate(xiaoBoard, [10, 0, 0]));
export const dtsPcb = pcbAssembly;
export const xiaoEsp32C3 = xiaoBoard;
