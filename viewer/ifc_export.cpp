#include "ifc_export.h"

#include <algorithm>
#include <chrono>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>

namespace helscoop {

IfcEntityType CategoryToIfcType(const std::string& category) {
  if (category == "lumber" || category == "sheathing") return IfcEntityType::Wall;
  if (category == "roofing") return IfcEntityType::Slab;
  if (category == "masonry") return IfcEntityType::BuildingElementProxy;
  if (category == "insulation") return IfcEntityType::BuildingElementProxy;
  return IfcEntityType::BuildingElementProxy;
}

std::string GenerateIfcGuid() {
  // IFC uses a specific base64 encoding for 128-bit GUIDs (22 characters)
  // Characters allowed: 0-9, A-Z, a-z, _ (underscore), $ (dollar) = 64 chars
  static std::random_device rd;
  static std::mt19937_64 gen(rd());
  static std::uniform_int_distribution<uint64_t> dist;

  // IFC base64 character set (specific order matters)
  const char* chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

  // Generate 128 bits (two 64-bit values)
  uint64_t high = dist(gen);
  uint64_t low = dist(gen);

  std::string guid;
  guid.reserve(22);

  // Encode 128 bits into 22 base64 characters (6 bits each, 132 bits total, top 4 bits unused)
  // Process high 64 bits first
  for (int i = 0; i < 11; ++i) {
    int shift = 58 - i * 6;
    if (shift >= 0) {
      guid += chars[(high >> shift) & 0x3F];
    } else {
      // Bits span high and low
      uint64_t val = ((high << (-shift)) | (low >> (64 + shift))) & 0x3F;
      guid += chars[val];
    }
  }
  // Process remaining from low
  for (int i = 0; i < 11; ++i) {
    int shift = 58 - 4 - i * 6;  // -4 because we used 4 bits from transition
    if (shift >= 0) {
      guid += chars[(low >> shift) & 0x3F];
    } else {
      guid += chars[(low << (-shift)) & 0x3F];
    }
  }

  return guid.substr(0, 22);
}

bool ExportToIFC(
    const SceneData& sceneData,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const std::filesystem::path& outputPath,
    std::string& errorMsg) {

  std::ofstream file(outputPath);
  if (!file.is_open()) {
    errorMsg = "Failed to open file: " + outputPath.string();
    return false;
  }

  // Ensure numbers are output with decimal points (required by IFC parsers)
  file << std::fixed << std::setprecision(6);

  // Get current timestamp
  auto now = std::chrono::system_clock::now();
  auto time = std::chrono::system_clock::to_time_t(now);
  std::tm tmBuf;
  localtime_r(&time, &tmBuf);
  char timestamp[64];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S", &tmBuf);

  // IFC HEADER - Use IFC2X3 for better compatibility
  file << "ISO-10303-21;\n";
  file << "HEADER;\n";
  file << "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');\n";
  file << "FILE_NAME('" << outputPath.filename().string() << "','" << timestamp << "',";
  file << "(''),(''),'','Helscoop','');\n";
  file << "FILE_SCHEMA(('IFC2X3'));\n";
  file << "ENDSEC;\n";
  file << "DATA;\n";

  int entityId = 1;

  // #1 = Organization
  file << "#" << entityId++ << " = IFCORGANIZATION($,'Helscoop',$,$,$);\n";
  // #2 = Person
  file << "#" << entityId++ << " = IFCPERSON($,$,$,$,$,$,$,$);\n";
  // #3 = PersonAndOrganization
  file << "#" << entityId++ << " = IFCPERSONANDORGANIZATION(#2,#1,$);\n";
  // #4 = Application
  file << "#" << entityId++ << " = IFCAPPLICATION(#1,'1.0','Helscoop','Helscoop');\n";
  // #5 = OwnerHistory (IFC2X3 format)
  file << "#" << entityId++ << " = IFCOWNERHISTORY(#3,#4,$,.NOCHANGE.,$,$,$," << time << ");\n";

  int ownerHistoryId = entityId - 1;

  // Units
  file << "#" << entityId++ << " = IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n";
  int lengthUnitId = entityId - 1;
  file << "#" << entityId++ << " = IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);\n";
  int areaUnitId = entityId - 1;
  file << "#" << entityId++ << " = IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);\n";
  int volumeUnitId = entityId - 1;
  file << "#" << entityId++ << " = IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);\n";
  int angleUnitId = entityId - 1;
  file << "#" << entityId++ << " = IFCUNITASSIGNMENT((#" << lengthUnitId << ",#" << areaUnitId << ",#" << volumeUnitId << ",#" << angleUnitId << "));\n";
  int unitAssignmentId = entityId - 1;

  // Geometric context
  file << "#" << entityId++ << " = IFCDIRECTION((0.,0.,1.));\n";
  int zAxisId = entityId - 1;
  file << "#" << entityId++ << " = IFCDIRECTION((1.,0.,0.));\n";
  int xAxisId = entityId - 1;
  file << "#" << entityId++ << " = IFCCARTESIANPOINT((0.,0.,0.));\n";
  int originId = entityId - 1;
  file << "#" << entityId++ << " = IFCAXIS2PLACEMENT3D(#" << originId << ",#" << zAxisId << ",#" << xAxisId << ");\n";
  int placementId = entityId - 1;
  file << "#" << entityId++ << " = IFCDIRECTION((0.,1.));\n";  // True North
  int trueNorthId = entityId - 1;
  file << "#" << entityId++ << " = IFCGEOMETRICREPRESENTATIONCONTEXT('Model','Model',3,1.E-05,#" << placementId << ",#" << trueNorthId << ");\n";
  int contextId = entityId - 1;
  // Body subcontext (required for proper geometry rendering)
  file << "#" << entityId++ << " = IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#" << contextId << ",$,.MODEL_VIEW.,$);\n";
  int bodyContextId = entityId - 1;

  // Project with units
  file << "#" << entityId++ << " = IFCPROJECT('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Helscoop Export',$,$,$,$,(#" << contextId << "),#" << unitAssignmentId << ");\n";
  int projectId = entityId - 1;

  // Site placement
  file << "#" << entityId++ << " = IFCLOCALPLACEMENT($,#" << placementId << ");\n";
  int sitePlacementId = entityId - 1;

  // Site
  file << "#" << entityId++ << " = IFCSITE('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Site',$,$,#" << sitePlacementId << ",$,$,.ELEMENT.,$,$,$,$,$);\n";
  int siteId = entityId - 1;

  // Building placement
  file << "#" << entityId++ << " = IFCLOCALPLACEMENT(#" << sitePlacementId << ",#" << placementId << ");\n";
  int buildingPlacementId = entityId - 1;

  // Building
  file << "#" << entityId++ << " = IFCBUILDING('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Building',$,$,#" << buildingPlacementId << ",$,$,.ELEMENT.,$,$,$);\n";
  int buildingId = entityId - 1;

  // Storey placement
  file << "#" << entityId++ << " = IFCLOCALPLACEMENT(#" << buildingPlacementId << ",#" << placementId << ");\n";
  int storeyPlacementId = entityId - 1;

  // Building Storey (ground floor)
  file << "#" << entityId++ << " = IFCBUILDINGSTOREY('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",'Ground Floor',$,$,#" << storeyPlacementId << ",$,$,.ELEMENT.,0.);\n";
  int storeyId = entityId - 1;

  // Spatial hierarchy: Project -> Site -> Building -> Storey
  file << "#" << entityId++ << " = IFCRELAGGREGATES('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",$,$,#" << projectId << ",(#" << siteId << "));\n";
  file << "#" << entityId++ << " = IFCRELAGGREGATES('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",$,$,#" << siteId << ",(#" << buildingId << "));\n";
  file << "#" << entityId++ << " = IFCRELAGGREGATES('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
  file << ",$,$,#" << buildingId << ",(#" << storeyId << "));\n";

  // Export each object as building element
  std::vector<int> elementIds;

  for (size_t i = 0; i < sceneData.objects.size(); ++i) {
    const auto& obj = sceneData.objects[i];
    if (!obj.geometry) continue;

    // Get material info
    const PBRMaterial* mat = nullptr;
    if (!obj.materialId.empty()) {
      mat = library.get(obj.materialId);
    }

    std::string name = mat ? mat->name : ("Element_" + std::to_string(i));
    std::string category = mat ? mat->category : "unknown";
    IfcEntityType ifcType = CategoryToIfcType(category);

    // Get actual mesh geometry from Manifold
    manifold::MeshGL mesh = obj.geometry->GetMeshGL();
    if (mesh.NumTri() == 0) continue;

    // Local placement at origin (geometry coordinates are absolute)
    file << "#" << entityId++ << " = IFCLOCALPLACEMENT(#" << storeyPlacementId << ",#" << placementId << ");\n";
    int localPlacementId = entityId - 1;

    // Export mesh as Faceted BREP (triangulated surface)
    // First, output all unique vertices
    std::vector<int> vertexIds;
    size_t numVerts = mesh.NumVert();
    vertexIds.reserve(numVerts);

    for (size_t v = 0; v < numVerts; ++v) {
      size_t idx = v * mesh.numProp;
      // Get vertex position and scale to meters
      // Keep coordinates as-is (X, Y, Z) - IFC viewers handle orientation
      float x = static_cast<float>(mesh.vertProperties[idx + 0]) / kSceneScale;
      float y = static_cast<float>(mesh.vertProperties[idx + 1]) / kSceneScale;
      float z = static_cast<float>(mesh.vertProperties[idx + 2]) / kSceneScale;
      file << "#" << entityId++ << " = IFCCARTESIANPOINT((" << x << "," << y << "," << z << "));\n";
      vertexIds.push_back(entityId - 1);
    }

    // Output triangular faces
    std::vector<int> faceIds;
    size_t numTris = mesh.NumTri();
    faceIds.reserve(numTris);

    for (size_t t = 0; t < numTris; ++t) {
      uint32_t i0 = mesh.triVerts[t * 3 + 0];
      uint32_t i1 = mesh.triVerts[t * 3 + 1];
      uint32_t i2 = mesh.triVerts[t * 3 + 2];

      if (i0 >= numVerts || i1 >= numVerts || i2 >= numVerts) continue;

      file << "#" << entityId++ << " = IFCPOLYLOOP((#" << vertexIds[i0] << ",#" << vertexIds[i1] << ",#" << vertexIds[i2] << "));\n";
      int loopId = entityId - 1;
      file << "#" << entityId++ << " = IFCFACEOUTERBOUND(#" << loopId << ",.T.);\n";
      int boundId = entityId - 1;
      file << "#" << entityId++ << " = IFCFACE((#" << boundId << "));\n";
      faceIds.push_back(entityId - 1);
    }

    // Create closed shell from all faces
    file << "#" << entityId++ << " = IFCCLOSEDSHELL((";
    for (size_t f = 0; f < faceIds.size(); ++f) {
      if (f > 0) file << ",";
      file << "#" << faceIds[f];
    }
    file << "));\n";
    int shellId = entityId - 1;

    // Create faceted brep
    file << "#" << entityId++ << " = IFCFACETEDBREP(#" << shellId << ");\n";
    int solidId = entityId - 1;

    // Shape representation using Brep with body subcontext
    file << "#" << entityId++ << " = IFCSHAPEREPRESENTATION(#" << bodyContextId << ",'Body','Brep',(#" << solidId << "));\n";
    int shapeRepId = entityId - 1;
    file << "#" << entityId++ << " = IFCPRODUCTDEFINITIONSHAPE($,$,(#" << shapeRepId << "));\n";
    int productShapeId = entityId - 1;

    // Building element based on type
    const char* ifcTypeName;
    switch (ifcType) {
      case IfcEntityType::Wall: ifcTypeName = "IFCWALL"; break;
      case IfcEntityType::Slab: ifcTypeName = "IFCSLAB"; break;
      case IfcEntityType::Column: ifcTypeName = "IFCCOLUMN"; break;
      case IfcEntityType::Beam: ifcTypeName = "IFCBEAM"; break;
      default: ifcTypeName = "IFCBUILDINGELEMENTPROXY"; break;
    }

    file << "#" << entityId++ << " = " << ifcTypeName << "('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
    file << ",'" << name << "',$,$,#" << localPlacementId << ",#" << productShapeId << ",$";
    if (ifcType == IfcEntityType::Slab) {
      file << ",.FLOOR.";  // Slab predefined type
    }
    file << ");\n";

    elementIds.push_back(entityId - 1);
  }

  // Relate elements to storey
  if (!elementIds.empty()) {
    file << "#" << entityId++ << " = IFCRELCONTAINEDINSPATIALSTRUCTURE('" << GenerateIfcGuid() << "',#" << ownerHistoryId;
    file << ",$,$,(";
    for (size_t i = 0; i < elementIds.size(); ++i) {
      if (i > 0) file << ",";
      file << "#" << elementIds[i];
    }
    file << "),#" << storeyId << ");\n";
  }

  file << "ENDSEC;\n";
  file << "END-ISO-10303-21;\n";

  file.close();
  return true;
}

}  // namespace helscoop
