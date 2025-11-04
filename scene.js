import { buildRadioEnclosure } from './library/radio_enclosure.js';
import buildDTSPCB from './library/DTSPCB.js';

const enclosure = buildRadioEnclosure();
export const scene = enclosure
// const pcbAssembly = buildDTSPCB();

// export const scene = union(enclosure, pcbAssembly);
