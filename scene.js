import buildDTSPCB from './library/DTSPCB.js';
import ifItFitsIsits from './library/util/ifItFitsIsits.js';

const dts = buildDTSPCB();

export const scene = ifItFitsIsits(dts);
