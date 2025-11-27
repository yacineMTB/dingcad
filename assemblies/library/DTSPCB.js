const pcbWidth = 21;
const pcbHeight = 15;
const pcbThickness = 2.6;

const componentSize = 8.8;
const componentTotalHeight = 8.1;
const smallComponentSize = 5.1;
const smallComponentTotalHeight = 6.2;
const connectorWidth = 6.0;
const connectorDepth = 8.0;
const connectorTotalHeight = 2.6;
const connectorGapX = 0.4;

export function buildDTSPCBBoard() {
  return cube({ size: [pcbWidth, pcbHeight, pcbThickness], center: false });
}

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

  const smallComponentHeight = smallComponentTotalHeight - pcbThickness; // total height from PCB bottom is 6.2mm
  const smallGapX = 1.4;
  const smallOverlapX = 0.2; // extend to overlap the larger block slightly
  const smallComponentLength = smallComponentSize + smallGapX + smallOverlapX;
  const smallOffsetX = componentOffsetX - smallGapX - smallComponentSize;
  const marginY = (pcbHeight - smallComponentSize) / 2; // ~5mm clearance from top and bottom

  const smallComponent = translate(
    cube({ size: [smallComponentLength, smallComponentSize, smallComponentHeight], center: false }),
    [smallOffsetX, marginY, pcbThickness]
  );

  const connectorHeight = connectorTotalHeight - pcbThickness; // keeps top flush with connectorTotalHeight
  const connectorOffsetX = Math.min(componentOffsetX + componentSize + connectorGapX, pcbWidth - connectorWidth);
  const connectorOffsetY = componentOffsetY + componentSize / 2 - connectorDepth / 2;

  const connector = translate(
    cube({ size: [connectorWidth, connectorDepth, connectorHeight], center: false }),
    [connectorOffsetX, connectorOffsetY, pcbThickness]
  );

  return union(pcb, component, smallComponent, connector);
}

export default buildDTSPCB;
