#include "blueprint_export.h"

#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <map>
#include <set>
#include <sstream>

namespace helscoop {

namespace {

// Color palette for different material categories
struct CategoryColor {
  const char* stroke;
  const char* fill;
};

std::map<std::string, CategoryColor> kCategoryColors = {
  {"lumber", {"#8B4513", "#DEB887"}},      // Brown
  {"sheathing", {"#556B2F", "#9ACD32"}},   // Olive/Yellow-green
  {"roofing", {"#4682B4", "#87CEEB"}},     // Steel blue
  {"insulation", {"#FF69B4", "#FFB6C1"}},  // Pink
  {"masonry", {"#696969", "#A9A9A9"}},     // Gray
  {"hardware", {"#2F4F4F", "#708090"}},    // Slate
  {"unknown", {"#333333", "#CCCCCC"}},     // Default gray
};

CategoryColor GetCategoryColor(const std::string& category) {
  auto it = kCategoryColors.find(category);
  if (it != kCategoryColors.end()) return it->second;
  return kCategoryColors["unknown"];
}

// Convert Manifold Polygons to SVG path data
// Polygons is std::vector<SimplePolygon>, SimplePolygon is std::vector<vec2>
std::string PolygonsToSvgPath(const manifold::Polygons& polygons,
                               float offsetX, float offsetY,
                               float scale, bool flipY = true) {
  std::ostringstream path;
  path << std::fixed << std::setprecision(2);

  for (const auto& polygon : polygons) {
    if (polygon.empty()) continue;

    bool first = true;
    for (const auto& vert : polygon) {
      // vec2 is directly linalg::vec<double, 2> with .x and .y
      float x = offsetX + static_cast<float>(vert.x) * scale;
      float y = flipY ? (offsetY - static_cast<float>(vert.y) * scale)
                      : (offsetY + static_cast<float>(vert.y) * scale);

      if (first) {
        path << "M " << x << " " << y << " ";
        first = false;
      } else {
        path << "L " << x << " " << y << " ";
      }
    }
    path << "Z ";
  }

  return path.str();
}

// Project geometry to 2D for a specific view
manifold::Polygons ProjectView(const manifold::Manifold& geom,
                                const std::string& view) {
  manifold::Manifold transformed = geom;

  if (view == "front") {
    // Rotate -90 degrees around X axis: Y becomes Z, Z becomes -Y
    // Looking at XZ plane (front view)
    transformed = geom.Rotate(90.0, 0.0, 0.0);
  } else if (view == "side" || view == "right") {
    // Rotate 90 degrees around Y axis: X becomes -Z, Z becomes X
    // Looking at YZ plane (right side view)
    transformed = geom.Rotate(0.0, -90.0, 0.0).Rotate(90.0, 0.0, 0.0);
  }
  // "top" view: no rotation needed, projects XY plane

  return transformed.Project();
}

// Calculate bounding box of polygons
void GetPolygonsBounds(const manifold::Polygons& polygons,
                       float& minX, float& minY, float& maxX, float& maxY) {
  minX = minY = std::numeric_limits<float>::max();
  maxX = maxY = std::numeric_limits<float>::lowest();

  for (const auto& polygon : polygons) {
    for (const auto& vert : polygon) {
      minX = std::min(minX, static_cast<float>(vert.x));
      minY = std::min(minY, static_cast<float>(vert.y));
      maxX = std::max(maxX, static_cast<float>(vert.x));
      maxY = std::max(maxY, static_cast<float>(vert.y));
    }
  }
}

// Format dimension text
std::string FormatDimension(float meters) {
  if (meters >= 1.0f) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2) << meters << "m";
    return ss.str();
  } else {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(0) << (meters * 1000.0f) << "mm";
    return ss.str();
  }
}

}  // namespace

bool ExportToSVG(
    const SceneData& sceneData,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const std::filesystem::path& outputPath,
    const BlueprintOptions& options,
    std::string& errorMsg) {

  std::ofstream file(outputPath);
  if (!file.is_open()) {
    errorMsg = "Failed to open file: " + outputPath.string();
    return false;
  }

  // Collect all geometry
  std::vector<manifold::Manifold> allGeometry;
  std::vector<std::string> materialIds;

  for (const auto& obj : sceneData.objects) {
    if (obj.geometry && !obj.geometry->IsEmpty()) {
      allGeometry.push_back(*obj.geometry);
      materialIds.push_back(obj.materialId);
    }
  }

  if (allGeometry.empty()) {
    errorMsg = "No geometry to export";
    return false;
  }

  // Calculate overall bounding box from first geometry's bounding box
  manifold::Manifold combined = manifold::Manifold::Compose(allGeometry);
  manifold::Box bbox = combined.BoundingBox();

  float modelWidth = static_cast<float>(bbox.max.x - bbox.min.x) / kSceneScale;
  float modelDepth = static_cast<float>(bbox.max.z - bbox.min.z) / kSceneScale;
  float modelHeight = static_cast<float>(bbox.max.y - bbox.min.y) / kSceneScale;

  // Calculate view layout
  float viewMargin = 40.0f;  // mm between views
  float titleHeight = 60.0f;
  float partsListWidth = options.includePartsList ? 200.0f : 0.0f;

  float availableWidth = options.pageWidth - 2 * options.margin - partsListWidth;
  float availableHeight = options.pageHeight - 2 * options.margin - titleHeight;

  // Determine scale to fit all views
  // Layout: Top view on left, Front view top-right, Side view bottom-right
  float topViewWidth = modelWidth;
  float topViewHeight = modelDepth;
  float frontViewWidth = modelWidth;
  float frontViewHeight = modelHeight;
  float sideViewWidth = modelDepth;
  float sideViewHeight = modelHeight;

  // Calculate scale to fit (in mm per meter)
  float denomX = topViewWidth + std::max(frontViewWidth, sideViewWidth);
  float denomY = topViewHeight + frontViewHeight;
  if (denomX < 0.001f) denomX = 1.0f;
  if (denomY < 0.001f) denomY = 1.0f;
  float scaleX = (availableWidth - viewMargin) / denomX;
  float scaleY = (availableHeight - viewMargin) / denomY;
  float drawScale = std::min(scaleX, scaleY) * 0.85f;

  // Convert to pixels (assuming 96 DPI, 1mm = 3.78 pixels)
  float mmToPixel = 3.78f;
  float pageWidthPx = options.pageWidth * mmToPixel;
  float pageHeightPx = options.pageHeight * mmToPixel;
  float marginPx = options.margin * mmToPixel;

  // Scale for drawing (scene units to pixels)
  float pixelScale = drawScale * mmToPixel / kSceneScale;

  // Write SVG header
  file << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  file << "<svg xmlns=\"http://www.w3.org/2000/svg\" ";
  file << "width=\"" << options.pageWidth << "mm\" height=\"" << options.pageHeight << "mm\" ";
  file << "viewBox=\"0 0 " << pageWidthPx << " " << pageHeightPx << "\">\n";

  // Background
  file << "  <rect width=\"100%\" height=\"100%\" fill=\"white\"/>\n";

  // Title block
  file << "  <g id=\"title\">\n";
  file << "    <text x=\"" << marginPx << "\" y=\"" << (marginPx + 30) << "\" ";
  file << "font-family=\"Arial, sans-serif\" font-size=\"24\" font-weight=\"bold\">";
  file << "HELSCOOP - Construction Blueprint</text>\n";
  file << "    <text x=\"" << marginPx << "\" y=\"" << (marginPx + 50) << "\" ";
  file << "font-family=\"Arial, sans-serif\" font-size=\"14\" fill=\"#666\">";
  file << "Scale: 1:" << static_cast<int>(1000.0f / drawScale) << " | ";
  file << "Dimensions: " << FormatDimension(modelWidth) << " x ";
  file << FormatDimension(modelDepth) << " x " << FormatDimension(modelHeight);
  file << "</text>\n";
  file << "  </g>\n";

  // View positions
  float viewStartY = marginPx + titleHeight * mmToPixel;
  float topViewX = marginPx;
  float topViewY = viewStartY;
  float frontViewX = marginPx;
  float frontViewY = viewStartY + topViewHeight * pixelScale * kSceneScale + viewMargin * mmToPixel;
  float sideViewX = marginPx + frontViewWidth * pixelScale * kSceneScale + viewMargin * mmToPixel;
  float sideViewY = frontViewY;

  // Draw each view
  if (options.includeTopView) {
    file << "  <g id=\"top-view\">\n";
    file << "    <text x=\"" << topViewX << "\" y=\"" << (topViewY - 10) << "\" ";
    file << "font-family=\"Arial\" font-size=\"16\" font-weight=\"bold\">TOP VIEW</text>\n";

    // Project and draw each object
    for (size_t i = 0; i < allGeometry.size(); ++i) {
      manifold::Polygons projected = ProjectView(allGeometry[i], "top");
      if (projected.empty()) continue;

      std::string category = "unknown";
      if (!materialIds[i].empty()) {
        const PBRMaterial* mat = library.get(materialIds[i]);
        if (mat) category = mat->category;
      }
      CategoryColor color = GetCategoryColor(category);

      std::string pathData = PolygonsToSvgPath(projected,
        topViewX - static_cast<float>(bbox.min.x) * pixelScale,
        topViewY + topViewHeight * pixelScale * kSceneScale + static_cast<float>(bbox.min.z) * pixelScale,
        pixelScale, true);

      if (!pathData.empty()) {
        file << "    <path d=\"" << pathData << "\" ";
        file << "fill=\"" << color.fill << "\" fill-opacity=\"0.3\" ";
        file << "stroke=\"" << color.stroke << "\" stroke-width=\"1\"/>\n";
      }
    }
    file << "  </g>\n";
  }

  if (options.includeFrontView) {
    file << "  <g id=\"front-view\">\n";
    file << "    <text x=\"" << frontViewX << "\" y=\"" << (frontViewY - 10) << "\" ";
    file << "font-family=\"Arial\" font-size=\"16\" font-weight=\"bold\">FRONT VIEW</text>\n";

    for (size_t i = 0; i < allGeometry.size(); ++i) {
      manifold::Polygons projected = ProjectView(allGeometry[i], "front");
      if (projected.empty()) continue;

      std::string category = "unknown";
      if (!materialIds[i].empty()) {
        const PBRMaterial* mat = library.get(materialIds[i]);
        if (mat) category = mat->category;
      }
      CategoryColor color = GetCategoryColor(category);

      std::string pathData = PolygonsToSvgPath(projected,
        frontViewX - static_cast<float>(bbox.min.x) * pixelScale,
        frontViewY + frontViewHeight * pixelScale * kSceneScale,
        pixelScale, true);

      if (!pathData.empty()) {
        file << "    <path d=\"" << pathData << "\" ";
        file << "fill=\"" << color.fill << "\" fill-opacity=\"0.3\" ";
        file << "stroke=\"" << color.stroke << "\" stroke-width=\"1\"/>\n";
      }
    }
    file << "  </g>\n";
  }

  if (options.includeSideView) {
    file << "  <g id=\"side-view\">\n";
    file << "    <text x=\"" << sideViewX << "\" y=\"" << (sideViewY - 10) << "\" ";
    file << "font-family=\"Arial\" font-size=\"16\" font-weight=\"bold\">SIDE VIEW</text>\n";

    for (size_t i = 0; i < allGeometry.size(); ++i) {
      manifold::Polygons projected = ProjectView(allGeometry[i], "side");
      if (projected.empty()) continue;

      std::string category = "unknown";
      if (!materialIds[i].empty()) {
        const PBRMaterial* mat = library.get(materialIds[i]);
        if (mat) category = mat->category;
      }
      CategoryColor color = GetCategoryColor(category);

      std::string pathData = PolygonsToSvgPath(projected,
        sideViewX,
        sideViewY + sideViewHeight * pixelScale * kSceneScale,
        pixelScale, true);

      if (!pathData.empty()) {
        file << "    <path d=\"" << pathData << "\" ";
        file << "fill=\"" << color.fill << "\" fill-opacity=\"0.3\" ";
        file << "stroke=\"" << color.stroke << "\" stroke-width=\"1\"/>\n";
      }
    }
    file << "  </g>\n";
  }

  // Parts list on the right
  if (options.includePartsList && !materials.empty()) {
    float listX = pageWidthPx - partsListWidth * mmToPixel - marginPx;
    float listY = viewStartY;

    file << "  <g id=\"parts-list\">\n";
    file << "    <text x=\"" << listX << "\" y=\"" << listY << "\" ";
    file << "font-family=\"Arial\" font-size=\"16\" font-weight=\"bold\">PARTS LIST</text>\n";

    file << "    <line x1=\"" << listX << "\" y1=\"" << (listY + 5) << "\" ";
    file << "x2=\"" << (pageWidthPx - marginPx) << "\" y2=\"" << (listY + 5) << "\" ";
    file << "stroke=\"#333\" stroke-width=\"1\"/>\n";

    float rowY = listY + 25;
    float rowHeight = 18.0f;
    int itemNum = 1;

    for (const auto& item : materials) {
      const PBRMaterial* mat = library.get(item.materialId);
      std::string name = mat ? mat->name : item.materialId;
      std::string category = mat ? mat->category : "unknown";
      CategoryColor color = GetCategoryColor(category);

      // Color swatch
      file << "    <rect x=\"" << listX << "\" y=\"" << (rowY - 12) << "\" ";
      file << "width=\"12\" height=\"12\" fill=\"" << color.fill << "\" ";
      file << "stroke=\"" << color.stroke << "\"/>\n";

      // Item number and name
      file << "    <text x=\"" << (listX + 18) << "\" y=\"" << rowY << "\" ";
      file << "font-family=\"Arial\" font-size=\"11\">";
      file << itemNum << ". " << name << "</text>\n";

      // Quantity
      std::ostringstream qtyStr;
      qtyStr << std::fixed << std::setprecision(1) << item.surfaceArea << " m²";
      file << "    <text x=\"" << (pageWidthPx - marginPx - 5) << "\" y=\"" << rowY << "\" ";
      file << "font-family=\"Arial\" font-size=\"10\" text-anchor=\"end\" fill=\"#666\">";
      file << qtyStr.str() << "</text>\n";

      rowY += rowHeight;
      itemNum++;

      if (rowY > pageHeightPx - marginPx - 50) break;  // Don't overflow
    }

    file << "  </g>\n";
  }

  // Legend
  file << "  <g id=\"legend\">\n";
  float legendX = marginPx;
  float legendY = pageHeightPx - marginPx - 20;
  file << "    <text x=\"" << legendX << "\" y=\"" << legendY << "\" ";
  file << "font-family=\"Arial\" font-size=\"10\" fill=\"#666\">Legend: </text>\n";

  float legendItemX = legendX + 50;
  for (const auto& [cat, color] : kCategoryColors) {
    if (cat == "unknown") continue;
    file << "    <rect x=\"" << legendItemX << "\" y=\"" << (legendY - 10) << "\" ";
    file << "width=\"12\" height=\"12\" fill=\"" << color.fill << "\" stroke=\"" << color.stroke << "\"/>\n";
    file << "    <text x=\"" << (legendItemX + 16) << "\" y=\"" << legendY << "\" ";
    file << "font-family=\"Arial\" font-size=\"10\">" << cat << "</text>\n";
    legendItemX += 80;
  }
  file << "  </g>\n";

  file << "</svg>\n";
  file.close();

  return true;
}

bool ExportPartsList(
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const std::filesystem::path& outputPath,
    std::string& errorMsg) {

  std::ofstream file(outputPath);
  if (!file.is_open()) {
    errorMsg = "Failed to open file: " + outputPath.string();
    return false;
  }

  // CSV header
  file << "Item,Material ID,Name,Category,Quantity,Unit,Surface Area (m²),Unit Price,Total Cost\n";

  auto csvEscape = [](const std::string& s) -> std::string {
    std::string out = "\"";
    for (char c : s) {
      if (c == '"') out += "\"\"";
      else out += c;
    }
    out += '"';
    return out;
  };

  int itemNum = 1;
  float totalCost = 0.0f;

  for (const auto& item : materials) {
    const PBRMaterial* mat = library.get(item.materialId);

    std::string name = mat ? mat->name : item.materialId;
    std::string category = mat ? mat->category : "unknown";
    std::string unit = item.unit.empty() ? "pcs" : item.unit;

    float itemCost = item.surfaceArea * item.unitPrice;
    totalCost += itemCost;

    file << itemNum << ",";
    file << csvEscape(item.materialId) << ",";
    file << csvEscape(name) << ",";
    file << csvEscape(category) << ",";
    file << item.quantity << ",";
    file << csvEscape(unit) << ",";
    file << std::fixed << std::setprecision(2) << item.surfaceArea << ",";
    file << std::setprecision(2) << item.unitPrice << ",";
    file << std::setprecision(2) << itemCost << "\n";

    itemNum++;
  }

  // Total row
  file << "\n,,,,,,TOTAL,,";
  file << std::fixed << std::setprecision(2) << totalCost << "\n";

  file.close();
  return true;
}

bool ExportAssemblyInstructions(
    const SceneData& sceneData,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const AssemblyInstructions& assembly,
    const std::filesystem::path& outputDir,
    std::string& errorMsg) {

  if (assembly.steps.empty()) {
    errorMsg = "No assembly steps to export";
    return false;
  }

  // Create output directory
  std::error_code ec;
  std::filesystem::create_directories(outputDir, ec);
  if (ec) {
    errorMsg = "Failed to create directory: " + outputDir.string();
    return false;
  }

  // Page dimensions (A4 landscape) - larger for better visibility
  const float pageWidthPx = 1200.0f;
  const float pageHeightPx = 800.0f;
  const float marginPx = 40.0f;
  const float headerHeight = 100.0f;
  const float partsListWidth = 200.0f;

  // Drawing area (main view)
  const float drawAreaX = marginPx;
  const float drawAreaY = marginPx + headerHeight;
  const float drawAreaW = pageWidthPx - 2 * marginPx - partsListWidth;
  const float drawAreaH = pageHeightPx - marginPx - headerHeight - 60.0f;

  // Build materialId -> category map
  std::map<std::string, std::string> materialCategories;
  for (const auto& mat : materials) {
    materialCategories[mat.materialId] = mat.category;
  }

  // Export each step as a separate SVG page
  for (size_t stepIdx = 0; stepIdx < assembly.steps.size(); ++stepIdx) {
    const AssemblyStep& step = assembly.steps[stepIdx];

    std::filesystem::path pagePath = outputDir / ("step_" + std::to_string(step.stepNumber) + ".svg");
    std::ofstream file(pagePath);
    if (!file.is_open()) {
      errorMsg = "Failed to create file: " + pagePath.string();
      return false;
    }

    // Collect visible geometry for THIS step and compute bounding box
    std::set<size_t> visibleSet(step.objectIndices.begin(), step.objectIndices.end());
    std::set<size_t> newSet(step.newObjectIndices.begin(), step.newObjectIndices.end());

    std::vector<manifold::Manifold> stepGeometry;
    for (size_t idx : step.objectIndices) {
      if (idx < sceneData.objects.size()) {
        const auto& obj = sceneData.objects[idx];
        if (obj.geometry && !obj.geometry->IsEmpty()) {
          // Rotate for isometric view
          stepGeometry.push_back(obj.geometry->Rotate(25.0, 0.0, 0.0).Rotate(0.0, -35.0, 0.0));
        }
      }
    }

    if (stepGeometry.empty()) continue;

    manifold::Manifold stepCombined = manifold::Manifold::Compose(stepGeometry);
    manifold::Box stepBbox = stepCombined.BoundingBox();

    // Calculate proper scale to fill the drawing area
    float bboxW = static_cast<float>(stepBbox.max.x - stepBbox.min.x);
    float bboxH = static_cast<float>(stepBbox.max.y - stepBbox.min.y);
    if (bboxW < 0.001f) bboxW = 1.0f;
    if (bboxH < 0.001f) bboxH = 1.0f;

    float scaleX = (drawAreaW * 0.85f) / bboxW;
    float scaleY = (drawAreaH * 0.85f) / bboxH;
    float pixelScale = std::min(scaleX, scaleY);

    // Center the drawing
    float scaledW = bboxW * pixelScale;
    float scaledH = bboxH * pixelScale;
    float centerX = drawAreaX + (drawAreaW - scaledW) / 2.0f;
    float centerY = drawAreaY + (drawAreaH - scaledH) / 2.0f;

    // SVG header
    file << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    file << "<svg xmlns=\"http://www.w3.org/2000/svg\" ";
    file << "width=\"" << pageWidthPx << "\" height=\"" << pageHeightPx << "\" ";
    file << "viewBox=\"0 0 " << pageWidthPx << " " << pageHeightPx << "\">\n";

    // Background
    file << "  <rect width=\"100%\" height=\"100%\" fill=\"#fafafa\"/>\n";

    // Header background
    file << "  <rect x=\"0\" y=\"0\" width=\"" << pageWidthPx << "\" height=\"" << (marginPx + headerHeight) << "\" fill=\"#2c3e50\"/>\n";

    // Step number (big)
    file << "  <text x=\"" << marginPx << "\" y=\"" << (marginPx + 50) << "\" ";
    file << "font-family=\"Arial, sans-serif\" font-size=\"48\" font-weight=\"bold\" fill=\"white\">";
    file << "STEP " << step.stepNumber << "</text>\n";

    // Step title
    file << "  <text x=\"" << marginPx << "\" y=\"" << (marginPx + 80) << "\" ";
    file << "font-family=\"Arial\" font-size=\"20\" fill=\"#ecf0f1\">";
    file << step.title << "</text>\n";

    // Step counter on right
    file << "  <text x=\"" << (pageWidthPx - marginPx) << "\" y=\"" << (marginPx + 50) << "\" ";
    file << "font-family=\"Arial\" font-size=\"24\" fill=\"#95a5a6\" text-anchor=\"end\">";
    file << step.stepNumber << " / " << assembly.steps.size() << "</text>\n";

    // Drawing area border
    file << "  <rect x=\"" << drawAreaX << "\" y=\"" << drawAreaY << "\" ";
    file << "width=\"" << drawAreaW << "\" height=\"" << drawAreaH << "\" ";
    file << "fill=\"white\" stroke=\"#ddd\" stroke-width=\"1\"/>\n";

    // Draw each object
    file << "  <g id=\"assembly-view\">\n";

    for (size_t objIdx = 0; objIdx < sceneData.objects.size(); ++objIdx) {
      if (visibleSet.find(objIdx) == visibleSet.end()) continue;

      const auto& obj = sceneData.objects[objIdx];
      if (!obj.geometry || obj.geometry->IsEmpty()) continue;

      // Rotate for isometric view (same as bounding box calculation)
      manifold::Manifold rotated = obj.geometry->Rotate(25.0, 0.0, 0.0).Rotate(0.0, -35.0, 0.0);
      manifold::Polygons projected = rotated.Project();
      if (projected.empty()) continue;

      std::string category = "unknown";
      auto it = materialCategories.find(obj.materialId);
      if (it != materialCategories.end()) {
        category = it->second;
      }
      CategoryColor color = GetCategoryColor(category);

      bool isNew = newSet.find(objIdx) != newSet.end();

      // Transform coordinates: center and scale
      float offsetX = centerX - static_cast<float>(stepBbox.min.x) * pixelScale;
      float offsetY = centerY + scaledH + static_cast<float>(stepBbox.min.y) * pixelScale;

      std::string pathData = PolygonsToSvgPath(projected, offsetX, offsetY, pixelScale, true);

      if (!pathData.empty()) {
        file << "    <path d=\"" << pathData << "\" ";
        if (isNew) {
          // Highlight new parts - bright fill, thick stroke
          file << "fill=\"" << color.fill << "\" fill-opacity=\"0.7\" ";
          file << "stroke=\"#e74c3c\" stroke-width=\"3\"/>\n";
        } else {
          // Previous parts - subtle
          file << "fill=\"" << color.fill << "\" fill-opacity=\"0.25\" ";
          file << "stroke=\"" << color.stroke << "\" stroke-width=\"1\" stroke-opacity=\"0.4\"/>\n";
        }
      }
    }
    file << "  </g>\n";

    // Parts list panel on the right
    float listX = pageWidthPx - partsListWidth - marginPx + 20;
    float listY = drawAreaY + 20;

    // Panel background
    file << "  <rect x=\"" << (listX - 15) << "\" y=\"" << (listY - 15) << "\" ";
    file << "width=\"" << (partsListWidth - 10) << "\" height=\"" << (drawAreaH - 10) << "\" ";
    file << "fill=\"#f8f9fa\" stroke=\"#e9ecef\" stroke-width=\"1\" rx=\"5\"/>\n";

    file << "  <g id=\"parts-list\">\n";
    file << "    <text x=\"" << listX << "\" y=\"" << listY << "\" ";
    file << "font-family=\"Arial\" font-size=\"14\" font-weight=\"bold\" fill=\"#e74c3c\">NEW PARTS</text>\n";
    listY += 25;

    // Count new parts by material
    std::map<std::string, int> partCounts;
    for (size_t idx : step.newObjectIndices) {
      if (idx < sceneData.objects.size()) {
        partCounts[sceneData.objects[idx].materialId]++;
      }
    }

    for (const auto& [matId, count] : partCounts) {
      const PBRMaterial* mat = library.get(matId);
      std::string name = mat ? mat->name : matId;
      std::string category = mat ? mat->category : "unknown";

      CategoryColor cc = GetCategoryColor(category);

      // Color swatch with red border for new parts
      file << "    <rect x=\"" << listX << "\" y=\"" << (listY - 12) << "\" ";
      file << "width=\"14\" height=\"14\" fill=\"" << cc.fill << "\" stroke=\"#e74c3c\" stroke-width=\"2\" rx=\"2\"/>\n";

      // Part count and name
      file << "    <text x=\"" << (listX + 20) << "\" y=\"" << listY << "\" ";
      file << "font-family=\"Arial\" font-size=\"12\" fill=\"#333\">" << count << "x</text>\n";
      file << "    <text x=\"" << (listX + 45) << "\" y=\"" << listY << "\" ";
      file << "font-family=\"Arial\" font-size=\"11\" fill=\"#666\">" << name << "</text>\n";
      listY += 22;

      if (listY > drawAreaY + drawAreaH - 40) break;
    }
    file << "  </g>\n";

    // Description at bottom if present
    if (!step.description.empty()) {
      file << "  <text x=\"" << (pageWidthPx / 2) << "\" y=\"" << (pageHeightPx - 25) << "\" ";
      file << "font-family=\"Arial\" font-size=\"14\" fill=\"#666\" text-anchor=\"middle\">";
      file << step.description << "</text>\n";
    }

    // Footer
    file << "  <text x=\"" << marginPx << "\" y=\"" << (pageHeightPx - 10) << "\" ";
    file << "font-family=\"Arial\" font-size=\"10\" fill=\"#aaa\">";
    file << assembly.projectName << " Assembly Instructions</text>\n";

    file << "</svg>\n";
    file.close();
  }

  // Also create an index HTML file to view all steps
  std::filesystem::path indexPath = outputDir / "index.html";
  std::ofstream indexFile(indexPath);
  if (indexFile.is_open()) {
    indexFile << "<!DOCTYPE html>\n<html>\n<head>\n";
    indexFile << "<title>" << assembly.projectName << " Assembly Instructions</title>\n";
    indexFile << "<style>\n";
    indexFile << "body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }\n";
    indexFile << "h1 { color: #333; }\n";
    indexFile << ".step { display: inline-block; margin: 10px; background: white; ";
    indexFile << "box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\n";
    indexFile << ".step img { width: 400px; border: 1px solid #ddd; }\n";
    indexFile << ".step-label { padding: 10px; text-align: center; font-weight: bold; }\n";
    indexFile << "</style>\n</head>\n<body>\n";
    indexFile << "<h1>" << assembly.projectName << " Assembly Instructions</h1>\n";
    indexFile << "<p>" << assembly.steps.size() << " steps total</p>\n";

    for (size_t i = 0; i < assembly.steps.size(); ++i) {
      const auto& step = assembly.steps[i];
      indexFile << "<div class=\"step\">\n";
      indexFile << "  <img src=\"step_" << step.stepNumber << ".svg\" alt=\"Step " << step.stepNumber << "\">\n";
      indexFile << "  <div class=\"step-label\">Step " << step.stepNumber << ": " << step.title << "</div>\n";
      indexFile << "</div>\n";
    }

    indexFile << "</body>\n</html>\n";
    indexFile.close();
  }

  return true;
}

}  // namespace helscoop
