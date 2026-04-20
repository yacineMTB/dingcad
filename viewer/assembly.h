#pragma once

#include <string>
#include <vector>

namespace helscoop {

// Forward declarations
struct SceneData;
struct MaterialItem;

// Part required for an assembly step
struct AssemblyPart {
  std::string name;        // e.g. "2x6x8 Pressure Treated"
  std::string materialId;  // Reference to material library (optional)
  std::string quantity;    // e.g. "8", "2.4m", "500g" - string for flexibility
  std::string note;        // Optional note (e.g. "cut to 1200mm")
  float unitPrice = 0.0f;  // Price per unit (from material library or manual)
};

// A detailed instruction sub-step
struct SubStep {
  std::string instruction;  // e.g. "Mark paver positions using string line"
  std::string tip;          // Optional pro tip or warning
  int timeMinutes = 0;      // Estimated time in minutes
};

// An assembly step with parts to add
struct AssemblyStep {
  int stepNumber = 0;
  std::string title;       // e.g. "Build Floor Frame"
  std::string description; // Optional longer description

  // Material-based approach: which materials are visible at this step
  // This is cumulative - each step adds new materials to show
  std::vector<std::string> showMaterials;  // e.g. ["concrete_paver", "pine_48x148_c24"]

  // Object-based approach: specific object IDs to show (more fine-grained than materials)
  // If non-empty, only these objects are shown (ignoring showMaterials)
  std::vector<std::string> showObjects;   // e.g. ["front_wall", "back_wall"]

  // Computed at render time from showMaterials or showObjects:
  std::vector<size_t> objectIndices;      // All objects visible in this step
  std::vector<size_t> newObjectIndices;   // Objects being added (highlighted)

  // Explicit parts list with quantities (hardware, fasteners, etc.)
  std::vector<AssemblyPart> parts;

  // Detailed sub-steps for this assembly step
  std::vector<SubStep> subSteps;

  // Estimated time for entire step (sum of subSteps or manual)
  int totalTimeMinutes = 0;

  // Calculated material cost for this step
  float stepCost = 0.0f;
};

// Assembly instructions for a scene
struct AssemblyInstructions {
  std::string projectName;
  std::vector<AssemblyStep> steps;

  // Returns all object indices visible up to and including stepIndex
  std::vector<size_t> GetVisibleObjects(size_t stepIndex) const {
    std::vector<size_t> visible;
    for (size_t i = 0; i <= stepIndex && i < steps.size(); ++i) {
      for (size_t idx : steps[i].objectIndices) {
        visible.push_back(idx);
      }
    }
    return visible;
  }

  // Returns objects being added in a specific step (for highlighting)
  std::vector<size_t> GetNewObjects(size_t stepIndex) const {
    if (stepIndex < steps.size()) {
      return steps[stepIndex].newObjectIndices;
    }
    return {};
  }
};

// Generate default assembly instructions by grouping objects by material category
// This provides a sensible default: foundation -> framing -> sheathing -> roofing -> insulation
AssemblyInstructions GenerateDefaultAssembly(const SceneData& sceneData,
                                              const std::vector<MaterialItem>& materials);

// Parse assembly instructions from scene metadata (if defined)
// Returns empty instructions if not defined in scene
AssemblyInstructions ParseAssemblyFromScene(const SceneData& sceneData);

// Resolve material-based assembly steps to actual object indices
// Call this after loading scene to populate objectIndices/newObjectIndices from showMaterials
void ResolveAssemblyMaterials(AssemblyInstructions& assembly, const SceneData& sceneData);

}  // namespace helscoop
