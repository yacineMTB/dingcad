#include "thermal.h"
#include "climate_data.h"
#include "material_loader.h"

#include <algorithm>
#include <cmath>
#include <iostream>
#include <unordered_set>

namespace helscoop {

// Days per month (non-leap year)
static const int kDaysPerMonth[12] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
static const float kHoursPerDay = 24.0f;

ThermalAnalysisResult CalculateThermalLoss(
    const std::vector<ModelWithColor>& models,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const ThermalSettings& settings) {

  ThermalAnalysisResult result;
  result.deltaT = settings.insideTemp - settings.outsideTemp;
  result.totalHeatLoss_W = 0.0f;
  result.totalUA = 0.0f;
  result.minHeatFlux = std::numeric_limits<float>::max();
  result.maxHeatFlux = 0.0f;

  // Build a map of materialId -> total surface area
  // NOTE: scene_loader.cpp already calculates the total area per materialId from geometry
  // and assigns the SAME total to EACH MaterialItem with that ID. So we must NOT sum
  // duplicates here - just take the first occurrence of each materialId.
  std::unordered_map<std::string, float> areaByMaterial;
  for (const auto& mat : materials) {
    if (!mat.materialId.empty() && areaByMaterial.count(mat.materialId) == 0) {
      areaByMaterial[mat.materialId] = mat.surfaceArea;
    }
  }

  // Process each UNIQUE materialId once (not each model!)
  // This avoids the bug of counting the same material's area multiple times
  std::unordered_set<std::string> processedMaterials;

  for (size_t i = 0; i < models.size(); ++i) {
    const auto& model = models[i];

    // Skip models without material reference
    if (model.materialId.empty()) continue;

    // Skip if we already processed this materialId
    if (processedMaterials.count(model.materialId) > 0) continue;
    processedMaterials.insert(model.materialId);

    // Get material from library
    const PBRMaterial* mat = library.get(model.materialId);
    if (!mat) continue;

    // Only count ENVELOPE materials for thermal calculations
    // Skip structural elements (lumber), finishes (paint), hardware, fasteners, etc.
    // These are either inside the wall cavity or don't form the thermal barrier
    //
    // NOTE: When explicit insulation geometry exists:
    // - "sheathing" (e.g. plywood): structural/weatherproofing, not thermal barrier
    // - "roofing" (e.g. metal): weather protection, not thermal barrier
    // These are NOT counted because insulation is the actual thermal barrier.
    // Counting both would double-count the same wall/roof area.
    //
    // Count these categories:
    // - "insulation": the actual thermal barrier (R=2.86 for 100mm mineral wool)
    // - "opening": thermal weak points (doors, vents, nest access) - much lower R-values
    //
    // NOTE: "masonry" (foundations) is NOT counted because it contacts the ground
    // (~10°C year-round), not the outside air temperature. Ground-contact heat
    // transfer requires different calculations with a different ΔT.
    const std::string& category = mat->category;
    bool isEnvelopeMaterial = (category == "insulation" || category == "opening");
    if (!isEnvelopeMaterial) continue;

    // Get the TOTAL area for this material (summed from all objects using it)
    float area_m2 = 0.0f;
    auto it = areaByMaterial.find(model.materialId);
    if (it != areaByMaterial.end()) {
      area_m2 = it->second;
    }

    // Skip if no area
    if (area_m2 <= 0.0f) continue;

    // Calculate thermal resistance
    // R_total = R_si + R_material + R_cavity + R_se
    float R_material = mat->thermal.getRValue();

    // Note: Wall/roof insulation is now modeled explicitly with insulation_100mm material
    // The 'insulation' category will be picked up and its R-value calculated from
    // the material's thermal properties (conductivity 0.035 W/mK, thickness 100mm = R=2.86)

    float R_total = settings.surfaceRInside + R_material + settings.surfaceROutside;

    // U-value (thermal transmittance)
    float U = 1.0f / R_total;

    // Heat flow: Q = U * A * deltaT
    float Q = U * area_m2 * result.deltaT;

    // Heat flux density: q = U * deltaT (W/m2)
    float q = U * result.deltaT;

    // Create surface thermal data
    SurfaceThermalData surface;
    surface.objectIndex = i;  // First object index with this material
    surface.materialId = model.materialId;
    surface.area_m2 = area_m2;
    surface.rValue = R_total;
    surface.uValue = U;
    surface.heatFlow_W = Q;
    surface.heatFluxDensity = q;

    result.surfaces.push_back(surface);
    result.totalHeatLoss_W += Q;
    result.totalUA += U * area_m2;  // Accumulate UA coefficient

    // Track min/max for color scaling
    result.minHeatFlux = std::min(result.minHeatFlux, q);
    result.maxHeatFlux = std::max(result.maxHeatFlux, q);
  }

  // Handle case where no surfaces were found
  if (result.minHeatFlux == std::numeric_limits<float>::max()) {
    result.minHeatFlux = 0.0f;
    result.maxHeatFlux = 100.0f;  // Default scale
  }

  // Ensure some range for color mapping
  if (result.maxHeatFlux - result.minHeatFlux < 10.0f) {
    result.maxHeatFlux = result.minHeatFlux + 100.0f;
  }

  result.heatingPower_kW = result.totalHeatLoss_W / 1000.0f;

  // Calculate equilibrium temperature and heat balance
  result.totalHeatInput_W = settings.GetTotalHeatInput_W();

  // Heat balance: positive = warming up, negative = cooling down
  result.heatBalance_W = result.totalHeatInput_W - result.totalHeatLoss_W;

  // Equilibrium temperature: T_inside = T_outside + Q_source / UA
  // At equilibrium, heat input equals heat loss: Q_in = UA * (T_in - T_out)
  // So: T_in = T_out + Q_in / UA
  if (result.totalUA > 0.0f) {
    result.equilibriumTemp = settings.outsideTemp + result.totalHeatInput_W / result.totalUA;
  } else {
    result.equilibriumTemp = settings.outsideTemp;  // No insulation = outside temp
  }

  return result;
}

Color HeatFluxToColor(float heatFlux, float minFlux, float maxFlux) {
  // Normalize to 0-1 range
  float range = maxFlux - minFlux;
  if (range <= 0.0f) range = 1.0f;

  float t = (heatFlux - minFlux) / range;
  t = std::clamp(t, 0.0f, 1.0f);

  // Color gradient: Blue (cold/good) -> Cyan -> Green -> Yellow -> Red (hot/bad)
  // This is a typical "jet" colormap

  unsigned char r, g, b;

  if (t < 0.25f) {
    // Blue to Cyan
    float s = t * 4.0f;
    r = 0;
    g = static_cast<unsigned char>(s * 255);
    b = 255;
  } else if (t < 0.5f) {
    // Cyan to Green
    float s = (t - 0.25f) * 4.0f;
    r = 0;
    g = 255;
    b = static_cast<unsigned char>((1.0f - s) * 255);
  } else if (t < 0.75f) {
    // Green to Yellow
    float s = (t - 0.5f) * 4.0f;
    r = static_cast<unsigned char>(s * 255);
    g = 255;
    b = 0;
  } else {
    // Yellow to Red
    float s = (t - 0.75f) * 4.0f;
    r = 255;
    g = static_cast<unsigned char>((1.0f - s) * 255);
    b = 0;
  }

  return Color{r, g, b, 255};
}

const char* GetHeatLossDescription(float heatFlux_W_per_m2) {
  if (heatFlux_W_per_m2 < 20.0f) {
    return "Excellent (well insulated)";
  } else if (heatFlux_W_per_m2 < 40.0f) {
    return "Good insulation";
  } else if (heatFlux_W_per_m2 < 80.0f) {
    return "Moderate heat loss";
  } else if (heatFlux_W_per_m2 < 150.0f) {
    return "Poor insulation";
  } else {
    return "Severe heat loss";
  }
}

void CalculateAnnualThermal(
    ThermalAnalysisResult& result,
    const ThermalSettings& settings) {

  // Reset annual data
  result.annualHeatLoss_kWh = 0.0f;
  result.annualHeatingCost_EUR = 0.0f;
  result.hasAnnualData = false;

  // Need UA coefficient from prior calculation
  if (result.totalUA <= 0.0f) {
    return;
  }

  const ClimateLocation& climate = GetClimateLocation(settings.selectedLocationIndex);

  // Calculate chicken heat contribution (constant throughout year)
  float chickenHeat_W = 0.0f;
  if (settings.chickensEnabled) {
    chickenHeat_W = settings.chickenCount * settings.heatPerChicken_W;
  }

  // Calculate for each month
  for (int month = 0; month < 12; ++month) {
    float outsideTemp = climate.monthlyAvgTemp[month];
    float targetTemp = settings.targetInsideTemp;

    // Only need heating when outside is colder than target
    float deltaT = std::max(0.0f, targetTemp - outsideTemp);

    // Heat loss this month (W) based on average delta T
    float heatLoss_W = result.totalUA * deltaT;

    // Hours in this month
    float hoursInMonth = kDaysPerMonth[month] * kHoursPerDay;

    // Heat loss in kWh
    float heatLoss_kWh = (heatLoss_W * hoursInMonth) / 1000.0f;

    // Chicken heat contribution (free heating)
    float chickenHeat_kWh = (chickenHeat_W * hoursInMonth) / 1000.0f;

    // Net heating needed (must be at least 0)
    float heatingNeeded_kWh = std::max(0.0f, heatLoss_kWh - chickenHeat_kWh);

    // Store monthly values
    result.monthlyHeatLoss_kWh[month] = heatingNeeded_kWh;
    result.monthlyHeatingCost_EUR[month] = heatingNeeded_kWh * settings.electricityPrice_cPerKwh / 100.0f;

    // Accumulate annual totals
    result.annualHeatLoss_kWh += heatingNeeded_kWh;
    result.annualHeatingCost_EUR += result.monthlyHeatingCost_EUR[month];
  }

  result.hasAnnualData = true;
}

}  // namespace helscoop
