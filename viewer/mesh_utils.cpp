#include "mesh_utils.h"
#include "raymath.h"
#include "rlgl.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstring>
#include <future>
#include <iostream>
#include <limits>
#include <vector>

namespace helscoop {

void DestroyModel(Model& model) {
  if (model.meshes != nullptr || model.materials != nullptr) {
    UnloadModel(model);
  }
  model = Model{};
}

Model CreateRaylibModelFrom(const manifold::MeshGL& meshGL, Color baseColor) {
  Model model = {0};
  const int vertexCount = meshGL.NumVert();
  const int triangleCount = meshGL.NumTri();

  if (vertexCount <= 0 || triangleCount <= 0) {
    return model;
  }

  const int stride = meshGL.numProp;
  std::vector<Vector3> positions(vertexCount);
  for (int v = 0; v < vertexCount; ++v) {
    const int base = v * stride;
    const float cadX = meshGL.vertProperties[base + 0] * kSceneScale;
    const float cadY = meshGL.vertProperties[base + 1] * kSceneScale;
    const float cadZ = meshGL.vertProperties[base + 2] * kSceneScale;
    positions[v] = {cadX, cadZ, -cadY};  // Z-up to Y-up conversion
  }

  // Auto-smooth: split normals at edges where face angle exceeds threshold
  const float kAutoSmoothAngle = 60.0f * 3.14159265359f / 180.0f;
  const float cosThreshold = std::cos(kAutoSmoothAngle);

  // Compute face normals (normalized for angle comparison, unnormalized for area weighting)
  std::vector<Vector3> faceNormalsNorm(triangleCount);
  std::vector<Vector3> faceNormalsArea(triangleCount);
  for (int tri = 0; tri < triangleCount; ++tri) {
    const int i0 = meshGL.triVerts[tri * 3 + 0];
    const int i1 = meshGL.triVerts[tri * 3 + 1];
    const int i2 = meshGL.triVerts[tri * 3 + 2];
    const Vector3& p0 = positions[i0];
    const Vector3& p1 = positions[i1];
    const Vector3& p2 = positions[i2];
    const Vector3 e1 = {p1.x - p0.x, p1.y - p0.y, p1.z - p0.z};
    const Vector3 e2 = {p2.x - p0.x, p2.y - p0.y, p2.z - p0.z};
    const Vector3 fn = {e1.y*e2.z - e1.z*e2.y, e1.z*e2.x - e1.x*e2.z, e1.x*e2.y - e1.y*e2.x};
    faceNormalsArea[tri] = fn;
    const float len = std::sqrt(fn.x*fn.x + fn.y*fn.y + fn.z*fn.z);
    if (len > 0.0f) {
      faceNormalsNorm[tri] = {fn.x/len, fn.y/len, fn.z/len};
    } else {
      faceNormalsNorm[tri] = {0.0f, 1.0f, 0.0f};
    }
  }

  // Build vertex→face adjacency
  std::vector<std::vector<int>> vertFaces(vertexCount);
  for (int tri = 0; tri < triangleCount; ++tri) {
    for (int j = 0; j < 3; ++j) {
      vertFaces[meshGL.triVerts[tri * 3 + j]].push_back(tri);
    }
  }

  // For each corner, compute smooth normal and deduplicate split vertices
  struct SplitVertex {
    Vector3 position;
    Vector3 normal;
    Vector2 texcoord;
  };
  std::vector<SplitVertex> splitVerts;
  splitVerts.reserve(vertexCount * 2);

  std::vector<int> cornerToSplit(triangleCount * 3);
  std::vector<std::vector<std::pair<Vector3, int>>> vertSplits(vertexCount);

  const float textureScale = 1.0f;

  for (int tri = 0; tri < triangleCount; ++tri) {
    for (int j = 0; j < 3; ++j) {
      const int origVert = meshGL.triVerts[tri * 3 + j];
      const int cornerIdx = tri * 3 + j;

      // Area-weighted average of adjacent faces within angle threshold
      const Vector3& thisFN = faceNormalsNorm[tri];
      Vector3 n = {0.0f, 0.0f, 0.0f};
      for (int adjTri : vertFaces[origVert]) {
        const float d = thisFN.x * faceNormalsNorm[adjTri].x +
                        thisFN.y * faceNormalsNorm[adjTri].y +
                        thisFN.z * faceNormalsNorm[adjTri].z;
        if (d >= cosThreshold) {
          n.x += faceNormalsArea[adjTri].x;
          n.y += faceNormalsArea[adjTri].y;
          n.z += faceNormalsArea[adjTri].z;
        }
      }
      const float len = std::sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
      Vector3 smoothNormal;
      if (len > 0.0f) {
        smoothNormal = {n.x/len, n.y/len, n.z/len};
      } else {
        smoothNormal = faceNormalsNorm[tri];
      }

      // Deduplicate: reuse existing split vertex with matching normal
      int splitIdx = -1;
      for (const auto& [existingN, idx] : vertSplits[origVert]) {
        const float d = smoothNormal.x*existingN.x + smoothNormal.y*existingN.y + smoothNormal.z*existingN.z;
        if (d > 0.999f) {
          splitIdx = idx;
          break;
        }
      }

      if (splitIdx < 0) {
        SplitVertex sv;
        sv.position = positions[origVert];
        sv.normal = smoothNormal;
        const Vector3& pos = positions[origVert];
        const float absX = std::fabs(smoothNormal.x);
        const float absY = std::fabs(smoothNormal.y);
        const float absZ = std::fabs(smoothNormal.z);
        if (absX >= absY && absX >= absZ) {
          sv.texcoord = {pos.z * textureScale, pos.y * textureScale};
        } else if (absY >= absX && absY >= absZ) {
          sv.texcoord = {pos.x * textureScale, pos.z * textureScale};
        } else {
          sv.texcoord = {pos.x * textureScale, pos.y * textureScale};
        }
        splitIdx = static_cast<int>(splitVerts.size());
        splitVerts.push_back(sv);
        vertSplits[origVert].push_back({smoothNormal, splitIdx});
      }

      cornerToSplit[cornerIdx] = splitIdx;
    }
  }

  const int splitVertexCount = static_cast<int>(splitVerts.size());

  constexpr int kMaxVerticesPerMesh = std::numeric_limits<unsigned short>::max();
  std::vector<int> remap(splitVertexCount, 0);
  std::vector<int> remapMarker(splitVertexCount, 0);
  int chunkToken = 1;

  std::vector<Mesh> meshes;
  meshes.reserve(static_cast<size_t>(triangleCount) / kMaxVerticesPerMesh + 1);

  int triIndex = 0;
  while (triIndex < triangleCount) {
    const int currentToken = chunkToken++;
    int chunkVertexCount = 0;
    std::vector<Vector3> chunkPositions;
    std::vector<Vector3> chunkNormals;
    std::vector<Vector2> chunkTexcoords;
    std::vector<unsigned short> chunkIndices;

    chunkPositions.reserve(std::min(kMaxVerticesPerMesh, splitVertexCount));
    chunkNormals.reserve(std::min(kMaxVerticesPerMesh, splitVertexCount));
    chunkTexcoords.reserve(std::min(kMaxVerticesPerMesh, splitVertexCount));
    chunkIndices.reserve(std::min(kMaxVerticesPerMesh, splitVertexCount) * 3);

    while (triIndex < triangleCount) {
      const int indices[3] = {
        cornerToSplit[triIndex * 3 + 0],
        cornerToSplit[triIndex * 3 + 1],
        cornerToSplit[triIndex * 3 + 2]
      };

      int needed = 0;
      for (int j = 0; j < 3; ++j) {
        if (remapMarker[indices[j]] != currentToken) {
          ++needed;
        }
      }

      if (chunkVertexCount + needed > kMaxVerticesPerMesh) {
        break;
      }

      for (int j = 0; j < 3; ++j) {
        const int sv = indices[j];
        if (remapMarker[sv] != currentToken) {
          remapMarker[sv] = currentToken;
          remap[sv] = chunkVertexCount++;
          chunkPositions.push_back(splitVerts[sv].position);
          chunkNormals.push_back(splitVerts[sv].normal);
          chunkTexcoords.push_back(splitVerts[sv].texcoord);
        }
        chunkIndices.push_back(static_cast<unsigned short>(remap[sv]));
      }
      ++triIndex;
    }

    Mesh chunkMesh = {0};
    chunkMesh.vertexCount = chunkVertexCount;
    chunkMesh.triangleCount = static_cast<int>(chunkIndices.size() / 3);
    chunkMesh.vertices = static_cast<float*>(MemAlloc(chunkVertexCount * 3 * sizeof(float)));
    chunkMesh.normals = static_cast<float*>(MemAlloc(chunkVertexCount * 3 * sizeof(float)));
    chunkMesh.texcoords = static_cast<float*>(MemAlloc(chunkVertexCount * 2 * sizeof(float)));
    chunkMesh.indices = static_cast<unsigned short*>(MemAlloc(chunkIndices.size() * sizeof(unsigned short)));
    chunkMesh.colors = nullptr;
    chunkMesh.texcoords2 = nullptr;
    chunkMesh.tangents = nullptr;

    for (int v = 0; v < chunkVertexCount; ++v) {
      const Vector3& pos = chunkPositions[v];
      chunkMesh.vertices[v * 3 + 0] = pos.x;
      chunkMesh.vertices[v * 3 + 1] = pos.y;
      chunkMesh.vertices[v * 3 + 2] = pos.z;

      const Vector3& normal = chunkNormals[v];
      chunkMesh.normals[v * 3 + 0] = normal.x;
      chunkMesh.normals[v * 3 + 1] = normal.y;
      chunkMesh.normals[v * 3 + 2] = normal.z;

      const Vector2& uv = chunkTexcoords[v];
      chunkMesh.texcoords[v * 2 + 0] = uv.x;
      chunkMesh.texcoords[v * 2 + 1] = uv.y;
    }

    std::memcpy(chunkMesh.indices, chunkIndices.data(), chunkIndices.size() * sizeof(unsigned short));
    UploadMesh(&chunkMesh, false);
    meshes.push_back(chunkMesh);
  }

  if (meshes.empty()) {
    return model;
  }

  model.transform = MatrixIdentity();
  model.meshCount = static_cast<int>(meshes.size());
  model.meshes = static_cast<Mesh*>(MemAlloc(model.meshCount * sizeof(Mesh)));
  for (int i = 0; i < model.meshCount; ++i) {
    model.meshes[i] = meshes[i];
  }
  model.materialCount = 1;
  model.materials = static_cast<Material*>(MemAlloc(sizeof(Material)));
  model.materials[0] = LoadMaterialDefault();
  model.meshMaterial = static_cast<int*>(MemAlloc(model.meshCount * sizeof(int)));
  for (int i = 0; i < model.meshCount; ++i) {
    model.meshMaterial[i] = 0;
  }

  return model;
}

std::vector<ModelWithColor> CreateModelsFromScene(const SceneData& sceneData) {
  auto start = std::chrono::high_resolution_clock::now();

  struct MeshTask {
    std::future<manifold::MeshGL> future;
    Color color;
    std::string materialId;
    size_t sceneObjectIndex;
    float roughness;
    float metallic;
  };
  std::vector<MeshTask> tasks;
  tasks.reserve(sceneData.objects.size());

  for (size_t i = 0; i < sceneData.objects.size(); ++i) {
    const auto& obj = sceneData.objects[i];
    if (obj.geometry) {
      tasks.push_back({
        std::async(std::launch::async, [geom = obj.geometry]() {
          return geom->GetMeshGL();
        }),
        obj.color,
        obj.materialId,
        i,
        obj.roughness,
        obj.metallic
      });
    }
  }

  struct MeshResult {
    manifold::MeshGL meshGL;
    Color color;
    std::string materialId;
    size_t sceneObjectIndex;
    float roughness;
    float metallic;
  };
  std::vector<MeshResult> meshes;
  meshes.reserve(tasks.size());
  for (auto& task : tasks) {
    meshes.push_back({task.future.get(), task.color, std::move(task.materialId), task.sceneObjectIndex, task.roughness, task.metallic});
  }

  auto meshEnd = std::chrono::high_resolution_clock::now();
  auto meshMs = std::chrono::duration_cast<std::chrono::milliseconds>(meshEnd - start).count();

  std::vector<ModelWithColor> result;
  result.reserve(meshes.size());
  for (auto& mesh : meshes) {
    Model model = CreateRaylibModelFrom(mesh.meshGL, mesh.color);
    result.push_back({model, mesh.color, std::move(mesh.materialId), mesh.sceneObjectIndex, mesh.roughness, mesh.metallic});
  }

  auto totalMs = std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::high_resolution_clock::now() - start).count();
  TraceLog(LOG_INFO, "PROFILE: CreateModelsFromScene: tessellation=%lld ms, total=%lld ms (%zu objects)",
           meshMs, totalMs, result.size());

  return result;
}

std::vector<ModelWithColor> CreateModelsFromPrecomputed(std::vector<PrecomputedMesh>& meshes) {
  auto start = std::chrono::high_resolution_clock::now();

  std::vector<ModelWithColor> result;
  result.reserve(meshes.size());

  for (auto& mesh : meshes) {
    Model model = CreateRaylibModelFrom(mesh.meshGL, mesh.color);
    result.push_back({model, mesh.color, mesh.materialId, mesh.sceneObjectIndex, mesh.roughness, mesh.metallic});
  }

  auto totalMs = std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::high_resolution_clock::now() - start).count();
  TraceLog(LOG_INFO, "PROFILE: CreateModelsFromPrecomputed (GPU upload): %lld ms (%zu objects)",
           totalMs, result.size());

  return result;
}

void DestroyModels(std::vector<ModelWithColor>& models) {
  for (auto& modelWithColor : models) {
    DestroyModel(modelWithColor.model);
  }
  models.clear();
}

void DrawAxes(float length) {
  const float shaftRadius = std::max(length * 0.02f, 0.01f);
  const float headLength = std::min(length * 0.2f, length * 0.75f);
  const float headRadius = shaftRadius * 2.5f;

  auto drawAxis = [&](Vector3 direction, Color color) {
    const Vector3 origin = {0.0f, 0.0f, 0.0f};
    const float shaftLength = std::max(length - headLength, 0.0f);
    const Vector3 shaftEnd = Vector3Scale(direction, shaftLength);
    const Vector3 axisEnd = Vector3Scale(direction, length);

    if (shaftLength > 0.0f) {
      DrawCylinderEx(origin, shaftEnd, shaftRadius, shaftRadius, 12, Fade(color, 0.65f));
    }
    DrawCylinderEx(shaftEnd, axisEnd, headRadius, 0.0f, 16, color);
  };

  drawAxis({1.0f, 0.0f, 0.0f}, RED);
  drawAxis({0.0f, 1.0f, 0.0f}, GREEN);
  drawAxis({0.0f, 0.0f, 1.0f}, BLUE);

  DrawSphereEx({0.0f, 0.0f, 0.0f}, shaftRadius * 1.2f, 12, 12, LIGHTGRAY);
}

void DrawXZGrid(int halfLines, float spacing, Color color) {
  for (int i = -halfLines; i <= halfLines; ++i) {
    const float offset = static_cast<float>(i) * spacing;
    DrawLine3D({offset, 0.0f, -halfLines * spacing},
               {offset, 0.0f, halfLines * spacing}, color);
    DrawLine3D({-halfLines * spacing, 0.0f, offset},
               {halfLines * spacing, 0.0f, offset}, color);
  }
}

PickResult PickModelAtRay(const Ray& ray, const std::vector<ModelWithColor>& models) {
  PickResult result;
  float closestDistance = std::numeric_limits<float>::max();

  for (size_t modelIdx = 0; modelIdx < models.size(); ++modelIdx) {
    const auto& modelWithColor = models[modelIdx];
    const Model& model = modelWithColor.model;

    // Test each mesh in the model
    for (int meshIdx = 0; meshIdx < model.meshCount; ++meshIdx) {
      RayCollision collision = GetRayCollisionMesh(ray, model.meshes[meshIdx], model.transform);
      if (collision.hit && collision.distance < closestDistance) {
        closestDistance = collision.distance;
        result.hit = true;
        result.distance = collision.distance;
        result.modelIndex = static_cast<int>(modelIdx);
        result.materialId = modelWithColor.materialId;
      }
    }
  }

  return result;
}

}  // namespace helscoop
