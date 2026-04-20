#pragma once

#include "raylib.h"
#include "types.h"

#include <array>
#include <string>
#include <vector>

namespace helscoop {

// Thermal simulation settings
struct ThermalSettings {
  float insideTemp = 5.0f;    // Inside temperature in Celsius (chickens maintain ~5C)
  float outsideTemp = -25.0f; // Outside temperature in Celsius
  float surfaceRInside = 0.13f;  // Internal surface resistance (m2*K/W)
  float surfaceROutside = 0.04f; // External surface resistance (m2*K/W)

  // Heat sources
  int chickenCount = 4;           // Number of chickens
  float heatPerChicken_W = 12.0f; // Heat output per chicken (W) - varies 8-15W
  float heaterPower_W = 0.0f;     // Electric heater power (W)
  bool chickensEnabled = true;    // Toggle chicken heat
  bool heaterEnabled = false;     // Toggle heater

  // Electricity cost (Finland 2024)
  float electricityPrice_cPerKwh = 12.0f;  // Electricity price in cents/kWh (Finnish avg ~8-15c)

  // Climate location (for annual calculations)
  int selectedLocationIndex = 0;  // Index into climate locations (0 = Helsinki)
  bool useClimateData = true;     // Use monthly data vs. static outsideTemp
  float targetInsideTemp = 5.0f;  // Target minimum inside temperature for heating calc

  // Get total heat input from all sources
  float GetTotalHeatInput_W() const {
    float total = 0.0f;
    if (chickensEnabled) total += chickenCount * heatPerChicken_W;
    if (heaterEnabled) total += heaterPower_W;
    return total;
  }
};

// Thermal data for a single surface/object
struct SurfaceThermalData {
  size_t objectIndex;         // Index into models array
  std::string materialId;     // Material reference
  float area_m2;              // Surface area in m2
  float rValue;               // Thermal resistance (m2*K/W)
  float uValue;               // Thermal transmittance (W/m2*K)
  float heatFlow_W;           // Heat loss through this surface (W)
  float heatFluxDensity;      // Heat flux per area (W/m2)
};

// Result of thermal analysis
struct ThermalAnalysisResult {
  std::vector<SurfaceThermalData> surfaces;
  float totalHeatLoss_W;      // Total heat loss (W)
  float heatingPower_kW;      // Required heating power (kW)
  float deltaT;               // Temperature difference used
  float minHeatFlux;          // For color scaling
  float maxHeatFlux;          // For color scaling

  // For equilibrium calculations
  float totalUA;              // Total UA coefficient (W/K) - sum of U*A for all surfaces
  float totalHeatInput_W;     // Heat from chickens + heater (W)
  float equilibriumTemp;      // Equilibrium inside temp with heat sources (°C)
  float heatBalance_W;        // Net heat (input - loss), positive = warming

  // Annual calculations (based on climate data)
  std::array<float, 12> monthlyHeatLoss_kWh;    // Heat loss per month (kWh)
  std::array<float, 12> monthlyHeatingCost_EUR; // Heating cost per month (EUR)
  float annualHeatLoss_kWh = 0.0f;              // Total annual heat loss (kWh)
  float annualHeatingCost_EUR = 0.0f;           // Total annual heating cost (EUR)
  bool hasAnnualData = false;                   // True if annual calculations done
};

// Calculate thermal properties for all objects in scene
ThermalAnalysisResult CalculateThermalLoss(
    const std::vector<ModelWithColor>& models,
    const std::vector<MaterialItem>& materials,
    const MaterialLibrary& library,
    const ThermalSettings& settings);

// Calculate annual heating needs based on climate data
// Updates the monthly and annual fields in result
void CalculateAnnualThermal(
    ThermalAnalysisResult& result,
    const ThermalSettings& settings);

// Map heat flux to color (blue = low loss/good, red = high loss/bad)
// Returns a color on a blue-white-red gradient
Color HeatFluxToColor(float heatFlux, float minFlux, float maxFlux);

// Get description for heat loss level
const char* GetHeatLossDescription(float heatFlux_W_per_m2);

}  // namespace helscoop
