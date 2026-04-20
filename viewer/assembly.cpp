#include "assembly.h"
#include "types.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <set>

namespace helscoop {

// Order of construction phases for default assembly generation
static const std::vector<std::string> kConstructionOrder = {
    "masonry",     // Foundation/concrete blocks first
    "lumber",      // Framing
    "sheathing",   // OSB/plywood sheathing
    "roofing",     // Roof panels
    "insulation",  // Insulation
    "hardware",    // Hardware/mesh
    "finish",      // Finishing touches
    "unknown",     // Anything else last
};

static int GetCategoryOrder(const std::string& category) {
  for (size_t i = 0; i < kConstructionOrder.size(); ++i) {
    if (kConstructionOrder[i] == category) {
      return static_cast<int>(i);
    }
  }
  return static_cast<int>(kConstructionOrder.size());
}

// Get center point of an object's bounding box
static manifold::vec3 GetObjectCenter(const ColoredObject& obj) {
  if (!obj.geometry || obj.geometry->IsEmpty()) {
    return {0, 0, 0};
  }
  manifold::Box bbox = obj.geometry->BoundingBox();
  return {
    (bbox.min.x + bbox.max.x) / 2.0,
    (bbox.min.y + bbox.max.y) / 2.0,
    (bbox.min.z + bbox.max.z) / 2.0
  };
}

// Distance between two 3D points
static double Distance(const manifold::vec3& a, const manifold::vec3& b) {
  double dx = a.x - b.x;
  double dy = a.y - b.y;
  double dz = a.z - b.z;
  return std::sqrt(dx*dx + dy*dy + dz*dz);
}

// Cluster objects by spatial proximity
// Returns groups of object indices that are close together
static std::vector<std::vector<size_t>> ClusterBySpatialProximity(
    const SceneData& sceneData,
    const std::vector<size_t>& objectIndices,
    size_t maxPerGroup) {

  if (objectIndices.empty()) return {};
  if (objectIndices.size() <= maxPerGroup) {
    return {objectIndices};
  }

  // Get centers for all objects
  std::vector<std::pair<size_t, manifold::vec3>> objCenters;
  for (size_t idx : objectIndices) {
    if (idx < sceneData.objects.size()) {
      objCenters.push_back({idx, GetObjectCenter(sceneData.objects[idx])});
    }
  }

  // Sort by Y (height) first, then by position - build from bottom up
  std::sort(objCenters.begin(), objCenters.end(),
    [](const auto& a, const auto& b) {
      // Primary sort by Y (height) - lower objects first
      if (std::abs(a.second.y - b.second.y) > 50.0) {
        return a.second.y < b.second.y;
      }
      // Secondary sort by X
      if (std::abs(a.second.x - b.second.x) > 50.0) {
        return a.second.x < b.second.x;
      }
      // Tertiary sort by Z
      return a.second.z < b.second.z;
    });

  // Group into chunks of maxPerGroup
  std::vector<std::vector<size_t>> groups;
  std::vector<size_t> currentGroup;

  for (const auto& [idx, center] : objCenters) {
    currentGroup.push_back(idx);
    if (currentGroup.size() >= maxPerGroup) {
      groups.push_back(currentGroup);
      currentGroup.clear();
    }
  }

  if (!currentGroup.empty()) {
    groups.push_back(currentGroup);
  }

  return groups;
}

// Generate step title based on category and what's being added
static std::string GenerateStepTitle(const std::string& category,
                                      int stepInCategory,
                                      int totalInCategory,
                                      size_t partCount) {
  std::string partWord = partCount == 1 ? "piece" : "pieces";

  if (category == "masonry") {
    if (totalInCategory == 1) return "Lay Foundation Blocks";
    return "Lay Foundation (" + std::to_string(stepInCategory) + "/" +
           std::to_string(totalInCategory) + ")";
  } else if (category == "lumber") {
    if (totalInCategory == 1) return "Assemble Frame";
    if (stepInCategory == 1) return "Start Frame Assembly";
    if (stepInCategory == totalInCategory) return "Complete Frame";
    return "Add Frame " + std::to_string(partCount) + " " + partWord;
  } else if (category == "sheathing") {
    if (totalInCategory == 1) return "Install Wall Panels";
    return "Attach Panel " + std::to_string(stepInCategory) + "/" +
           std::to_string(totalInCategory);
  } else if (category == "roofing") {
    if (totalInCategory == 1) return "Install Roof";
    return "Add Roof Section " + std::to_string(stepInCategory);
  } else if (category == "insulation") {
    if (totalInCategory == 1) return "Add Insulation";
    return "Install Insulation " + std::to_string(stepInCategory) + "/" +
           std::to_string(totalInCategory);
  } else if (category == "hardware") {
    return "Install Hardware";
  } else if (category == "finish") {
    return "Finishing Touches";
  }

  return "Install " + std::to_string(partCount) + " " + partWord;
}

AssemblyInstructions GenerateDefaultAssembly(const SceneData& sceneData,
                                              const std::vector<MaterialItem>& materials) {
  AssemblyInstructions assembly;
  assembly.projectName = "Project";

  // Maximum parts per step - IKEA style is 1-4 parts per step
  const size_t kMaxPartsPerStep = 3;

  // Build a map of materialId -> category
  std::map<std::string, std::string> materialCategories;
  for (const auto& mat : materials) {
    materialCategories[mat.materialId] = mat.category;
  }

  // Group objects by category
  std::map<std::string, std::vector<size_t>> categoryObjects;
  for (size_t i = 0; i < sceneData.objects.size(); ++i) {
    const auto& obj = sceneData.objects[i];
    if (!obj.geometry || obj.geometry->IsEmpty()) continue;

    std::string category = "unknown";
    auto it = materialCategories.find(obj.materialId);
    if (it != materialCategories.end()) {
      category = it->second;
    }
    categoryObjects[category].push_back(i);
  }

  // Sort categories by construction order
  std::vector<std::string> sortedCategories;
  for (const auto& [cat, _] : categoryObjects) {
    sortedCategories.push_back(cat);
  }
  std::sort(sortedCategories.begin(), sortedCategories.end(),
            [](const std::string& a, const std::string& b) {
              return GetCategoryOrder(a) < GetCategoryOrder(b);
            });

  // Build steps - each category split into smaller groups
  std::vector<size_t> allPreviousObjects;
  int stepNum = 1;

  for (const auto& category : sortedCategories) {
    const auto& objects = categoryObjects[category];
    if (objects.empty()) continue;

    // Cluster objects spatially into small groups
    auto groups = ClusterBySpatialProximity(sceneData, objects, kMaxPartsPerStep);
    int totalGroups = static_cast<int>(groups.size());

    for (int groupIdx = 0; groupIdx < totalGroups; ++groupIdx) {
      const auto& group = groups[groupIdx];

      AssemblyStep step;
      step.stepNumber = stepNum++;
      step.title = GenerateStepTitle(category, groupIdx + 1, totalGroups, group.size());

      // Description based on what we're doing
      if (groupIdx == 0 && category == "masonry") {
        step.description = "Position blocks on level ground";
      } else if (groupIdx == 0 && category == "lumber") {
        step.description = "Begin structural frame assembly";
      } else if (groupIdx == totalGroups - 1 && category == "lumber") {
        step.description = "Frame assembly complete";
      }

      // New objects are just this group
      step.newObjectIndices = group;

      // All visible = previous + new
      step.objectIndices = allPreviousObjects;
      for (size_t idx : group) {
        step.objectIndices.push_back(idx);
        allPreviousObjects.push_back(idx);
      }

      assembly.steps.push_back(step);
    }
  }

  return assembly;
}

AssemblyInstructions ParseAssemblyFromScene(const SceneData& sceneData) {
  // This is now handled by scene_loader.cpp parsing the 'assembly' export
  return AssemblyInstructions{};
}

void ResolveAssemblyMaterials(AssemblyInstructions& assembly, const SceneData& sceneData) {
  // Build a map of materialId -> list of object indices
  std::map<std::string, std::vector<size_t>> objectsByMaterial;
  // Build a map of objectId -> object index (for showObjects filtering)
  std::map<std::string, size_t> objectsByObjectId;

  for (size_t i = 0; i < sceneData.objects.size(); ++i) {
    const auto& obj = sceneData.objects[i];
    if (!obj.materialId.empty()) {
      objectsByMaterial[obj.materialId].push_back(i);
    }
    if (!obj.objectId.empty()) {
      objectsByObjectId[obj.objectId] = i;
    }
  }

  // Track which materials/objects have been shown so far
  std::set<std::string> shownMaterials;
  std::set<std::string> shownObjects;

  for (size_t stepIdx = 0; stepIdx < assembly.steps.size(); ++stepIdx) {
    auto& step = assembly.steps[stepIdx];
    step.objectIndices.clear();
    step.newObjectIndices.clear();

    // If showObjects is specified, use object-based filtering (more fine-grained)
    if (!step.showObjects.empty()) {
      // Determine new objects in this step
      std::set<std::string> newObjIds;
      for (const auto& objId : step.showObjects) {
        if (shownObjects.find(objId) == shownObjects.end()) {
          newObjIds.insert(objId);
        }
      }

      // Collect all objects by objectId
      for (const auto& objId : step.showObjects) {
        auto it = objectsByObjectId.find(objId);
        if (it != objectsByObjectId.end()) {
          step.objectIndices.push_back(it->second);
          // Mark as new if this object is new in this step
          if (newObjIds.count(objId) > 0) {
            step.newObjectIndices.push_back(it->second);
          }
        }
      }

      // Add newly shown objects to the set
      for (const auto& objId : step.showObjects) {
        shownObjects.insert(objId);
      }

      TraceLog(LOG_INFO, "ASSEMBLY: Step %d '%s': %zu objectIds, %zu objects visible, %zu new",
               step.stepNumber, step.title.c_str(),
               step.showObjects.size(), step.objectIndices.size(), step.newObjectIndices.size());
    } else {
      // Fall back to material-based filtering
      // Determine new materials in this step
      std::set<std::string> newMaterials;
      for (const auto& mat : step.showMaterials) {
        if (shownMaterials.find(mat) == shownMaterials.end()) {
          newMaterials.insert(mat);
        }
      }

      // Collect all objects for visible materials
      for (const auto& mat : step.showMaterials) {
        auto it = objectsByMaterial.find(mat);
        if (it != objectsByMaterial.end()) {
          for (size_t objIdx : it->second) {
            step.objectIndices.push_back(objIdx);
            // Mark as new if this material is new in this step
            if (newMaterials.count(mat) > 0) {
              step.newObjectIndices.push_back(objIdx);
            }
          }
        }
      }

      // Add newly shown materials to the set
      for (const auto& mat : step.showMaterials) {
        shownMaterials.insert(mat);
      }

      TraceLog(LOG_INFO, "ASSEMBLY: Step %d '%s': %zu materials, %zu objects visible, %zu new",
               step.stepNumber, step.title.c_str(),
               step.showMaterials.size(), step.objectIndices.size(), step.newObjectIndices.size());
    }
  }
}

}  // namespace helscoop
