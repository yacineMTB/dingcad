#pragma once

#include <array>
#include <string>
#include "manifold/manifold.h"

namespace helscoop {
namespace primitives {

enum class ConstructionType {
  SOLID,       // Solid wall (concrete, brick, or simple placeholder)
  STICK_FRAME  // Wood stick-frame construction with studs
};

struct WallParams {
  std::array<double, 2> start;  // [x, y] start position
  std::array<double, 2> end;    // [x, y] end position
  double height;                // Wall height
  double thickness;             // Wall thickness (for solid) or depth (for framed)

  // Construction parameters
  ConstructionType constructionType;

  // Stick-frame parameters
  std::array<double, 2> studSize;    // [width, depth] e.g., [48, 98] for 2x4
  double studSpacing;                // Spacing between stud centers (e.g., 400mm or 600mm)
  double bottomPlateHeight;          // Height of bottom plate (e.g., 48mm)
  double topPlateHeight;             // Height of top plate (e.g., 48mm)
  bool includeSheathing;             // Whether to include sheathing panels
  double sheathingThickness;         // Thickness of sheathing (e.g., 12mm for OSB)

  // Constructor with defaults
  WallParams()
    : start{0.0, 0.0}
    , end{1000.0, 0.0}
    , height(2000.0)
    , thickness(98.0)
    , constructionType(ConstructionType::SOLID)
    , studSize{48.0, 98.0}
    , studSpacing(400.0)
    , bottomPlateHeight(48.0)
    , topPlateHeight(48.0)
    , includeSheathing(false)
    , sheathingThickness(12.0) {}
};

// Create a wall manifold based on construction type
manifold::Manifold CreateWall(const WallParams& params);

// Internal construction functions
manifold::Manifold CreateSolidWall(const WallParams& params);
manifold::Manifold CreateStickFrameWall(const WallParams& params);

}  // namespace primitives
}  // namespace helscoop
