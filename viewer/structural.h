#pragma once

#include "types.h"

#include <string>
#include <vector>

namespace helscoop {

// Types of structural issues
enum class StructuralIssueType {
  SpanExceeded,       // Member spans farther than allowed
  SpacingTooWide,     // Studs/joists spaced too far apart
  UnsupportedLoad,    // Missing support point
  InsufficientBearing,// Bearing area too small
  MissingConnector,   // Connection hardware needed
  GradeInsufficient,  // Lumber grade too low for application
  CrossSectionSmall,  // Member too small for load
  RafterPitchIssue,   // Roof pitch creates excessive load
  SnowLoadConcern,    // Nordic climate snow load warning
  WindBracingNeeded,  // Lateral bracing required
};

// Severity levels
enum class StructuralSeverity {
  Info,       // Good practice suggestion
  Warning,    // Should be addressed
  Error,      // Must be fixed before building
  Critical,   // Safety hazard
};

// Result of a single structural check
struct StructuralCheck {
  std::string memberName;
  std::string materialId;
  StructuralIssueType issueType;
  StructuralSeverity severity;

  // Span-related
  float actualSpan_mm = 0;
  float maxAllowedSpan_mm = 0;

  // Spacing-related
  float actualSpacing_mm = 0;
  float maxAllowedSpacing_mm = 0;

  // General
  std::string description;
  std::string suggestedFix;
  std::string reference;  // Code reference (e.g., "EC5 6.1.1")

  size_t objectIndex = 0;  // For highlighting in 3D view
};

// Overall structural analysis result
struct StructuralAnalysisResult {
  std::vector<StructuralCheck> checks;
  int infoCount = 0;
  int warningCount = 0;
  int errorCount = 0;
  int criticalCount = 0;
  bool allPassed = true;

  // Summary stats
  float totalLumberLength_m = 0;
  float totalLoadBearingArea_m2 = 0;
  int studCount = 0;
  int joistCount = 0;
  int rafterCount = 0;
};

// Analyze structural members for span violations
StructuralAnalysisResult AnalyzeStructure(
    const std::vector<ModelWithColor>& models,
    const SceneData& sceneData,
    const MaterialLibrary& library,
    float sceneScale);

// Find a suitable material for the required span
std::string FindSuitableMaterial(
    const MaterialLibrary& library,
    float requiredSpan_mm,
    bool isVertical);

// Get severity string for display
const char* GetSeverityString(StructuralSeverity severity);

// Get issue type string for display
const char* GetIssueTypeString(StructuralIssueType type);

}  // namespace helscoop
