#include "structural.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <set>

namespace helscoop {

const char* GetSeverityString(StructuralSeverity severity) {
  switch (severity) {
    case StructuralSeverity::Info: return "INFO";
    case StructuralSeverity::Warning: return "WARNING";
    case StructuralSeverity::Error: return "ERROR";
    case StructuralSeverity::Critical: return "CRITICAL";
    default: return "UNKNOWN";
  }
}

const char* GetIssueTypeString(StructuralIssueType type) {
  switch (type) {
    case StructuralIssueType::SpanExceeded: return "Span Exceeded";
    case StructuralIssueType::SpacingTooWide: return "Spacing Too Wide";
    case StructuralIssueType::UnsupportedLoad: return "Unsupported Load";
    case StructuralIssueType::InsufficientBearing: return "Insufficient Bearing";
    case StructuralIssueType::MissingConnector: return "Missing Connector";
    case StructuralIssueType::GradeInsufficient: return "Grade Insufficient";
    case StructuralIssueType::CrossSectionSmall: return "Cross-Section Too Small";
    case StructuralIssueType::RafterPitchIssue: return "Rafter Pitch Issue";
    case StructuralIssueType::SnowLoadConcern: return "Snow Load Concern";
    case StructuralIssueType::WindBracingNeeded: return "Wind Bracing Needed";
    default: return "Unknown Issue";
  }
}

// Helper: classify member by dimensions and orientation
enum class MemberType {
  Unknown,
  WallStud,      // Vertical, in wall plane
  FloorJoist,    // Horizontal, spanning floor
  CeilingJoist,  // Horizontal, at ceiling level
  Rafter,        // Sloped, roof member
  Beam,          // Horizontal, large cross-section
  Post,          // Vertical, large cross-section
  Plate,         // Horizontal, wall top/bottom
  Ridge,         // Horizontal, at roof peak
};

struct MemberInfo {
  MemberType type;
  float length_mm;
  float width_mm;
  float height_mm;
  float centerX, centerY, centerZ;
  float minZ, maxZ;
  bool isVertical;
  bool isSloped;
};

static MemberInfo ClassifyMember(const BoundingBox& bbox, float sceneScale) {
  MemberInfo info;

  // Convert to mm
  float dimX = (bbox.max.x - bbox.min.x) / sceneScale * 1000.0f;
  float dimY = (bbox.max.y - bbox.min.y) / sceneScale * 1000.0f;
  float dimZ = (bbox.max.z - bbox.min.z) / sceneScale * 1000.0f;

  info.centerX = (bbox.min.x + bbox.max.x) / 2.0f / sceneScale * 1000.0f;
  info.centerY = (bbox.min.y + bbox.max.y) / 2.0f / sceneScale * 1000.0f;
  info.centerZ = (bbox.min.z + bbox.max.z) / 2.0f / sceneScale * 1000.0f;
  info.minZ = bbox.min.z / sceneScale * 1000.0f;
  info.maxZ = bbox.max.z / sceneScale * 1000.0f;

  // Length is longest dimension
  info.length_mm = std::max({dimX, dimY, dimZ});

  // Sort dimensions to get cross-section
  std::vector<float> dims = {dimX, dimY, dimZ};
  std::sort(dims.begin(), dims.end());
  info.width_mm = dims[0];   // Smallest
  info.height_mm = dims[1];  // Middle

  // Determine orientation
  info.isVertical = (dimY >= dimX * 3) && (dimY >= dimZ * 3);

  // Sloped if neither horizontal nor vertical (rough check)
  float maxHoriz = std::max(dimX, dimZ);
  info.isSloped = (dimY > maxHoriz * 0.3f) && (dimY < maxHoriz * 2.0f) && !info.isVertical;

  // Classify member type
  float aspectRatio = info.length_mm / std::max(info.width_mm, 1.0f);

  if (info.isVertical) {
    if (info.width_mm > 100 && info.height_mm > 100) {
      info.type = MemberType::Post;
    } else {
      info.type = MemberType::WallStud;
    }
  } else if (info.isSloped) {
    info.type = MemberType::Rafter;
  } else {
    // Horizontal member
    if (aspectRatio < 3) {
      // Short and squat - probably a plate or block
      info.type = MemberType::Plate;
    } else if (info.width_mm > 100 && info.height_mm > 140) {
      info.type = MemberType::Beam;
    } else {
      // Check height to determine floor vs ceiling joist
      info.type = MemberType::FloorJoist;
    }
  }

  return info;
}

StructuralAnalysisResult AnalyzeStructure(
    const std::vector<ModelWithColor>& models,
    const SceneData& sceneData,
    const MaterialLibrary& library,
    float sceneScale) {

  StructuralAnalysisResult result;

  // Track members by type for spacing analysis
  std::vector<std::pair<size_t, MemberInfo>> studs;
  std::vector<std::pair<size_t, MemberInfo>> joists;
  std::vector<std::pair<size_t, MemberInfo>> rafters;

  // Standard limits (based on Nordic building codes / EC5)
  const float kMaxStudSpacing_mm = 600.0f;    // Max 600mm o.c.
  const float kMaxJoistSpacing_mm = 600.0f;   // Max 600mm o.c.
  const float kMaxRafterSpacing_mm = 900.0f;  // Max 900mm o.c. (with sheathing)
  const float kMinBearingLength_mm = 38.0f;   // Min bearing at supports

  // Nordic climate factors
  const float kSnowLoad_kN_m2 = 2.0f;  // ~200 kg/m² for Southern Finland
  const float kWindPressure_kN_m2 = 0.6f;

  for (size_t i = 0; i < models.size(); ++i) {
    const auto& model = models[i];
    if (model.materialId.empty()) continue;

    const PBRMaterial* mat = library.get(model.materialId);
    if (!mat) continue;

    // Only analyze lumber members
    if (mat->category != "lumber") continue;

    // Get bounding box and classify
    BoundingBox bbox = GetModelBoundingBox(model.model);
    MemberInfo info = ClassifyMember(bbox, sceneScale);

    // Count lumber for stats
    result.totalLumberLength_m += info.length_mm / 1000.0f;

    // Collect members for spacing analysis
    switch (info.type) {
      case MemberType::WallStud:
        studs.push_back({i, info});
        result.studCount++;
        break;
      case MemberType::FloorJoist:
      case MemberType::CeilingJoist:
        joists.push_back({i, info});
        result.joistCount++;
        break;
      case MemberType::Rafter:
        rafters.push_back({i, info});
        result.rafterCount++;
        break;
      default:
        break;
    }

    // === CHECK 1: Span limits ===
    float maxSpan = 0;
    if (info.type == MemberType::WallStud || info.type == MemberType::Post) {
      maxSpan = mat->structural.maxSpan_wall_mm;
    } else if (info.type == MemberType::FloorJoist) {
      maxSpan = mat->structural.maxSpan_floor_mm;
    } else if (info.type == MemberType::Rafter) {
      maxSpan = mat->structural.maxSpan_rafter_mm;
    }

    if (maxSpan > 0 && info.length_mm > maxSpan) {
      StructuralCheck check;
      check.memberName = mat->name;
      check.materialId = model.materialId;
      check.issueType = StructuralIssueType::SpanExceeded;
      check.severity = (info.length_mm > maxSpan * 1.2f)
          ? StructuralSeverity::Error
          : StructuralSeverity::Warning;
      check.actualSpan_mm = info.length_mm;
      check.maxAllowedSpan_mm = maxSpan;
      check.description = "Member spans " + std::to_string((int)info.length_mm) +
                          "mm but max allowed is " + std::to_string((int)maxSpan) + "mm";
      check.suggestedFix = FindSuitableMaterial(library, info.length_mm, info.isVertical);
      check.reference = "EC5 Table 7.2";
      check.objectIndex = i;

      result.checks.push_back(check);
      if (check.severity == StructuralSeverity::Error) {
        result.errorCount++;
      } else {
        result.warningCount++;
      }
      result.allPassed = false;
    }

    // === CHECK 2: Cross-section adequacy for long spans ===
    if (info.length_mm > 2000 && info.type == MemberType::FloorJoist) {
      float depthRatio = info.length_mm / info.height_mm;
      // Rule of thumb: span/depth should be < 20 for floor joists
      if (depthRatio > 20) {
        StructuralCheck check;
        check.memberName = mat->name;
        check.materialId = model.materialId;
        check.issueType = StructuralIssueType::CrossSectionSmall;
        check.severity = StructuralSeverity::Warning;
        check.description = "Floor joist depth (" + std::to_string((int)info.height_mm) +
                            "mm) may be insufficient for " + std::to_string((int)info.length_mm) + "mm span";
        check.suggestedFix = "Use deeper joist (e.g., 48x198 or 48x223)";
        check.reference = "EC5 7.2 - Deflection limits";
        check.objectIndex = i;

        result.checks.push_back(check);
        result.warningCount++;
        result.allPassed = false;
      }
    }
  }

  // === CHECK 3: Stud spacing analysis ===
  if (studs.size() > 1) {
    // Group studs by approximate wall (same Y or same X coordinate)
    std::map<int, std::vector<std::pair<size_t, MemberInfo>>> wallGroups;
    for (const auto& [idx, info] : studs) {
      // Round to 100mm grid for grouping
      int wallKey = (int)(info.centerX / 100) * 1000 + (int)(info.centerZ / 100);
      wallGroups[wallKey].push_back({idx, info});
    }

    for (auto& [key, wallStuds] : wallGroups) {
      if (wallStuds.size() < 2) continue;

      // Sort by position along wall
      std::sort(wallStuds.begin(), wallStuds.end(),
        [](const auto& a, const auto& b) {
          return a.second.centerY < b.second.centerY;
        });

      // Check spacing between adjacent studs
      for (size_t s = 1; s < wallStuds.size(); ++s) {
        float spacing = std::abs(wallStuds[s].second.centerY - wallStuds[s-1].second.centerY);

        if (spacing > kMaxStudSpacing_mm * 1.1f) {  // Allow 10% tolerance
          StructuralCheck check;
          check.memberName = "Wall Studs";
          check.issueType = StructuralIssueType::SpacingTooWide;
          check.severity = (spacing > kMaxStudSpacing_mm * 1.5f)
              ? StructuralSeverity::Error
              : StructuralSeverity::Warning;
          check.actualSpacing_mm = spacing;
          check.maxAllowedSpacing_mm = kMaxStudSpacing_mm;
          check.description = "Stud spacing " + std::to_string((int)spacing) +
                              "mm exceeds max " + std::to_string((int)kMaxStudSpacing_mm) + "mm";
          check.suggestedFix = "Add intermediate stud or reduce spacing";
          check.reference = "EC5 9.2.4 - Wall bracing";
          check.objectIndex = wallStuds[s].first;

          result.checks.push_back(check);
          if (check.severity == StructuralSeverity::Error) {
            result.errorCount++;
          } else {
            result.warningCount++;
          }
          result.allPassed = false;
        }
      }
    }
  }

  // === CHECK 4: Floor joist spacing ===
  if (joists.size() > 1) {
    // Sort by Y position
    std::vector<std::pair<size_t, MemberInfo>> sortedJoists = joists;
    std::sort(sortedJoists.begin(), sortedJoists.end(),
      [](const auto& a, const auto& b) {
        return a.second.centerY < b.second.centerY;
      });

    for (size_t j = 1; j < sortedJoists.size(); ++j) {
      float spacing = std::abs(sortedJoists[j].second.centerY - sortedJoists[j-1].second.centerY);

      if (spacing > kMaxJoistSpacing_mm * 1.1f) {
        StructuralCheck check;
        check.memberName = "Floor Joists";
        check.issueType = StructuralIssueType::SpacingTooWide;
        check.severity = StructuralSeverity::Warning;
        check.actualSpacing_mm = spacing;
        check.maxAllowedSpacing_mm = kMaxJoistSpacing_mm;
        check.description = "Joist spacing " + std::to_string((int)spacing) +
                            "mm exceeds max " + std::to_string((int)kMaxJoistSpacing_mm) + "mm";
        check.suggestedFix = "Add intermediate joist";
        check.reference = "EC5 7.3.1 - Floor design";
        check.objectIndex = sortedJoists[j].first;

        result.checks.push_back(check);
        result.warningCount++;
        result.allPassed = false;
      }
    }
  }

  // === CHECK 5: Snow load concerns for Nordic climate ===
  if (rafters.size() > 0) {
    // Check if rafters are adequate for snow load
    for (const auto& [idx, info] : rafters) {
      // Simplified snow load check: rafter span > 3m with standard 48x98 is marginal
      if (info.length_mm > 3000 && info.height_mm < 140) {
        StructuralCheck check;
        check.memberName = "Roof Rafter";
        check.issueType = StructuralIssueType::SnowLoadConcern;
        check.severity = StructuralSeverity::Warning;
        check.description = "Rafter may be undersized for " + std::to_string((int)kSnowLoad_kN_m2) +
                            " kN/m² snow load in Nordic climate";
        check.suggestedFix = "Use 48x148 or 48x198 rafters, or add collar ties";
        check.reference = "EC5 + EN 1991-1-3 (Snow loads)";
        check.objectIndex = idx;

        result.checks.push_back(check);
        result.warningCount++;
        result.allPassed = false;
      }
    }
  }

  // === CHECK 6: Wind bracing requirement ===
  // Simple check: walls longer than 4m should have diagonal bracing or sheathing
  float maxWallLength = 0;
  for (const auto& [idx, info] : studs) {
    maxWallLength = std::max(maxWallLength, info.length_mm);
  }

  // Check if there's sheathing (would provide racking resistance)
  bool hasSheathing = false;
  for (const auto& model : models) {
    const PBRMaterial* mat = library.get(model.materialId);
    if (mat && mat->category == "sheathing") {
      hasSheathing = true;
      break;
    }
  }

  // If walls are present but no sheathing, warn about bracing
  if (studs.size() > 8 && !hasSheathing) {
    StructuralCheck check;
    check.memberName = "Wall System";
    check.issueType = StructuralIssueType::WindBracingNeeded;
    check.severity = StructuralSeverity::Info;
    check.description = "Wall framing detected without sheathing - ensure diagonal bracing or let-in braces are installed";
    check.suggestedFix = "Add OSB/plywood sheathing or diagonal metal strapping";
    check.reference = "EC5 9.2.4 - Lateral stability";

    result.checks.push_back(check);
    result.infoCount++;
  }

  // === CHECK 7: Hurricane/connector requirements at roof-wall connection ===
  if (rafters.size() > 0 && studs.size() > 0) {
    // Check if joist hangers or hurricane clips material is present
    bool hasConnectors = false;
    for (const auto& model : models) {
      const PBRMaterial* mat = library.get(model.materialId);
      if (mat && (mat->category == "hardware" ||
                  model.materialId.find("hanger") != std::string::npos ||
                  model.materialId.find("clip") != std::string::npos)) {
        hasConnectors = true;
        break;
      }
    }

    if (!hasConnectors) {
      StructuralCheck check;
      check.memberName = "Roof-Wall Connection";
      check.issueType = StructuralIssueType::MissingConnector;
      check.severity = StructuralSeverity::Warning;
      check.description = "No hurricane clips or rafter ties detected at roof-wall connections";
      check.suggestedFix = "Install hurricane clips (Simpson H2.5A or equivalent) at each rafter";
      check.reference = "EC5 8.5 - Connection design";

      result.checks.push_back(check);
      result.warningCount++;
      result.allPassed = false;
    }
  }

  return result;
}

std::string FindSuitableMaterial(
    const MaterialLibrary& library,
    float requiredSpan_mm,
    bool isVertical) {

  float bestSpan = 0;
  std::string bestMaterial;

  for (const auto& [id, mat] : library.materials) {
    if (mat.category != "lumber") continue;

    float maxSpan = isVertical
        ? mat.structural.maxSpan_wall_mm
        : mat.structural.maxSpan_floor_mm;

    // Find the smallest material that still meets the requirement
    if (maxSpan >= requiredSpan_mm) {
      if (bestSpan == 0 || maxSpan < bestSpan) {
        bestSpan = maxSpan;
        bestMaterial = mat.name;
      }
    }
  }

  if (bestMaterial.empty()) {
    return "Consider engineered lumber (LVL, I-joist) or add intermediate support";
  }
  return "Upgrade to: " + bestMaterial;
}

}  // namespace helscoop
