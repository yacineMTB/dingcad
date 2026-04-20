#pragma once

#include "manifold/manifold.h"
#include <cmath>

namespace helscoop {

/**
 * Calculate the thermal envelope area for a geometry.
 *
 * For thermal calculations, we need the PROJECTED area perpendicular to heat flow,
 * NOT the total 3D mesh surface area.
 *
 * Example: A floor insulation slab of 2.4m × 2.5m × 0.1m has:
 * - 3D surface area: ~13 m² (all 6 faces)
 * - Thermal barrier area: 6 m² (just the XY face - heat flows through Z)
 *
 * This function uses the bounding box to determine the thermal barrier area:
 * - For horizontal slabs (thin in Z): thermal area = X × Y
 * - For vertical slabs (thin in X or Y): thermal area = largest vertical face
 *
 * @param geometry The Manifold geometry
 * @return Thermal envelope area in the same units² as the geometry
 */
inline double CalculateThermalEnvelopeArea(const manifold::Manifold& geometry) {
  auto box = geometry.BoundingBox();
  auto size = box.Size();

  double x = size.x;
  double y = size.y;
  double z = size.z;

  // Calculate the three possible face areas (pairs of opposite faces)
  double xyArea = x * y;  // Floor/roof faces (horizontal)
  double xzArea = x * z;  // Front/back wall faces
  double yzArea = y * z;  // Left/right wall faces

  // Determine which dimension is the "thin" one (insulation thickness)
  // The thermal barrier is the face perpendicular to the thin dimension
  //
  // For building envelope:
  // - Floor/roof insulation: thin in Z → thermal area is XY
  // - Wall insulation: thin in X or Y → thermal area is the largest vertical face

  double minDim = std::min({x, y, z});

  if (z <= minDim * 1.1) {
    // Thin in Z direction: horizontal slab (floor/roof insulation)
    // Heat flows vertically through the slab
    // Thermal barrier area = XY face
    return xyArea;
  } else if (x <= minDim * 1.1) {
    // Thin in X direction: vertical wall slab (e.g., east/west wall)
    // Heat flows horizontally through the wall
    // Thermal barrier area = YZ face
    return yzArea;
  } else {
    // Thin in Y direction: vertical wall slab (e.g., north/south wall)
    // Heat flows horizontally through the wall
    // Thermal barrier area = XZ face
    return xzArea;
  }
}

/**
 * Alternative: Calculate thermal area using mesh face normals.
 *
 * This method iterates through all triangles and sums up the projected areas
 * onto the dominant plane based on each triangle's normal direction.
 *
 * - Horizontal faces (|normal.z| > 0.7): project to XY plane
 * - Vertical faces: project to dominant vertical plane
 *
 * This is more accurate for complex shapes but slower.
 */
inline double CalculateThermalEnvelopeAreaFromMesh(const manifold::Manifold& geometry) {
  auto mesh = geometry.GetMeshGL();

  double horizontalArea = 0.0;  // Faces pointing up/down (for floor/roof)
  double verticalArea = 0.0;    // Faces pointing sideways (for walls)

  for (size_t t = 0; t < mesh.NumTri(); ++t) {
    auto triVerts = mesh.GetTriVerts(t);

    // Get vertex positions
    auto v0 = mesh.GetVertPos(triVerts[0]);
    auto v1 = mesh.GetVertPos(triVerts[1]);
    auto v2 = mesh.GetVertPos(triVerts[2]);

    // Calculate triangle edges
    auto e1 = v1 - v0;
    auto e2 = v2 - v0;

    // Cross product gives normal (and area * 2)
    auto crossProduct = manifold::la::cross(e1, e2);
    double triangleArea = manifold::la::length(crossProduct) * 0.5;

    // Normalize to get face normal
    auto normal = manifold::la::normalize(crossProduct);

    // Classify based on normal direction
    double absNz = std::abs(normal.z);

    if (absNz > 0.7) {
      // Horizontal face (floor/ceiling) - pointing mostly up or down
      // Project onto XY plane: projected area = area * |normal.z|
      horizontalArea += triangleArea * absNz;
    } else {
      // Vertical face (wall) - pointing mostly sideways
      // Project onto the dominant vertical plane
      double horizontalComponent = std::sqrt(normal.x * normal.x + normal.y * normal.y);
      verticalArea += triangleArea * horizontalComponent;
    }
  }

  // For insulation, we want the area of the thermal barrier
  // If it's mostly horizontal (floor/roof), return horizontal area
  // If it's mostly vertical (wall), return vertical area
  // Use the bounding box to determine orientation
  auto box = geometry.BoundingBox();
  auto size = box.Size();

  if (size.z < std::min(size.x, size.y)) {
    // Thin in Z: horizontal insulation
    return horizontalArea;
  } else {
    // Vertical insulation
    return verticalArea;
  }
}

}  // namespace helscoop
