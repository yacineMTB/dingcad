#pragma once

#include <array>
#include <string>
#include <vector>

namespace helscoop {

// Climate location with monthly temperature data
struct ClimateLocation {
  std::string name;           // e.g., "Helsinki, Finland"
  std::string code;           // e.g., "HEL"
  float latitude;
  float longitude;

  // Monthly average temperatures (°C) - Jan to Dec
  std::array<float, 12> monthlyAvgTemp;

  // Heating degree days (base 17°C) - annual total
  float annualHDD;

  // Design temperature (coldest expected, for sizing)
  float designTemp;
};

// Get all available climate locations
const std::vector<ClimateLocation>& GetClimateLocations();

// Get climate location by index
const ClimateLocation& GetClimateLocation(int index);

// Get number of available locations
int GetClimateLocationCount();

// Month names for display
const char* GetMonthName(int month);  // 0-11
const char* GetMonthShortName(int month);  // 0-11

}  // namespace helscoop
