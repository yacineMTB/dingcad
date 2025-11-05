// WesWorld Logo Creation
// This is the default scene code that creates the WesWorld logo

const nodeOuterRadius = 0.25;  // Outer radius of all nodes
const nodeInnerRadius = 0.17;  // Inner radius for hollow rings
const ringThickness = nodeOuterRadius - nodeInnerRadius;
const lineRadius = ringThickness;  // Line thickness matches ring thickness

// W shape coordinates
const topLeft = [-1.0, 1.0, 0.0];
const bottomLeft = [-0.5, -1.0, 0.0];
const topMiddle = [0.0, 0.5, 0.0];
const bottomRight = [0.5, -1.0, 0.0];
const topRight = [1.0, 1.0, 0.0];

// Helper function to create a cylinder between two points
function createConnector(start, end, radius) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  if (length < 0.001) {
    return translate(sphere({ radius: radius }), start);
  }
  
  // Create cylinder along Z axis, then rotate and translate
  const cyl = cylinder({ height: length, radius: radius, center: true });
  
  // Calculate rotation angles
  const normalized = [dx / length, dy / length, dz / length];
  const yAngle = Math.atan2(normalized[0], normalized[2]) * 180 / Math.PI;
  const xzLength = Math.sqrt(normalized[0] * normalized[0] + normalized[2] * normalized[2]);
  const xAngle = -Math.atan2(normalized[1], xzLength) * 180 / Math.PI;
  
  // Center point
  const center = [
    (start[0] + end[0]) * 0.5,
    (start[1] + end[1]) * 0.5,
    (start[2] + end[2]) * 0.5
  ];
  
  return translate(rotate(cyl, [xAngle, yAngle, 0]), center);
}

// Create hollow rings (nodes 1-4): outer sphere minus inner sphere
function createRing(pos) {
  const outer = translate(sphere({ radius: nodeOuterRadius }), pos);
  const inner = translate(sphere({ radius: nodeInnerRadius }), pos);
  return difference(outer, inner);
}

// Create nodes
const node1 = createRing(topLeft);        // Hollow
const node2 = createRing(bottomLeft);     // Hollow
const node3 = createRing(topMiddle);      // Hollow
const node4 = createRing(bottomRight);   // Hollow
const node5 = translate(sphere({ radius: nodeOuterRadius }), topRight);  // Solid filled node

// Create connecting lines (cylinders)
const line1 = createConnector(topLeft, bottomLeft, lineRadius);
const line2 = createConnector(bottomLeft, topMiddle, lineRadius);
const line3 = createConnector(topMiddle, bottomRight, lineRadius);
const line4 = createConnector(bottomRight, topRight, lineRadius);

// Combine all parts
export const scene = union(
  node1, node2, node3, node4, node5,
  line1, line2, line3, line4
);

