#include "climate_data.h"

namespace helscoop {

// Nordic climate data based on meteorological records
// Monthly temperatures are 30-year averages
// HDD = Heating Degree Days (base 17°C)
// Design temp = 99% design temperature for heating sizing

static const std::vector<ClimateLocation> kClimateLocations = {
  {
    "Helsinki, Finland",
    "HEL",
    60.17f, 24.94f,
    // Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
    {-4.7f, -5.1f, -1.5f, 4.3f, 10.5f, 14.9f, 17.6f, 16.2f, 11.2f, 5.8f, 1.0f, -2.5f},
    4500.0f,  // HDD
    -26.0f    // Design temp
  },
  {
    "Oulu, Finland",
    "OUL",
    65.01f, 25.47f,
    {-10.2f, -9.6f, -5.0f, 1.5f, 8.0f, 13.5f, 16.5f, 14.2f, 9.0f, 3.0f, -3.5f, -7.5f},
    5500.0f,
    -32.0f
  },
  {
    "Rovaniemi, Finland",
    "ROV",
    66.50f, 25.73f,
    {-13.0f, -11.5f, -6.5f, -0.5f, 6.5f, 12.5f, 15.0f, 12.5f, 7.0f, 1.0f, -5.5f, -10.5f},
    6200.0f,
    -38.0f
  },
  {
    "Stockholm, Sweden",
    "STO",
    59.33f, 18.07f,
    {-1.6f, -2.0f, 1.0f, 5.5f, 11.0f, 15.5f, 18.0f, 17.0f, 12.5f, 7.5f, 3.0f, 0.0f},
    3900.0f,
    -18.0f
  },
  {
    "Oslo, Norway",
    "OSL",
    59.91f, 10.75f,
    {-4.3f, -4.0f, 0.2f, 5.4f, 11.3f, 15.0f, 17.3f, 16.2f, 11.4f, 6.2f, 0.7f, -3.0f},
    4200.0f,
    -20.0f
  },
  {
    "Copenhagen, Denmark",
    "CPH",
    55.68f, 12.57f,
    {0.5f, 0.3f, 2.5f, 6.5f, 11.5f, 15.0f, 17.5f, 17.0f, 13.5f, 9.0f, 5.0f, 2.0f},
    3200.0f,
    -12.0f
  },
  {
    "Tampere, Finland",
    "TMP",
    61.50f, 23.79f,
    {-7.2f, -7.0f, -2.8f, 3.5f, 10.0f, 14.5f, 17.0f, 15.0f, 10.0f, 4.5f, -1.0f, -5.0f},
    5000.0f,
    -29.0f
  },
  {
    "Turku, Finland",
    "TKU",
    60.45f, 22.27f,
    {-4.5f, -5.0f, -1.5f, 4.0f, 10.0f, 14.5f, 17.5f, 16.0f, 11.0f, 6.0f, 1.5f, -2.0f},
    4400.0f,
    -24.0f
  }
};

const std::vector<ClimateLocation>& GetClimateLocations() {
  return kClimateLocations;
}

const ClimateLocation& GetClimateLocation(int index) {
  if (index < 0 || index >= static_cast<int>(kClimateLocations.size())) {
    return kClimateLocations[0];  // Default to Helsinki
  }
  return kClimateLocations[index];
}

int GetClimateLocationCount() {
  return static_cast<int>(kClimateLocations.size());
}

static const char* kMonthNames[] = {
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
};

static const char* kMonthShortNames[] = {
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
};

const char* GetMonthName(int month) {
  if (month < 0 || month > 11) return "";
  return kMonthNames[month];
}

const char* GetMonthShortName(int month) {
  if (month < 0 || month > 11) return "";
  return kMonthShortNames[month];
}

}  // namespace helscoop
