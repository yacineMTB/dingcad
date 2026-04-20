#include "wall.h"
#include <cmath>
#include <vector>

namespace helscoop {
namespace primitives {

manifold::Manifold CreateSolidWall(const WallParams& params) {
  // Calculate wall length and angle
  const double dx = params.end[0] - params.start[0];
  const double dy = params.end[1] - params.start[1];
  const double length = std::sqrt(dx * dx + dy * dy);
  const double angleRad = std::atan2(dy, dx);
  const double angleDeg = angleRad * 180.0 / M_PI;

  // Create wall as a box aligned with X-axis
  manifold::Manifold wall = manifold::Manifold::Cube({length, params.thickness, params.height}, false);

  // Rotate around Z-axis to align with start->end direction
  wall = wall.Rotate(0.0, 0.0, angleDeg);

  // Calculate center position of the wall
  const double centerX = params.start[0] + dx / 2.0;
  const double centerY = params.start[1] + dy / 2.0;
  const double centerZ = params.height / 2.0;

  // Translate to position
  wall = wall.Translate({centerX, centerY, centerZ});

  return wall;
}

manifold::Manifold CreateStickFrameWall(const WallParams& params) {
  // Calculate wall length and angle
  const double dx = params.end[0] - params.start[0];
  const double dy = params.end[1] - params.start[1];
  const double length = std::sqrt(dx * dx + dy * dy);
  const double angleRad = std::atan2(dy, dx);
  const double angleDeg = angleRad * 180.0 / M_PI;

  std::vector<manifold::Manifold> components;

  const double studWidth = params.studSize[0];
  const double studDepth = params.studSize[1];

  // Bottom plate (runs full length, same depth as studs)
  // With center:false, cube origin is at corner, so we place it at (0,0,0)
  manifold::Manifold bottomPlate = manifold::Manifold::Cube(
    {length, studDepth, params.bottomPlateHeight}, false
  );
  bottomPlate = bottomPlate.Translate({0, 0, 0});
  components.push_back(bottomPlate);

  // Top plate (runs full length, same depth as studs)
  // Bottom edge at height - topPlateHeight
  const double topPlateZ = params.height - params.topPlateHeight;
  manifold::Manifold topPlate = manifold::Manifold::Cube(
    {length, studDepth, params.topPlateHeight}, false
  );
  topPlate = topPlate.Translate({0, 0, topPlateZ});
  components.push_back(topPlate);

  // Calculate stud positions
  const double studHeight = params.height - params.bottomPlateHeight - params.topPlateHeight;
  const int numStuds = static_cast<int>(std::ceil(length / params.studSpacing)) + 1;

  for (int i = 0; i < numStuds; i++) {
    double studX = i * params.studSpacing;
    if (studX > length - studWidth) studX = length - studWidth;

    // Create vertical stud
    // With center:false, bottom corner is at origin, so Z=bottomPlateHeight puts bottom on top of plate
    manifold::Manifold stud = manifold::Manifold::Cube(
      {studWidth, studDepth, studHeight}, false
    );
    stud = stud.Translate({
      studX,
      0,
      params.bottomPlateHeight
    });
    components.push_back(stud);
  }

  // Add sheathing if requested
  if (params.includeSheathing) {
    manifold::Manifold sheathing = manifold::Manifold::Cube(
      {length, params.sheathingThickness, params.height}, false
    );
    // Position sheathing on back side of studs (behind the frame)
    sheathing = sheathing.Translate({
      0,
      studDepth,
      0
    });
    components.push_back(sheathing);
  }

  // Compose all components (MUCH faster than Union for non-overlapping parts!)
  // Components don't overlap - they just touch at edges - so Compose is safe
  manifold::Manifold frame = manifold::Manifold::Compose(components);

  // Now rotate around origin to align with start->end direction
  frame = frame.Rotate(0.0, 0.0, angleDeg);

  // Translate to start position
  // The wall was built starting at origin along X-axis, so just translate to start
  frame = frame.Translate({params.start[0], params.start[1], 0.0});

  return frame;
}

manifold::Manifold CreateWall(const WallParams& params) {
  switch (params.constructionType) {
    case ConstructionType::STICK_FRAME:
      return CreateStickFrameWall(params);
    case ConstructionType::SOLID:
    default:
      return CreateSolidWall(params);
  }
}

}  // namespace primitives
}  // namespace helscoop
