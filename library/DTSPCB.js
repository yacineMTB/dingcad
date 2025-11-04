const pcbWidth = 21;
const pcbHeight = 15;
const pcbThickness = 1.6;

const componentSize = 8.8;
const componentTotalHeight = 8.1;

export function buildDTSPCB() {
  const pcb = cube({ size: [pcbWidth, pcbHeight, pcbThickness], center: false });

  const componentHeight = componentTotalHeight - pcbThickness; // keep total stack height at 8.1mm
  const componentOffsetX = pcbWidth - 3.7 - componentSize;
  const componentOffsetY = pcbHeight - 3 - componentSize;

  // Align the component so its top-right corner is inset 3.7mm on X and 3mm on Y from the PCB corner.
  const component = translate(
    cube({ size: [componentSize, componentSize, componentHeight], center: false }),
    [componentOffsetX, componentOffsetY, pcbThickness]
  );

  return union(pcb, component);
}

export default buildDTSPCB;
