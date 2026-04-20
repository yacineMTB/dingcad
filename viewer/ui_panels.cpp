#include "ui_panels.h"
#include "climate_data.h"
#include "file_utils.h"

#define RAYGUI_IMPLEMENTATION
#include "raygui.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <set>
#include <unordered_map>

namespace helscoop {

// Helper function to wrap text to fit within a given width
// Returns vector of lines
static std::vector<std::string> wrapText(const std::string& text, const Font& font, float fontSize, float maxWidth) {
  std::vector<std::string> lines;
  if (text.empty()) return lines;

  std::string currentLine;
  std::string currentWord;

  for (size_t i = 0; i <= text.size(); ++i) {
    char c = (i < text.size()) ? text[i] : ' ';

    if (c == ' ' || c == '\n' || i == text.size()) {
      if (!currentWord.empty()) {
        std::string testLine = currentLine.empty() ? currentWord : currentLine + " " + currentWord;
        Vector2 testSize = MeasureTextEx(font, testLine.c_str(), fontSize, 0.0f);

        if (testSize.x > maxWidth && !currentLine.empty()) {
          lines.push_back(currentLine);
          currentLine = currentWord;
        } else {
          currentLine = testLine;
        }
        currentWord.clear();
      }
      if (c == '\n' && !currentLine.empty()) {
        lines.push_back(currentLine);
        currentLine.clear();
      }
    } else {
      currentWord += c;
    }
  }

  if (!currentLine.empty()) {
    lines.push_back(currentLine);
  }

  return lines;
}

// Helper to draw wrapped text and return total height used
static float drawWrappedText(const Font& font, const std::string& text, float x, float y,
                              float fontSize, float maxWidth, float lineSpacing, Color color) {
  auto lines = wrapText(text, font, fontSize, maxWidth);
  float totalHeight = 0.0f;
  for (const auto& line : lines) {
    DrawTextEx(font, line.c_str(), {x, y + totalHeight}, fontSize, 0.0f, color);
    totalHeight += fontSize + lineSpacing;
  }
  return totalHeight;
}

// Helper function to check if a string contains another (case-insensitive)
static bool containsIgnoreCase(const std::string& haystack, const std::string& needle) {
  if (needle.empty()) return true;
  std::string lowerHaystack = haystack;
  std::string lowerNeedle = needle;
  std::transform(lowerHaystack.begin(), lowerHaystack.end(), lowerHaystack.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  std::transform(lowerNeedle.begin(), lowerNeedle.end(), lowerNeedle.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return lowerHaystack.find(lowerNeedle) != std::string::npos;
}

// Check if material matches the search filter
static bool materialMatchesFilter(const MaterialItem& mat, const char* filterText) {
  if (filterText[0] == '\0') return true;
  std::string filter(filterText);
  return containsIgnoreCase(mat.name, filter) ||
         containsIgnoreCase(mat.category, filter) ||
         containsIgnoreCase(mat.materialId, filter);
}

// Handle draggable panel header - returns true if being dragged
static bool HandlePanelDrag(UIState& uiState, int panelId, PanelPos& pos,
                            float panelX, float panelY, float panelWidth, float headerHeight) {
  Vector2 mousePos = GetMousePosition();
  Rectangle headerRect = {panelX, panelY, panelWidth, headerHeight};

  // Start drag on mouse down in header (but not if already dragging a param slider)
  if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT) &&
      CheckCollisionPointRec(mousePos, headerRect) &&
      uiState.draggingParamIndex == -1) {
    uiState.draggingPanel = panelId;
    uiState.dragOffset = {mousePos.x - panelX, mousePos.y - panelY};
  }

  // Continue drag
  if (uiState.draggingPanel == panelId && IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
    pos.x = mousePos.x - uiState.dragOffset.x;
    pos.y = mousePos.y - uiState.dragOffset.y;
    return true;
  }

  // End drag
  if (uiState.draggingPanel == panelId && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
    uiState.draggingPanel = -1;
  }

  return false;
}

// Draw drag handle indicator
static void DrawDragHandle(const Font& uiFont, float panelX, float panelY, float panelWidth) {
  // Small dots in the header to indicate draggable
  float cx = panelX + panelWidth - 15.0f;
  float cy = panelY + 12.0f;
  for (int i = 0; i < 3; i++) {
    DrawCircle(static_cast<int>(cx + i * 4), static_cast<int>(cy), 1.5f, Color{80, 80, 90, 255});
    DrawCircle(static_cast<int>(cx + i * 4), static_cast<int>(cy + 4), 1.5f, Color{80, 80, 90, 255});
  }
}

void DrawMaterialsPanel(const std::vector<MaterialItem>& materials,
                        UIState& uiState,
                        const Font& uiFont,
                        int screenWidth, int screenHeight,
                        const std::vector<std::string>& assemblyFilter) {
  if (materials.empty()) return;

  // Create a set for faster lookup of assembly-filtered materials
  std::set<std::string> assemblyFilterSet(assemblyFilter.begin(), assemblyFilter.end());
  bool hasAssemblyFilter = !assemblyFilter.empty();

  const float panelWidth = 300.0f;
  const float panelHeight = 550.0f;

  // Initialize default position if not set
  if (!uiState.materialsPos.initialized) {
    uiState.materialsPos.x = 10.0f;
    uiState.materialsPos.y = kToolbarHeight + 10.0f;
    uiState.materialsPos.initialized = true;
  }

  float panelX = uiState.materialsPos.x;
  float panelY = uiState.materialsPos.y;

  // Handle dragging
  HandlePanelDrag(uiState, 0, uiState.materialsPos, panelX, panelY, panelWidth, 28.0f);
  panelX = uiState.materialsPos.x;
  panelY = uiState.materialsPos.y;
  const float rowHeight = 24.0f;
  const float headerHeight = 30.0f;
  const float searchBoxHeight = 26.0f;
  const float sectionHeight = 26.0f;
  const float colorSwatchSize = 14.0f;
  const float footerHeight = 50.0f;
  const float scrollbarWidth = 8.0f;

  // Reset hover state at start of frame
  uiState.hoveredMaterialId.clear();

  Vector2 mousePos = GetMousePosition();

  // Calculate totals and content height (only for filtered materials)
  std::unordered_map<std::string, float> categoryTotals;  // Filtered category totals
  float totalCost = 0.0f;
  float filteredTotalCost = 0.0f;
  float contentHeight = 5.0f;  // Initial padding
  std::string prevCategory;
  int filteredCount = 0;
  for (const auto& mat : materials) {
    // Always calculate full total for reference
    totalCost += mat.unitPrice * mat.quantity;

    // Check assembly filter first (if active), then text filter
    bool passesAssemblyFilter = !hasAssemblyFilter || assemblyFilterSet.count(mat.materialId) > 0;
    bool passesTextFilter = materialMatchesFilter(mat, uiState.materialFilterText);

    // Calculate content height and totals only for filtered items
    if (passesAssemblyFilter && passesTextFilter) {
      filteredCount++;
      float itemCost = mat.unitPrice * mat.quantity;
      filteredTotalCost += itemCost;
      categoryTotals[mat.category] += itemCost;  // Only count filtered items in category
      if (mat.category != prevCategory) {
        prevCategory = mat.category;
        contentHeight += 5.0f + sectionHeight;  // Category header
      }
      contentHeight += rowHeight;
    }
  }

  // Scrollable area dimensions (account for search box)
  const float scrollAreaY = panelY + headerHeight + searchBoxHeight;
  const float scrollAreaHeight = panelHeight - headerHeight - searchBoxHeight - footerHeight;
  const float maxScroll = std::max(0.0f, contentHeight - scrollAreaHeight);

  // Panel background
  DrawRectangle(static_cast<int>(panelX), static_cast<int>(panelY),
                static_cast<int>(panelWidth), static_cast<int>(panelHeight),
                Fade(RAYWHITE, 0.95f));
  DrawRectangleLines(static_cast<int>(panelX), static_cast<int>(panelY),
                     static_cast<int>(panelWidth), static_cast<int>(panelHeight), DARKGRAY);

  // Title with drag handle
  DrawTextEx(uiFont, "MATERIALS & PRICING", {panelX + 10, panelY + 8}, 16.0f, 0.0f, DARKGRAY);
  DrawDragHandle(uiFont, panelX, panelY, panelWidth);
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(panelY + headerHeight),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(panelY + headerHeight), LIGHTGRAY);

  // Search box
  float searchY = panelY + headerHeight + 3.0f;
  Rectangle searchRect = {panelX + 10, searchY, panelWidth - 20, searchBoxHeight - 6.0f};

  // Draw search box background
  DrawRectangleRec(searchRect, Fade(LIGHTGRAY, 0.2f));
  DrawRectangleLinesEx(searchRect, 1.0f, uiState.materialFilterActive ? BLUE : GRAY);

  // Handle search box focus
  if (CheckCollisionPointRec(mousePos, searchRect) && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    uiState.materialFilterActive = true;
  } else if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT) && !CheckCollisionPointRec(mousePos, searchRect)) {
    uiState.materialFilterActive = false;
  }

  // Handle text input when search box is active
  if (uiState.materialFilterActive) {
    int key = GetCharPressed();
    size_t len = strlen(uiState.materialFilterText);
    while (key > 0) {
      if ((key >= 32) && (key <= 125) && (len < sizeof(uiState.materialFilterText) - 1)) {
        uiState.materialFilterText[len] = static_cast<char>(key);
        uiState.materialFilterText[len + 1] = '\0';
        len++;
        uiState.materialScrollOffset = 0.0f;  // Reset scroll when filter changes
      }
      key = GetCharPressed();
    }
    if (IsKeyPressed(KEY_BACKSPACE) && len > 0) {
      uiState.materialFilterText[len - 1] = '\0';
      uiState.materialScrollOffset = 0.0f;
    }
    if (IsKeyPressed(KEY_ESCAPE)) {
      uiState.materialFilterActive = false;
    }
  }

  // Draw search text or placeholder
  const char* searchDisplayText = (uiState.materialFilterText[0] != '\0')
                                      ? uiState.materialFilterText
                                      : "Search materials...";
  Color searchTextColor = (uiState.materialFilterText[0] != '\0') ? DARKGRAY : GRAY;
  DrawTextEx(uiFont, searchDisplayText, {searchRect.x + 5, searchRect.y + 3}, 12.0f, 0.0f, searchTextColor);

  // Draw cursor when active
  if (uiState.materialFilterActive && ((static_cast<int>(GetTime() * 2.0f) % 2) == 0)) {
    float cursorX = searchRect.x + 5 + MeasureTextEx(uiFont, uiState.materialFilterText, 12.0f, 0.0f).x + 1;
    DrawLine(static_cast<int>(cursorX), static_cast<int>(searchRect.y + 3),
             static_cast<int>(cursorX), static_cast<int>(searchRect.y + 15), DARKGRAY);
  }

  // Draw filter indicator and clear button if filtering
  if (uiState.materialFilterText[0] != '\0') {
    // Clear button (X)
    Rectangle clearRect = {searchRect.x + searchRect.width - 18, searchRect.y + 2, 16, 16};
    bool clearHovered = CheckCollisionPointRec(mousePos, clearRect);
    DrawTextEx(uiFont, "X", {clearRect.x + 4, clearRect.y + 1}, 12.0f, 0.0f,
               clearHovered ? RED : GRAY);
    if (clearHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
      uiState.materialFilterText[0] = '\0';
      uiState.materialScrollOffset = 0.0f;
    }
  }

  // Handle mouse wheel scrolling when over panel
  Rectangle panelRect = {panelX, panelY, panelWidth, panelHeight};
  if (CheckCollisionPointRec(mousePos, panelRect)) {
    float wheel = GetMouseWheelMove();
    if (wheel != 0.0f) {
      uiState.materialScrollOffset -= wheel * 30.0f;
      uiState.materialScrollOffset = std::max(0.0f, std::min(uiState.materialScrollOffset, maxScroll));
    }
  }

  // Begin scissor mode for content clipping
  BeginScissorMode(static_cast<int>(panelX + 1), static_cast<int>(scrollAreaY + 1),
                   static_cast<int>(panelWidth - 2), static_cast<int>(scrollAreaHeight - 2));

  float yPos = scrollAreaY + 5.0f - uiState.materialScrollOffset;
  std::string currentCategory;

  for (const auto& mat : materials) {
    // Skip materials that don't match the assembly filter (if active)
    if (hasAssemblyFilter && assemblyFilterSet.count(mat.materialId) == 0) {
      continue;
    }
    // Skip materials that don't match the text filter
    if (!materialMatchesFilter(mat, uiState.materialFilterText)) {
      continue;
    }

    // Category header
    if (mat.category != currentCategory) {
      currentCategory = mat.category;
      yPos += 5.0f;

      // Only draw if visible
      if (yPos + sectionHeight > scrollAreaY && yPos < scrollAreaY + scrollAreaHeight) {
        DrawRectangle(static_cast<int>(panelX + 5), static_cast<int>(yPos),
                      static_cast<int>(panelWidth - 10 - scrollbarWidth), static_cast<int>(sectionHeight - 2),
                      Fade(LIGHTGRAY, 0.3f));

        char catHeader[128];
        snprintf(catHeader, sizeof(catHeader), "%s (%.0f EUR)",
                 toUpper(currentCategory).c_str(), categoryTotals[currentCategory]);
        DrawTextEx(uiFont, catHeader, {panelX + 10, yPos + 5}, 14.0f, 0.0f, DARKGRAY);
      }
      yPos += sectionHeight;
    }

    // Only process row if visible
    if (yPos + rowHeight > scrollAreaY && yPos < scrollAreaY + scrollAreaHeight) {
      // Check if mouse is over thermal panel (to prevent hover/click through)
      bool mouseOverThermalPanel = false;
      if (uiState.thermalViewEnabled && uiState.thermalPos.initialized) {
        Rectangle thermalBounds = {uiState.thermalPos.x, uiState.thermalPos.y, 320.0f, 500.0f};
        mouseOverThermalPanel = CheckCollisionPointRec(mousePos, thermalBounds);
      }

      // Check if mouse is over this row (only within scroll area, not over thermal panel)
      Rectangle rowRect = {panelX + 5, yPos, panelWidth - 10 - scrollbarWidth, rowHeight};
      bool isHovered = CheckCollisionPointRec(mousePos, rowRect) &&
                       mousePos.y >= scrollAreaY && mousePos.y < scrollAreaY + scrollAreaHeight &&
                       !mouseOverThermalPanel;
      bool isSelected = !uiState.selectedMaterialId.empty() &&
                        uiState.selectedMaterialId == mat.materialId;

      // Check if this material is being hovered from assembly panel parts list
      bool isCrossHighlighted = !uiState.hoveredPartMaterialId.empty() &&
                                uiState.hoveredPartMaterialId == mat.materialId;

      // Highlight hovered/selected/cross-highlighted row
      if (isHovered || isSelected || isCrossHighlighted) {
        Color highlightColor = isSelected ? Fade(ORANGE, 0.25f) :
                               (isCrossHighlighted ? Fade(GREEN, 0.2f) : Fade(SKYBLUE, 0.2f));
        DrawRectangleRec(rowRect, highlightColor);
        if (isHovered) {
          uiState.hoveredMaterialId = mat.materialId;
        }
      }

      // Handle click to select/open link (isHovered already excludes thermal panel)
      if (isHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        if (uiState.selectedMaterialId == mat.materialId) {
          // Already selected - open link if available
          if (!mat.link.empty()) {
            std::string cmd = "open \"" + mat.link + "\"";
            system(cmd.c_str());
          }
          uiState.selectedMaterialId.clear();
        } else {
          uiState.selectedMaterialId = mat.materialId;
        }
      }

      // Color swatch
      float swatchX = panelX + 10;
      float swatchY = yPos + (rowHeight - colorSwatchSize) / 2.0f;
      DrawRectangle(static_cast<int>(swatchX), static_cast<int>(swatchY),
                    static_cast<int>(colorSwatchSize), static_cast<int>(colorSwatchSize),
                    mat.color);
      DrawRectangleLines(static_cast<int>(swatchX), static_cast<int>(swatchY),
                         static_cast<int>(colorSwatchSize), static_cast<int>(colorSwatchSize),
                         DARKGRAY);

      // Material name (after color swatch)
      std::string displayName = toUpper(mat.name);
      if (displayName.length() > 20) {
        displayName = displayName.substr(0, 17) + "...";
      }

      Color textColor = isHovered ? DARKBLUE : GRAY;
      DrawTextEx(uiFont, displayName.c_str(), {swatchX + colorSwatchSize + 6, yPos + 4}, 12.0f, 0.0f, textColor);

      // Surface area and price on right
      float lineTotal = mat.unitPrice * mat.quantity;
      char priceText[80];
      if (mat.surfaceArea > 0.0f) {
        // Show surface area in m² (or cm² if very small)
        if (mat.surfaceArea >= 0.01f) {
          snprintf(priceText, sizeof(priceText), "%.2f m\xc2\xb2  %dX%.0f", mat.surfaceArea, mat.quantity, lineTotal);
        } else {
          // Convert to cm² for very small areas
          float areaCm2 = mat.surfaceArea * 10000.0f;
          snprintf(priceText, sizeof(priceText), "%.0f cm\xc2\xb2  %dX%.0f", areaCm2, mat.quantity, lineTotal);
        }
      } else {
        snprintf(priceText, sizeof(priceText), "%dX%.0f", mat.quantity, lineTotal);
      }
      float priceWidth = MeasureTextEx(uiFont, priceText, 11.0f, 0.0f).x;
      DrawTextEx(uiFont, priceText, {panelX + panelWidth - priceWidth - 15 - scrollbarWidth, yPos + 5}, 11.0f, 0.0f, GRAY);
    }

    yPos += rowHeight;
  }

  EndScissorMode();

  // Draw scrollbar if content overflows
  if (maxScroll > 0.0f) {
    float scrollbarX = panelX + panelWidth - scrollbarWidth - 3;
    float scrollbarTrackY = scrollAreaY + 2;
    float scrollbarTrackHeight = scrollAreaHeight - 4;

    // Track
    DrawRectangle(static_cast<int>(scrollbarX), static_cast<int>(scrollbarTrackY),
                  static_cast<int>(scrollbarWidth), static_cast<int>(scrollbarTrackHeight),
                  Fade(LIGHTGRAY, 0.3f));

    // Thumb
    float thumbHeight = std::max(20.0f, scrollbarTrackHeight * (scrollAreaHeight / contentHeight));
    float thumbY = scrollbarTrackY + (scrollbarTrackHeight - thumbHeight) * (uiState.materialScrollOffset / maxScroll);
    DrawRectangle(static_cast<int>(scrollbarX), static_cast<int>(thumbY),
                  static_cast<int>(scrollbarWidth), static_cast<int>(thumbHeight),
                  Fade(GRAY, 0.6f));
  }

  // Footer area (total and hints)
  float footerY = panelY + panelHeight - footerHeight;
  DrawRectangle(static_cast<int>(panelX + 1), static_cast<int>(footerY),
                static_cast<int>(panelWidth - 2), static_cast<int>(footerHeight),
                Fade(RAYWHITE, 0.95f));
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(footerY + 5),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(footerY + 5), DARKGRAY);

  // Show filtered or total cost
  char totalText[80];
  if (hasAssemblyFilter) {
    // Assembly step filter active - show step cost
    snprintf(totalText, sizeof(totalText), "STEP COST: %.0f EUR (of %.0f)",
             filteredTotalCost, totalCost);
  } else if (uiState.materialFilterText[0] != '\0') {
    // Text search filter active
    snprintf(totalText, sizeof(totalText), "SHOWING %d/%zu (%.0f EUR)",
             filteredCount, materials.size(), filteredTotalCost);
  } else {
    snprintf(totalText, sizeof(totalText), "TOTAL: %.2f EUR", totalCost);
  }
  DrawTextEx(uiFont, totalText, {panelX + 10, footerY + 15}, 16.0f, 0.0f, DARKGRAY);

  // Hotkey hint and instructions
  DrawTextEx(uiFont, "[M] TOGGLE  SHIFT+CLICK 3D=SELECT",
             {panelX + 10, footerY + 35}, 10.0f, 0.0f, LIGHTGRAY);
}

bool DrawParametersPanel(std::vector<SceneParameter>& parameters,
                         UIState& state,
                         const Font& uiFont,
                         int screenWidth, int screenHeight,
                         const std::filesystem::path& scriptPath) {
  if (parameters.empty()) return false;

  const float panelWidth = 260.0f;
  const float panelHeight = 580.0f;

  // Initialize default position if not set
  if (!state.parametersPos.initialized) {
    state.parametersPos.x = static_cast<float>(screenWidth) - panelWidth - 10.0f;
    state.parametersPos.y = kToolbarHeight + 10.0f;
    state.parametersPos.initialized = true;
  }

  float panelX = state.parametersPos.x;
  float panelY = state.parametersPos.y;

  // Handle dragging
  HandlePanelDrag(state, 1, state.parametersPos, panelX, panelY, panelWidth, 28.0f);
  panelX = state.parametersPos.x;
  panelY = state.parametersPos.y;
  const float rowHeight = 28.0f;
  const float headerHeight = 30.0f;
  const float sectionHeight = 24.0f;
  const float sliderHeight = 16.0f;

  // Panel background
  DrawRectangle(static_cast<int>(panelX), static_cast<int>(panelY),
                static_cast<int>(panelWidth), static_cast<int>(panelHeight),
                Fade(RAYWHITE, 0.95f));
  DrawRectangleLines(static_cast<int>(panelX), static_cast<int>(panelY),
                     static_cast<int>(panelWidth), static_cast<int>(panelHeight), DARKGRAY);

  // Title with drag handle
  DrawTextEx(uiFont, "PARAMETERS", {panelX + 10, panelY + 8}, 16.0f, 0.0f, DARKGRAY);
  DrawDragHandle(uiFont, panelX, panelY, panelWidth);
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(panelY + headerHeight),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(panelY + headerHeight), LIGHTGRAY);

  // Live updates checkbox
  Rectangle checkboxRect = {panelX + panelWidth - 65, panelY + 8, 14, 14};
  GuiCheckBox(checkboxRect, "Live", &state.liveUpdatesEnabled);

  // Calculate content height for scroll limits
  float contentHeight = 0.0f;
  std::string tempSection;
  for (const auto& param : parameters) {
    if (param.section != tempSection) {
      tempSection = param.section;
      contentHeight += 5.0f + sectionHeight;
    }
    contentHeight += 12.0f + rowHeight;
  }

  // Handle mouse wheel scrolling when mouse is over panel
  Rectangle panelRect = {panelX, panelY + headerHeight, panelWidth, panelHeight - headerHeight - 25.0f};
  if (CheckCollisionPointRec(GetMousePosition(), panelRect)) {
    float wheel = GetMouseWheelMove();
    state.parameterScrollOffset -= wheel * 40.0f;
  }

  // Clamp scroll offset
  float maxScroll = std::max(0.0f, contentHeight - (panelHeight - headerHeight - 50.0f));
  state.parameterScrollOffset = std::clamp(state.parameterScrollOffset, 0.0f, maxScroll);

  // Begin scissor mode to clip content
  BeginScissorMode(static_cast<int>(panelX), static_cast<int>(panelY + headerHeight + 2),
                   static_cast<int>(panelWidth), static_cast<int>(panelHeight - headerHeight - 25.0f));

  float yPos = panelY + headerHeight + 5.0f - state.parameterScrollOffset;
  std::string currentSection;

  for (size_t i = 0; i < parameters.size(); ++i) {
    // Skip rendering items far above viewport (optimization)
    if (yPos + rowHeight + sectionHeight < panelY + headerHeight) {
      auto& param = parameters[i];
      if (param.section != currentSection) {
        currentSection = param.section;
        yPos += 5.0f + sectionHeight;
      }
      yPos += 12.0f + rowHeight;
      continue;
    }
    // Stop rendering items far below viewport
    if (yPos > panelY + panelHeight) break;

    auto& param = parameters[i];

    // Section header
    if (param.section != currentSection) {
      currentSection = param.section;
      yPos += 5.0f;
      DrawRectangle(static_cast<int>(panelX + 5), static_cast<int>(yPos),
                    static_cast<int>(panelWidth - 10), static_cast<int>(sectionHeight - 2),
                    Fade(LIGHTGRAY, 0.3f));
      DrawTextEx(uiFont, toUpper(currentSection).c_str(), {panelX + 10, yPos + 5}, 13.0f, 0.0f, DARKGRAY);
      yPos += sectionHeight;
    }

    // Parameter label
    DrawTextEx(uiFont, toUpper(param.displayName).c_str(), {panelX + 10, yPos}, 12.0f, 0.0f, GRAY);

    // Value display
    char valueText[32];
    if (param.name == "nest_boxes") {
      snprintf(valueText, sizeof(valueText), "%d", static_cast<int>(param.value));
    } else if (param.name == "roof_pitch_deg") {
      snprintf(valueText, sizeof(valueText), "%.0f DEG", param.value);
    } else {
      snprintf(valueText, sizeof(valueText), "%.0f MM", param.value);
    }
    float valueWidth = MeasureTextEx(uiFont, valueText, 12.0f, 0.0f).x;
    DrawTextEx(uiFont, valueText, {panelX + panelWidth - valueWidth - 15, yPos}, 12.0f, 0.0f, DARKGRAY);

    yPos += 12.0f;

    // Slider
    Rectangle sliderRect = {panelX + 10, yPos, panelWidth - 25, sliderHeight};
    float oldValue = param.value;
    GuiSlider(sliderRect, "", "", &param.value, param.minValue, param.maxValue);

    // Round to integer
    param.value = std::round(param.value);

    // Track dragging state
    if (param.value != oldValue && state.draggingParamIndex == -1) {
      state.draggingParamIndex = static_cast<int>(i);
      state.draggingStartValue = oldValue;
    }

    yPos += rowHeight;
  }

  // End scissor mode
  EndScissorMode();

  // Draw scroll indicator if content is scrollable
  if (maxScroll > 0.0f) {
    float scrollbarHeight = (panelHeight - headerHeight - 50.0f) * (panelHeight - headerHeight - 50.0f) / contentHeight;
    float scrollbarY = panelY + headerHeight + 5.0f + (state.parameterScrollOffset / maxScroll) * (panelHeight - headerHeight - 55.0f - scrollbarHeight);
    DrawRectangle(static_cast<int>(panelX + panelWidth - 8), static_cast<int>(scrollbarY),
                  4, static_cast<int>(scrollbarHeight), Fade(GRAY, 0.5f));
  }

  // Only write to file when mouse is released
  bool paramWritten = false;
  if (state.draggingParamIndex >= 0 && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
    auto& param = parameters[state.draggingParamIndex];
    if (param.value != state.draggingStartValue) {
      if (WriteParameterToFile(scriptPath, param)) {
        paramWritten = true;
      }
    }
    state.draggingParamIndex = -1;
  }

  // Hotkey hint
  DrawTextEx(uiFont, "[T] TOGGLE", {panelX + panelWidth - 85, panelY + panelHeight - 18}, 12.0f, 0.0f, LIGHTGRAY);

  return paramWritten;
}

bool IsMouseOverPanels(const std::vector<MaterialItem>& materials,
                       const std::vector<SceneParameter>& parameters,
                       bool showMaterialsPanel,
                       bool showParametersPanel,
                       int screenWidth, int screenHeight) {
  Vector2 mousePos = GetMousePosition();

  // Toolbar at top
  if (mousePos.y < kToolbarHeight) {
    return true;
  }

  // Materials panel bounds
  if (showMaterialsPanel && !materials.empty()) {
    float panelY = kToolbarHeight + 8.0f;
    float panelHeight = static_cast<float>(screenHeight) - kToolbarHeight - 60.0f;
    Rectangle matPanel = {10.0f, panelY, 320.0f, panelHeight};
    if (CheckCollisionPointRec(mousePos, matPanel)) {
      return true;
    }
  }

  // Parameters panel bounds
  if (showParametersPanel && !parameters.empty()) {
    float paramPanelWidth = 280.0f;
    float paramPanelX = static_cast<float>(screenWidth) - paramPanelWidth - 10.0f;
    float panelY = kToolbarHeight + 8.0f;
    float panelHeight = static_cast<float>(screenHeight) - kToolbarHeight - 60.0f;
    Rectangle paramPanel = {paramPanelX, panelY, paramPanelWidth, panelHeight};
    if (CheckCollisionPointRec(mousePos, paramPanel)) {
      return true;
    }
  }

  return false;
}

bool DrawThermalPanel(const ThermalAnalysisResult& thermalResult,
                      UIState& uiState,
                      const Font& uiFont,
                      int screenWidth, int screenHeight) {
  bool settingsChanged = false;

  const float panelWidth = 320.0f;
  const float panelHeight = 720.0f;

  // Initialize default position if not set
  if (!uiState.thermalPos.initialized) {
    uiState.thermalPos.x = 10.0f;
    uiState.thermalPos.y = kToolbarHeight + 10.0f;
    uiState.thermalPos.initialized = true;
  }

  float panelX = uiState.thermalPos.x;
  float panelY = uiState.thermalPos.y;

  // Handle dragging
  HandlePanelDrag(uiState, 2, uiState.thermalPos, panelX, panelY, panelWidth, 28.0f);
  panelX = uiState.thermalPos.x;
  panelY = uiState.thermalPos.y;
  const float sliderWidth = panelWidth - 80.0f;

  // Panel background
  DrawRectangle(static_cast<int>(panelX), static_cast<int>(panelY),
                static_cast<int>(panelWidth), static_cast<int>(panelHeight),
                Fade(Color{30, 30, 40, 255}, 0.95f));
  DrawRectangleLines(static_cast<int>(panelX), static_cast<int>(panelY),
                     static_cast<int>(panelWidth), static_cast<int>(panelHeight), DARKGRAY);

  float yPos = panelY + 10.0f;
  ThermalSettings& settings = uiState.thermalSettings;

  // Title with drag handle
  DrawTextEx(uiFont, "THERMAL SIMULATION", {panelX + 10, yPos}, 14.0f, 0.0f, WHITE);
  DrawDragHandle(uiFont, panelX, panelY, panelWidth);
  yPos += 24.0f;

  // === CLIMATE LOCATION SELECTOR ===
  DrawTextEx(uiFont, "CLIMATE LOCATION", {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);
  yPos += 14.0f;

  // Draw location buttons in two rows
  const auto& locations = GetClimateLocations();
  float btnWidth = 38.0f;
  float btnHeight = 18.0f;
  float btnSpacing = 3.0f;
  int buttonsPerRow = 4;

  for (size_t i = 0; i < locations.size(); ++i) {
    int row = static_cast<int>(i) / buttonsPerRow;
    int col = static_cast<int>(i) % buttonsPerRow;
    float btnX = panelX + 10.0f + col * (btnWidth + btnSpacing);
    float btnY = yPos + row * (btnHeight + 2.0f);

    bool isSelected = (static_cast<int>(i) == settings.selectedLocationIndex);
    Color btnColor = isSelected ? Color{60, 120, 180, 255} : Color{50, 50, 60, 255};
    Color textColor = isSelected ? WHITE : LIGHTGRAY;

    Rectangle btnRect = {btnX, btnY, btnWidth, btnHeight};
    DrawRectangleRec(btnRect, btnColor);
    if (isSelected) {
      DrawRectangleLinesEx(btnRect, 1.0f, SKYBLUE);
    }

    // Draw location code centered
    Vector2 codeSize = MeasureTextEx(uiFont, locations[i].code.c_str(), 10.0f, 0.0f);
    DrawTextEx(uiFont, locations[i].code.c_str(),
               {btnX + (btnWidth - codeSize.x) / 2.0f, btnY + 4.0f},
               10.0f, 0.0f, textColor);

    // Check for click
    if (CheckCollisionPointRec(GetMousePosition(), btnRect) && IsMouseButtonPressed(MOUSE_LEFT_BUTTON)) {
      settings.selectedLocationIndex = static_cast<int>(i);
      settingsChanged = true;
    }
  }

  yPos += ((static_cast<int>(locations.size()) + buttonsPerRow - 1) / buttonsPerRow) * (btnHeight + 2.0f) + 6.0f;

  // Show selected location name
  const ClimateLocation& selectedClimate = GetClimateLocation(settings.selectedLocationIndex);
  DrawTextEx(uiFont, selectedClimate.name.c_str(), {panelX + 10, yPos}, 10.0f, 0.0f, SKYBLUE);
  yPos += 14.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 8.0f;

  // === VISUAL TEMPERATURE DISPLAY ===
  // Two boxes: OUTSIDE (input) and INSIDE (calculated equilibrium temp)
  float boxWidth = 90.0f;
  float boxHeight = 60.0f;
  float boxGap = 70.0f;  // Space for arrows
  float boxStartX = panelX + (panelWidth - 2 * boxWidth - boxGap) / 2.0f;

  // Outside temp box (left) - USER INPUT
  float outsideBoxX = boxStartX;
  Color outsideColor = settings.outsideTemp < 0 ? SKYBLUE : (settings.outsideTemp < 10 ? Color{100, 180, 255, 255} : GREEN);
  DrawRectangle(static_cast<int>(outsideBoxX), static_cast<int>(yPos),
                static_cast<int>(boxWidth), static_cast<int>(boxHeight), Fade(outsideColor, 0.3f));
  DrawRectangleLines(static_cast<int>(outsideBoxX), static_cast<int>(yPos),
                     static_cast<int>(boxWidth), static_cast<int>(boxHeight), outsideColor);
  DrawTextEx(uiFont, "OUTSIDE", {outsideBoxX + 15, yPos + 5}, 11.0f, 0.0f, LIGHTGRAY);
  char tempLabel[32];
  snprintf(tempLabel, sizeof(tempLabel), "%.0f", settings.outsideTemp);
  Vector2 tempSize = MeasureTextEx(uiFont, tempLabel, 28.0f, 0.0f);
  DrawTextEx(uiFont, tempLabel, {outsideBoxX + (boxWidth - tempSize.x) / 2.0f, yPos + 22}, 28.0f, 0.0f, outsideColor);
  DrawTextEx(uiFont, "\xc2\xb0""C", {outsideBoxX + (boxWidth + tempSize.x) / 2.0f + 2, yPos + 26}, 14.0f, 0.0f, outsideColor);

  // Inside temp box (right) - CALCULATED OUTPUT (equilibrium temperature)
  float insideBoxX = outsideBoxX + boxWidth + boxGap;
  float insideTemp = thermalResult.equilibriumTemp;  // This is the OUTPUT!
  Color insideColor = insideTemp < 0 ? RED : (insideTemp < 10 ? ORANGE : GREEN);
  DrawRectangle(static_cast<int>(insideBoxX), static_cast<int>(yPos),
                static_cast<int>(boxWidth), static_cast<int>(boxHeight), Fade(insideColor, 0.3f));
  DrawRectangleLines(static_cast<int>(insideBoxX), static_cast<int>(yPos),
                     static_cast<int>(boxWidth), static_cast<int>(boxHeight), insideColor);
  DrawTextEx(uiFont, "INSIDE", {insideBoxX + 20, yPos + 5}, 11.0f, 0.0f, LIGHTGRAY);
  snprintf(tempLabel, sizeof(tempLabel), "%.1f", insideTemp);
  tempSize = MeasureTextEx(uiFont, tempLabel, 24.0f, 0.0f);
  DrawTextEx(uiFont, tempLabel, {insideBoxX + (boxWidth - tempSize.x) / 2.0f, yPos + 24}, 24.0f, 0.0f, insideColor);
  DrawTextEx(uiFont, "\xc2\xb0""C", {insideBoxX + (boxWidth + tempSize.x) / 2.0f + 2, yPos + 28}, 12.0f, 0.0f, insideColor);
  // Label indicating this is calculated
  DrawTextEx(uiFont, "(calculated)", {insideBoxX + 12, yPos + 48}, 9.0f, 0.0f, DARKGRAY);

  // Heat flow arrows (animated pulse based on heat loss)
  float arrowCenterX = outsideBoxX + boxWidth + boxGap / 2.0f;
  float arrowY = yPos + boxHeight / 2.0f;
  float arrowLen = 25.0f;

  // Animate arrows with pulsing based on time
  float pulse = 0.5f + 0.5f * sinf(static_cast<float>(GetTime()) * 4.0f);
  // Delta is now based on equilibrium temp vs outside temp
  float eqDelta = insideTemp - settings.outsideTemp;
  Color arrowColor = Fade(eqDelta > 0 ? RED : SKYBLUE, 0.6f + 0.4f * pulse);

  if (eqDelta > 0) {
    // Heat flowing OUT (inside warmer than outside) - arrows point left
    for (int i = 0; i < 3; i++) {
      float offset = static_cast<float>(i - 1) * 12.0f;
      float ax = arrowCenterX + offset;
      // Arrow pointing left (heat escaping)
      DrawLine(static_cast<int>(ax + arrowLen/2), static_cast<int>(arrowY),
               static_cast<int>(ax - arrowLen/2), static_cast<int>(arrowY), arrowColor);
      DrawLine(static_cast<int>(ax - arrowLen/2), static_cast<int>(arrowY),
               static_cast<int>(ax - arrowLen/2 + 8), static_cast<int>(arrowY - 6), arrowColor);
      DrawLine(static_cast<int>(ax - arrowLen/2), static_cast<int>(arrowY),
               static_cast<int>(ax - arrowLen/2 + 8), static_cast<int>(arrowY + 6), arrowColor);
    }
    // Heat loss label
    char lossLabel[32];
    snprintf(lossLabel, sizeof(lossLabel), "%.0fW", thermalResult.totalHeatLoss_W);
    Vector2 lossSize = MeasureTextEx(uiFont, lossLabel, 10.0f, 0.0f);
    DrawTextEx(uiFont, lossLabel, {arrowCenterX - lossSize.x / 2.0f, arrowY + 12}, 10.0f, 0.0f, RED);
  } else if (eqDelta < 0) {
    // Heat flowing IN (outside warmer) - arrows point right
    for (int i = 0; i < 3; i++) {
      float offset = static_cast<float>(i - 1) * 12.0f;
      float ax = arrowCenterX + offset;
      DrawLine(static_cast<int>(ax - arrowLen/2), static_cast<int>(arrowY),
               static_cast<int>(ax + arrowLen/2), static_cast<int>(arrowY), arrowColor);
      DrawLine(static_cast<int>(ax + arrowLen/2), static_cast<int>(arrowY),
               static_cast<int>(ax + arrowLen/2 - 8), static_cast<int>(arrowY - 6), arrowColor);
      DrawLine(static_cast<int>(ax + arrowLen/2), static_cast<int>(arrowY),
               static_cast<int>(ax + arrowLen/2 - 8), static_cast<int>(arrowY + 6), arrowColor);
    }
  } else {
    // No heat flow
    DrawTextEx(uiFont, "=", {arrowCenterX - 5, arrowY - 8}, 16.0f, 0.0f, GRAY);
  }

  yPos += boxHeight + 10.0f;

  // Delta T prominently displayed (using equilibrium-based delta)
  char deltaText[64];
  snprintf(deltaText, sizeof(deltaText), "\xce\x94T = %.1f\xc2\xb0""C  (inside %s outside)",
           eqDelta, eqDelta > 0 ? "warmer than" : (eqDelta < 0 ? "colder than" : "="));
  DrawTextEx(uiFont, deltaText, {panelX + 10, yPos}, 11.0f, 0.0f,
             eqDelta > 0 ? ORANGE : (eqDelta < 0 ? SKYBLUE : GRAY));
  yPos += 18.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 6.0f;

  // === OUTSIDE TEMPERATURE (the only input) ===
  DrawTextEx(uiFont, "OUTSIDE TEMPERATURE", {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);
  yPos += 14.0f;

  // Outside temperature slider with value display
  char outTempLabel[16];
  snprintf(outTempLabel, sizeof(outTempLabel), "%.0f\xc2\xb0""C", settings.outsideTemp);
  DrawTextEx(uiFont, outTempLabel, {panelX + 10, yPos + 1}, 11.0f, 0.0f, SKYBLUE);
  Rectangle outsideSlider = {panelX + 60, yPos, sliderWidth - 20, 12};
  float oldOutside = settings.outsideTemp;
  GuiSlider(outsideSlider, "", "", &settings.outsideTemp, -40.0f, 30.0f);
  settings.outsideTemp = std::round(settings.outsideTemp);
  if (settings.outsideTemp != oldOutside) settingsChanged = true;
  yPos += 20.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 8.0f;

  // === HEAT SOURCES ===
  DrawTextEx(uiFont, "HEAT SOURCES", {panelX + 10, yPos}, 12.0f, 0.0f, SKYBLUE);
  yPos += 20.0f;

  // Chickens checkbox and count
  Rectangle chickenCheck = {panelX + 10, yPos, 14, 14};
  bool oldChickensEnabled = settings.chickensEnabled;
  GuiCheckBox(chickenCheck, "", &settings.chickensEnabled);
  if (settings.chickensEnabled != oldChickensEnabled) settingsChanged = true;

  DrawTextEx(uiFont, "CHICKENS", {panelX + 30, yPos + 1}, 11.0f, 0.0f,
             settings.chickensEnabled ? WHITE : GRAY);

  // Chicken count slider
  float chickenCount = static_cast<float>(settings.chickenCount);
  Rectangle chickenSlider = {panelX + 110, yPos, 120, 14};
  float oldCount = chickenCount;
  GuiSlider(chickenSlider, "", "", &chickenCount, 0.0f, 12.0f);
  settings.chickenCount = static_cast<int>(std::round(chickenCount));
  if (chickenCount != oldCount) settingsChanged = true;

  char chickenLabel[32];
  float chickenHeat = settings.chickensEnabled ? settings.chickenCount * settings.heatPerChicken_W : 0.0f;
  snprintf(chickenLabel, sizeof(chickenLabel), "%d (%.0fW)", settings.chickenCount, chickenHeat);
  float chickenLabelW = MeasureTextEx(uiFont, chickenLabel, 11.0f, 0.0f).x;
  DrawTextEx(uiFont, chickenLabel, {panelX + panelWidth - chickenLabelW - 10, yPos + 1}, 11.0f, 0.0f,
             settings.chickensEnabled ? ORANGE : GRAY);
  yPos += 22.0f;

  // Heater checkbox and power
  Rectangle heaterCheck = {panelX + 10, yPos, 14, 14};
  bool oldHeaterEnabled = settings.heaterEnabled;
  GuiCheckBox(heaterCheck, "", &settings.heaterEnabled);
  if (settings.heaterEnabled != oldHeaterEnabled) settingsChanged = true;

  DrawTextEx(uiFont, "HEATER", {panelX + 30, yPos + 1}, 11.0f, 0.0f,
             settings.heaterEnabled ? WHITE : GRAY);

  // Heater power slider
  Rectangle heaterSlider = {panelX + 110, yPos, 120, 14};
  float oldPower = settings.heaterPower_W;
  GuiSlider(heaterSlider, "", "", &settings.heaterPower_W, 0.0f, 500.0f);
  settings.heaterPower_W = std::round(settings.heaterPower_W / 10.0f) * 10.0f;  // Round to 10W
  if (settings.heaterPower_W != oldPower) settingsChanged = true;

  char heaterLabel[32];
  snprintf(heaterLabel, sizeof(heaterLabel), "%.0fW", settings.heaterEnabled ? settings.heaterPower_W : 0.0f);
  float heaterLabelW = MeasureTextEx(uiFont, heaterLabel, 11.0f, 0.0f).x;
  DrawTextEx(uiFont, heaterLabel, {panelX + panelWidth - heaterLabelW - 10, yPos + 1}, 11.0f, 0.0f,
             settings.heaterEnabled ? RED : GRAY);
  yPos += 22.0f;

  // Total heat input
  char inputText[48];
  snprintf(inputText, sizeof(inputText), "TOTAL HEAT INPUT: %.0fW", thermalResult.totalHeatInput_W);
  DrawTextEx(uiFont, inputText, {panelX + 10, yPos}, 11.0f, 0.0f, LIGHTGRAY);
  yPos += 22.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 8.0f;

  // === ANALYSIS RESULTS ===
  DrawTextEx(uiFont, "THERMAL ANALYSIS", {panelX + 10, yPos}, 12.0f, 0.0f, SKYBLUE);
  yPos += 20.0f;

  // Total heat loss
  char heatText[64];
  snprintf(heatText, sizeof(heatText), "HEAT LOSS: %.0fW (%.2f kW)",
           thermalResult.totalHeatLoss_W, thermalResult.heatingPower_kW);
  DrawTextEx(uiFont, heatText, {panelX + 10, yPos}, 12.0f, 0.0f, ORANGE);
  yPos += 20.0f;

  // Heat balance (is heat input sufficient?)
  Color balanceColor = thermalResult.heatBalance_W >= 0 ? GREEN : RED;
  const char* balanceSign = thermalResult.heatBalance_W >= 0 ? "+" : "";
  snprintf(heatText, sizeof(heatText), "HEAT BALANCE: %s%.0fW",
           balanceSign, thermalResult.heatBalance_W);
  DrawTextEx(uiFont, heatText, {panelX + 10, yPos}, 12.0f, 0.0f, balanceColor);
  yPos += 20.0f;

  // Heat flux range
  snprintf(heatText, sizeof(heatText), "FLUX RANGE: %.0f - %.0f W/m2",
           thermalResult.minHeatFlux, thermalResult.maxHeatFlux);
  DrawTextEx(uiFont, heatText, {panelX + 10, yPos}, 10.0f, 0.0f, LIGHTGRAY);
  yPos += 18.0f;

  // UA coefficient
  snprintf(heatText, sizeof(heatText), "UA COEFFICIENT: %.1f W/K", thermalResult.totalUA);
  DrawTextEx(uiFont, heatText, {panelX + 10, yPos}, 10.0f, 0.0f, LIGHTGRAY);
  yPos += 16.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 8.0f;

  // === ELECTRICITY COST ===
  DrawTextEx(uiFont, "ELECTRICITY COST", {panelX + 10, yPos}, 12.0f, 0.0f, SKYBLUE);
  yPos += 18.0f;

  // Electricity price slider
  DrawTextEx(uiFont, "PRICE", {panelX + 10, yPos + 1}, 11.0f, 0.0f, WHITE);
  Rectangle priceSlider = {panelX + 60, yPos, 120, 14};
  float oldPrice = settings.electricityPrice_cPerKwh;
  GuiSlider(priceSlider, "", "", &settings.electricityPrice_cPerKwh, 5.0f, 50.0f);
  settings.electricityPrice_cPerKwh = std::round(settings.electricityPrice_cPerKwh);
  if (settings.electricityPrice_cPerKwh != oldPrice) settingsChanged = true;

  char priceLabel[32];
  snprintf(priceLabel, sizeof(priceLabel), "%.0f c/kWh", settings.electricityPrice_cPerKwh);
  float priceLabelW = MeasureTextEx(uiFont, priceLabel, 11.0f, 0.0f).x;
  DrawTextEx(uiFont, priceLabel, {panelX + panelWidth - priceLabelW - 10, yPos + 1}, 11.0f, 0.0f, YELLOW);
  yPos += 22.0f;

  // Calculate monthly cost (based on heater power only, 24/7 operation)
  float heaterPowerKw = settings.heaterEnabled ? settings.heaterPower_W / 1000.0f : 0.0f;
  float hoursPerMonth = 24.0f * 30.0f;  // ~720 hours
  float monthlyKwh = heaterPowerKw * hoursPerMonth;
  float monthlyCostEur = monthlyKwh * settings.electricityPrice_cPerKwh / 100.0f;

  // Monthly kWh consumption
  snprintf(heatText, sizeof(heatText), "HEATER CONSUMPTION: %.0f kWh/month", monthlyKwh);
  DrawTextEx(uiFont, heatText, {panelX + 10, yPos}, 10.0f, 0.0f, LIGHTGRAY);
  yPos += 16.0f;

  // Monthly cost in euros (highlighted)
  if (settings.heaterEnabled && settings.heaterPower_W > 0) {
    snprintf(heatText, sizeof(heatText), "MONTHLY COST: %.2f EUR", monthlyCostEur);
    DrawTextEx(uiFont, heatText, {panelX + 10, yPos}, 14.0f, 0.0f, monthlyCostEur > 50 ? RED : (monthlyCostEur > 20 ? ORANGE : GREEN));
  } else {
    DrawTextEx(uiFont, "MONTHLY COST: 0 EUR (heater off)", {panelX + 10, yPos}, 11.0f, 0.0f, GRAY);
  }
  yPos += 20.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 8.0f;

  // === ANNUAL CLIMATE ANALYSIS ===
  if (thermalResult.hasAnnualData) {
    DrawTextEx(uiFont, "ANNUAL HEATING NEEDS", {panelX + 10, yPos}, 12.0f, 0.0f, SKYBLUE);
    yPos += 18.0f;

    // Monthly temperature bar chart
    float chartX = panelX + 10.0f;
    float chartWidth = panelWidth - 20.0f;
    float chartHeight = 50.0f;
    float barWidth = chartWidth / 12.0f - 2.0f;

    // Draw chart background
    DrawRectangle(static_cast<int>(chartX), static_cast<int>(yPos),
                  static_cast<int>(chartWidth), static_cast<int>(chartHeight),
                  Color{40, 40, 50, 255});

    // Draw zero line (freezing point)
    const ClimateLocation& climate = GetClimateLocation(settings.selectedLocationIndex);
    float minTemp = -20.0f, maxTemp = 20.0f;
    float zeroY = yPos + chartHeight * (maxTemp / (maxTemp - minTemp));
    DrawLine(static_cast<int>(chartX), static_cast<int>(zeroY),
             static_cast<int>(chartX + chartWidth), static_cast<int>(zeroY),
             Fade(WHITE, 0.3f));

    // Draw monthly bars
    for (int m = 0; m < 12; ++m) {
      float temp = climate.monthlyAvgTemp[m];
      float barH = (temp / (maxTemp - minTemp)) * chartHeight;
      float barX = chartX + m * (barWidth + 2.0f) + 1.0f;
      float barY = zeroY - barH;
      if (barH < 0) {
        barY = zeroY;
        barH = -barH;
      }

      Color barColor = temp < 0 ? SKYBLUE : (temp < 10 ? Color{100, 180, 255, 255} : GREEN);
      DrawRectangle(static_cast<int>(barX), static_cast<int>(barY),
                    static_cast<int>(barWidth), static_cast<int>(barH), barColor);

      // Month label (first letter only)
      const char* monthShort = GetMonthShortName(m);
      char monthLetter[2] = {monthShort[0], '\0'};
      DrawTextEx(uiFont, monthLetter, {barX + barWidth/2 - 3, yPos + chartHeight + 2}, 8.0f, 0.0f, GRAY);
    }

    yPos += chartHeight + 14.0f;

    // Annual totals
    char annualText[64];
    snprintf(annualText, sizeof(annualText), "HEATING NEEDED: %.0f kWh/year",
             thermalResult.annualHeatLoss_kWh);
    DrawTextEx(uiFont, annualText, {panelX + 10, yPos}, 11.0f, 0.0f, ORANGE);
    yPos += 16.0f;

    // Annual cost (highlighted)
    Color costColor = thermalResult.annualHeatingCost_EUR > 200 ? RED :
                      (thermalResult.annualHeatingCost_EUR > 100 ? ORANGE : GREEN);
    snprintf(annualText, sizeof(annualText), "ANNUAL COST: %.0f EUR",
             thermalResult.annualHeatingCost_EUR);
    DrawTextEx(uiFont, annualText, {panelX + 10, yPos}, 14.0f, 0.0f, costColor);
    yPos += 22.0f;

    // Design temperature note
    snprintf(annualText, sizeof(annualText), "Design temp: %.0f°C (coldest expected)",
             climate.designTemp);
    DrawTextEx(uiFont, annualText, {panelX + 10, yPos}, 9.0f, 0.0f, DARKGRAY);
    yPos += 16.0f;
  }

  // Status message
  const char* statusMsg;
  Color statusColor;
  if (thermalResult.heatBalance_W >= 0) {
    statusMsg = "WARMING - Heat input exceeds loss";
    statusColor = GREEN;
  } else if (thermalResult.equilibriumTemp >= 0) {
    statusMsg = "COOLING - Will stabilize above freezing";
    statusColor = YELLOW;
  } else if (thermalResult.equilibriumTemp >= -10) {
    statusMsg = "COLD - Consider adding heat source";
    statusColor = ORANGE;
  } else {
    statusMsg = "CRITICAL - Requires heating!";
    statusColor = RED;
  }
  DrawTextEx(uiFont, statusMsg, {panelX + 10, yPos}, 10.0f, 0.0f, statusColor);

  // Hotkey hint
  DrawTextEx(uiFont, "[H] TOGGLE VIEW", {panelX + 10, panelY + panelHeight - 18}, 10.0f, 0.0f, GRAY);

  return settingsChanged;
}

void DrawThermalLegend(float minFlux, float maxFlux,
                       const Font& uiFont,
                       int screenWidth, int screenHeight) {
  // Draw a horizontal color gradient legend at the bottom center
  const float legendWidth = 300.0f;
  const float legendHeight = 20.0f;
  const float legendX = (static_cast<float>(screenWidth) - legendWidth) / 2.0f;
  const float legendY = static_cast<float>(screenHeight) - 50.0f;

  // Background
  DrawRectangle(static_cast<int>(legendX - 10), static_cast<int>(legendY - 25),
                static_cast<int>(legendWidth + 20), static_cast<int>(legendHeight + 45),
                Fade(Color{20, 20, 30, 255}, 0.85f));

  // Title
  Vector2 titleSize = MeasureTextEx(uiFont, "HEAT FLUX (W/m2)", 12.0f, 0.0f);
  DrawTextEx(uiFont, "HEAT FLUX (W/m2)",
             {legendX + (legendWidth - titleSize.x) / 2.0f, legendY - 20.0f},
             12.0f, 0.0f, WHITE);

  // Draw gradient bar
  for (int i = 0; i < static_cast<int>(legendWidth); ++i) {
    float t = static_cast<float>(i) / legendWidth;
    float flux = minFlux + t * (maxFlux - minFlux);
    Color c = HeatFluxToColor(flux, minFlux, maxFlux);
    DrawLine(static_cast<int>(legendX + i), static_cast<int>(legendY),
             static_cast<int>(legendX + i), static_cast<int>(legendY + legendHeight), c);
  }

  // Border
  DrawRectangleLines(static_cast<int>(legendX), static_cast<int>(legendY),
                     static_cast<int>(legendWidth), static_cast<int>(legendHeight), WHITE);

  // Labels
  char minLabel[32], maxLabel[32];
  snprintf(minLabel, sizeof(minLabel), "%.0f", minFlux);
  snprintf(maxLabel, sizeof(maxLabel), "%.0f", maxFlux);

  float labelY = legendY + legendHeight + 5.0f;
  DrawTextEx(uiFont, minLabel, {legendX, labelY}, 11.0f, 0.0f, SKYBLUE);

  Vector2 maxSize = MeasureTextEx(uiFont, maxLabel, 11.0f, 0.0f);
  DrawTextEx(uiFont, maxLabel, {legendX + legendWidth - maxSize.x, labelY}, 11.0f, 0.0f, RED);

  DrawTextEx(uiFont, "LOW", {legendX + 25.0f, labelY}, 10.0f, 0.0f, GRAY);

  Vector2 highSize = MeasureTextEx(uiFont, "HIGH", 10.0f, 0.0f);
  DrawTextEx(uiFont, "HIGH", {legendX + legendWidth - highSize.x - 5.0f, labelY}, 10.0f, 0.0f, GRAY);
}

void DrawStructuralPanel(const StructuralAnalysisResult& structResult,
                         UIState& uiState,
                         const Font& uiFont,
                         int screenWidth, int screenHeight) {
  const float panelWidth = 320.0f;
  const float panelHeight = 350.0f;

  // Initialize default position if not set
  if (!uiState.structuralPos.initialized) {
    uiState.structuralPos.x = static_cast<float>(screenWidth) - panelWidth - 10.0f;
    uiState.structuralPos.y = static_cast<float>(screenHeight) - panelHeight - 50.0f;
    uiState.structuralPos.initialized = true;
  }

  float panelX = uiState.structuralPos.x;
  float panelY = uiState.structuralPos.y;

  // Handle dragging
  HandlePanelDrag(uiState, 3, uiState.structuralPos, panelX, panelY, panelWidth, 28.0f);
  panelX = uiState.structuralPos.x;
  panelY = uiState.structuralPos.y;

  // Panel background with green/red tint based on status
  Color bgColor = structResult.allPassed ? Color{30, 40, 35, 255} : Color{40, 35, 30, 255};
  DrawRectangle(static_cast<int>(panelX), static_cast<int>(panelY),
                static_cast<int>(panelWidth), static_cast<int>(panelHeight),
                Fade(bgColor, 0.95f));
  DrawRectangleLines(static_cast<int>(panelX), static_cast<int>(panelY),
                     static_cast<int>(panelWidth), static_cast<int>(panelHeight), DARKGRAY);

  float yPos = panelY + 10.0f;

  // Title with status color and drag handle
  Color titleColor = structResult.allPassed ? GREEN : (structResult.criticalCount > 0 ? RED :
                     (structResult.errorCount > 0 ? ORANGE : YELLOW));
  DrawTextEx(uiFont, "STRUCTURAL CHECK", {panelX + 10.0f, yPos}, 14.0f, 0.0f, titleColor);
  DrawDragHandle(uiFont, panelX, panelY, panelWidth);
  yPos += 22.0f;

  // Summary counts
  char summaryText[128];
  if (structResult.allPassed) {
    snprintf(summaryText, sizeof(summaryText), "All checks passed");
    DrawTextEx(uiFont, summaryText, {panelX + 10.0f, yPos}, 12.0f, 0.0f, GREEN);
  } else {
    snprintf(summaryText, sizeof(summaryText), "%d critical  %d error  %d warn  %d info",
             structResult.criticalCount, structResult.errorCount,
             structResult.warningCount, structResult.infoCount);
    DrawTextEx(uiFont, summaryText, {panelX + 10.0f, yPos}, 11.0f, 0.0f, LIGHTGRAY);
  }
  yPos += 18.0f;

  // Stats line
  char statsText[128];
  snprintf(statsText, sizeof(statsText), "%.1fm lumber | %d studs | %d joists | %d rafters",
           structResult.totalLumberLength_m, structResult.studCount,
           structResult.joistCount, structResult.rafterCount);
  DrawTextEx(uiFont, statsText, {panelX + 10.0f, yPos}, 10.0f, 0.0f, GRAY);
  yPos += 16.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 8.0f;

  // List each check (grouped by severity)
  int displayCount = 0;
  for (const auto& check : structResult.checks) {
    if (yPos > panelY + panelHeight - 40.0f) {
      // Show "more..." indicator
      char moreText[32];
      snprintf(moreText, sizeof(moreText), "... and %zu more",
               structResult.checks.size() - displayCount);
      DrawTextEx(uiFont, moreText, {panelX + 10.0f, yPos}, 10.0f, 0.0f, GRAY);
      break;
    }

    // Severity indicator color
    Color sevColor;
    const char* sevIcon;
    switch (check.severity) {
      case StructuralSeverity::Critical: sevColor = RED; sevIcon = "[!]"; break;
      case StructuralSeverity::Error: sevColor = ORANGE; sevIcon = "[E]"; break;
      case StructuralSeverity::Warning: sevColor = YELLOW; sevIcon = "[W]"; break;
      case StructuralSeverity::Info: sevColor = SKYBLUE; sevIcon = "[i]"; break;
      default: sevColor = WHITE; sevIcon = "[-]"; break;
    }

    // Issue type and member name
    char headerText[100];
    snprintf(headerText, sizeof(headerText), "%s %s", sevIcon, GetIssueTypeString(check.issueType));
    DrawTextEx(uiFont, headerText, {panelX + 10.0f, yPos}, 11.0f, 0.0f, sevColor);
    yPos += 14.0f;

    // Description
    DrawTextEx(uiFont, check.description.c_str(), {panelX + 20.0f, yPos}, 9.0f, 0.0f, LIGHTGRAY);
    yPos += 12.0f;

    // Suggestion if available
    if (!check.suggestedFix.empty()) {
      char suggestText[120];
      snprintf(suggestText, sizeof(suggestText), "-> %.100s", check.suggestedFix.c_str());
      DrawTextEx(uiFont, suggestText, {panelX + 20.0f, yPos}, 9.0f, 0.0f, GREEN);
      yPos += 12.0f;
    }

    // Reference if available
    if (!check.reference.empty()) {
      char refText[60];
      snprintf(refText, sizeof(refText), "Ref: %s", check.reference.c_str());
      DrawTextEx(uiFont, refText, {panelX + 20.0f, yPos}, 8.0f, 0.0f, DARKGRAY);
      yPos += 10.0f;
    }

    yPos += 4.0f;  // Spacing between checks
    displayCount++;
  }

  // If no issues, show helpful text
  if (structResult.checks.empty()) {
    yPos += 10.0f;
    DrawTextEx(uiFont, "No structural issues detected.", {panelX + 10.0f, yPos}, 10.0f, 0.0f, GREEN);
    yPos += 16.0f;
    DrawTextEx(uiFont, "Checks performed:", {panelX + 10.0f, yPos}, 10.0f, 0.0f, GRAY);
    yPos += 14.0f;
    DrawTextEx(uiFont, "- Span limits (EC5 Table 7.2)", {panelX + 15.0f, yPos}, 9.0f, 0.0f, DARKGRAY);
    yPos += 12.0f;
    DrawTextEx(uiFont, "- Stud/joist spacing (max 600mm)", {panelX + 15.0f, yPos}, 9.0f, 0.0f, DARKGRAY);
    yPos += 12.0f;
    DrawTextEx(uiFont, "- Snow load (Nordic 2 kN/m²)", {panelX + 15.0f, yPos}, 9.0f, 0.0f, DARKGRAY);
    yPos += 12.0f;
    DrawTextEx(uiFont, "- Wind bracing/connectors", {panelX + 15.0f, yPos}, 9.0f, 0.0f, DARKGRAY);
  }

  // Hotkey hint
  DrawTextEx(uiFont, "[S] TOGGLE", {panelX + 10.0f, panelY + panelHeight - 18.0f}, 10.0f, 0.0f, GRAY);
}

bool DrawAssemblyPanel(const AssemblyInstructions& assembly,
                       UIState& uiState,
                       const Font& uiFont,
                       int screenWidth, int screenHeight) {
  bool stepChanged = false;

  if (assembly.steps.empty()) return false;

  const float panelWidth = 450.0f;
  const float panelHeight = 720.0f;
  const float contentWidth = panelWidth - 30.0f;  // Padding on both sides

  // Initialize default position if not set
  if (!uiState.assemblyPos.initialized) {
    uiState.assemblyPos.x = (static_cast<float>(screenWidth) - panelWidth) / 2.0f;
    // Position at bottom of screen, but ensure at least toolbar + margin above
    float preferredY = static_cast<float>(screenHeight) - panelHeight - 40.0f;
    float minY = kToolbarHeight + 10.0f;  // Don't overlap with toolbar
    uiState.assemblyPos.y = std::max(preferredY, minY);
    uiState.assemblyPos.initialized = true;
  }

  float panelX = uiState.assemblyPos.x;
  float panelY = uiState.assemblyPos.y;

  // Handle dragging with bounds checking
  HandlePanelDrag(uiState, 4, uiState.assemblyPos, panelX, panelY, panelWidth, 28.0f);
  // Clamp panel position to stay on screen
  uiState.assemblyPos.x = std::max(0.0f, std::min(uiState.assemblyPos.x, static_cast<float>(screenWidth) - panelWidth));
  uiState.assemblyPos.y = std::max(kToolbarHeight, std::min(uiState.assemblyPos.y, static_cast<float>(screenHeight) - 50.0f));
  panelX = uiState.assemblyPos.x;
  panelY = uiState.assemblyPos.y;

  // Panel background
  DrawRectangle(static_cast<int>(panelX), static_cast<int>(panelY),
                static_cast<int>(panelWidth), static_cast<int>(panelHeight),
                Fade(Color{25, 30, 35, 255}, 0.95f));
  DrawRectangleLines(static_cast<int>(panelX), static_cast<int>(panelY),
                     static_cast<int>(panelWidth), static_cast<int>(panelHeight), DARKGRAY);

  Vector2 mousePos = GetMousePosition();
  float yPos = panelY + 8.0f;

  // Reset hovered part at start of frame
  uiState.hoveredPartMaterialId.clear();

  // Title with drag handle
  DrawTextEx(uiFont, "ASSEMBLY INSTRUCTIONS", {panelX + 10, yPos}, 14.0f, 0.0f, SKYBLUE);
  DrawDragHandle(uiFont, panelX, panelY, panelWidth);
  yPos += 24.0f;

  // Clamp step to valid range
  int maxStep = static_cast<int>(assembly.steps.size()) - 1;
  uiState.currentAssemblyStep = std::clamp(uiState.currentAssemblyStep, 0, maxStep);

  const AssemblyStep& currentStep = assembly.steps[uiState.currentAssemblyStep];

  // Step navigation
  float navY = yPos;
  float btnSize = 32.0f;

  // Previous button
  Rectangle prevBtn = {panelX + 10, navY, btnSize, btnSize};
  bool prevHovered = CheckCollisionPointRec(mousePos, prevBtn);
  bool canPrev = uiState.currentAssemblyStep > 0;
  DrawRectangleRec(prevBtn, canPrev ? (prevHovered ? Color{60, 70, 80, 255} : Color{40, 45, 50, 255}) : Color{30, 30, 35, 255});
  DrawTextEx(uiFont, "<", {prevBtn.x + 11, prevBtn.y + 6}, 20.0f, 0.0f, canPrev ? WHITE : GRAY);
  if (canPrev && prevHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    uiState.currentAssemblyStep--;
    stepChanged = true;
  }

  // Step indicator
  char stepText[32];
  snprintf(stepText, sizeof(stepText), "STEP %d / %zu",
           currentStep.stepNumber, assembly.steps.size());
  Vector2 stepSize = MeasureTextEx(uiFont, stepText, 16.0f, 0.0f);
  float stepX = panelX + (panelWidth - stepSize.x) / 2.0f;
  DrawTextEx(uiFont, stepText, {stepX, navY + 8}, 16.0f, 0.0f, WHITE);

  // Next button
  Rectangle nextBtn = {panelX + panelWidth - btnSize - 10, navY, btnSize, btnSize};
  bool nextHovered = CheckCollisionPointRec(mousePos, nextBtn);
  bool canNext = uiState.currentAssemblyStep < maxStep;
  DrawRectangleRec(nextBtn, canNext ? (nextHovered ? Color{60, 70, 80, 255} : Color{40, 45, 50, 255}) : Color{30, 30, 35, 255});
  DrawTextEx(uiFont, ">", {nextBtn.x + 11, nextBtn.y + 6}, 20.0f, 0.0f, canNext ? WHITE : GRAY);
  if (canNext && nextHovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
    uiState.currentAssemblyStep++;
    stepChanged = true;
  }

  yPos += btnSize + 10.0f;

  // Step title (wrapped)
  float titleHeight = drawWrappedText(uiFont, currentStep.title, panelX + 10, yPos, 18.0f, contentWidth, 2.0f, ORANGE);
  yPos += titleHeight + 4.0f;

  // Description (wrapped)
  if (!currentStep.description.empty()) {
    float descHeight = drawWrappedText(uiFont, currentStep.description, panelX + 10, yPos, 12.0f, contentWidth, 2.0f, LIGHTGRAY);
    yPos += descHeight + 4.0f;
  }

  // Time estimate
  if (currentStep.totalTimeMinutes > 0) {
    char timeText[32];
    if (currentStep.totalTimeMinutes >= 60) {
      snprintf(timeText, sizeof(timeText), "Estimated time: %dh %dm",
               currentStep.totalTimeMinutes / 60, currentStep.totalTimeMinutes % 60);
    } else {
      snprintf(timeText, sizeof(timeText), "Estimated time: %d min", currentStep.totalTimeMinutes);
    }
    DrawTextEx(uiFont, timeText, {panelX + 10, yPos}, 11.0f, 0.0f, SKYBLUE);
    yPos += 16.0f;
  }

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos + 3),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos + 3), GRAY);
  yPos += 12.0f;

  // Sub-steps (detailed instructions) with text wrapping
  if (!currentStep.subSteps.empty()) {
    DrawTextEx(uiFont, "INSTRUCTIONS:", {panelX + 10, yPos}, 12.0f, 0.0f, Color{120, 120, 130, 255});
    yPos += 16.0f;

    for (size_t i = 0; i < currentStep.subSteps.size(); ++i) {
      const auto& subStep = currentStep.subSteps[i];

      // Step number
      char numStr[8];
      snprintf(numStr, sizeof(numStr), "%zu.", i + 1);
      DrawTextEx(uiFont, numStr, {panelX + 12, yPos}, 11.0f, 0.0f, SKYBLUE);

      // Instruction text (wrapped)
      float instrHeight = drawWrappedText(uiFont, subStep.instruction, panelX + 32, yPos, 11.0f, contentWidth - 25.0f, 1.0f, WHITE);
      yPos += instrHeight;

      // Show tip if present (wrapped)
      if (!subStep.tip.empty()) {
        std::string tipText = "TIP: " + subStep.tip;
        float tipHeight = drawWrappedText(uiFont, tipText, panelX + 32, yPos, 10.0f, contentWidth - 25.0f, 1.0f, YELLOW);
        yPos += tipHeight;
      }

      yPos += 2.0f;  // Small gap between steps
    }

    DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos + 3),
             static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos + 3), GRAY);
    yPos += 12.0f;
  }

  // Parts list with interactive/hoverable items
  if (!currentStep.parts.empty()) {
    DrawTextEx(uiFont, "PARTS & MATERIALS:", {panelX + 10, yPos}, 12.0f, 0.0f, Color{120, 120, 130, 255});
    yPos += 16.0f;

    for (size_t i = 0; i < currentStep.parts.size(); ++i) {
      const auto& part = currentStep.parts[i];

      // Calculate row bounds for hover detection
      float rowHeight = 18.0f;
      Rectangle rowRect = {panelX + 10, yPos, contentWidth, rowHeight};
      bool isHovered = CheckCollisionPointRec(mousePos, rowRect);

      // Track hovered material for cross-highlighting
      if (isHovered && !part.materialId.empty()) {
        uiState.hoveredPartMaterialId = part.materialId;
      }

      // Check if this part's material is being hovered (from materials panel or 3D)
      bool isCrossHighlighted = !part.materialId.empty() &&
                                (part.materialId == uiState.hoveredMaterialId ||
                                 part.materialId == uiState.selectedMaterialId);

      // Background highlight on hover or cross-highlight
      if (isHovered || isCrossHighlighted) {
        Color highlightColor = isCrossHighlighted ? Fade(ORANGE, 0.2f) : Fade(SKYBLUE, 0.15f);
        DrawRectangleRec(rowRect, highlightColor);
      }

      // Part name with underline (indicating it's interactive)
      Color nameColor = isHovered ? SKYBLUE : (isCrossHighlighted ? ORANGE : WHITE);
      std::string displayName = part.name;
      Vector2 nameSize = MeasureTextEx(uiFont, displayName.c_str(), 11.0f, 0.0f);
      DrawTextEx(uiFont, displayName.c_str(), {panelX + 15, yPos + 2}, 11.0f, 0.0f, nameColor);

      // Underline for interactive parts (those with materialId)
      if (!part.materialId.empty()) {
        DrawLine(static_cast<int>(panelX + 15), static_cast<int>(yPos + 14),
                 static_cast<int>(panelX + 15 + nameSize.x), static_cast<int>(yPos + 14),
                 Fade(nameColor, 0.5f));
      }

      // Quantity on the right
      std::string qtyStr = "x" + part.quantity;
      if (!part.note.empty()) {
        qtyStr += " (" + part.note + ")";
      }
      Vector2 qtySize = MeasureTextEx(uiFont, qtyStr.c_str(), 10.0f, 0.0f);
      DrawTextEx(uiFont, qtyStr.c_str(), {panelX + panelWidth - qtySize.x - 15, yPos + 3}, 10.0f, 0.0f, GRAY);

      // Handle click to select material
      if (isHovered && !part.materialId.empty() && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        if (uiState.selectedMaterialId == part.materialId) {
          uiState.selectedMaterialId.clear();
        } else {
          uiState.selectedMaterialId = part.materialId;
        }
      }

      yPos += rowHeight;
    }
    yPos += 8.0f;
  }

  // Progress section
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), GRAY);
  yPos += 10.0f;

  // Progress info
  char progressText[64];
  snprintf(progressText, sizeof(progressText), "%zu new components | %zu total visible",
           currentStep.newObjectIndices.size(), currentStep.objectIndices.size());
  DrawTextEx(uiFont, progressText, {panelX + 10, yPos}, 10.0f, 0.0f, Color{100, 100, 110, 255});
  yPos += 16.0f;

  // Progress bar
  float progressWidth = panelWidth - 20.0f;
  float progress = static_cast<float>(uiState.currentAssemblyStep + 1) / static_cast<float>(assembly.steps.size());
  DrawRectangle(static_cast<int>(panelX + 10), static_cast<int>(yPos),
                static_cast<int>(progressWidth), 6, Color{40, 45, 50, 255});
  DrawRectangle(static_cast<int>(panelX + 10), static_cast<int>(yPos),
                static_cast<int>(progressWidth * progress), 6, SKYBLUE);

  // Keyboard hint at bottom
  DrawTextEx(uiFont, "[A] Toggle  [</>] Navigate  Click parts to highlight",
             {panelX + 10, panelY + panelHeight - 18}, 9.0f, 0.0f, GRAY);

  return stepChanged;
}

bool DrawLightingPanel(UIState& uiState,
                       std::vector<Spotlight>& spotlights,
                       const Font& uiFont,
                       int screenWidth, int screenHeight) {
  bool settingsChanged = false;
  LightingSettings& settings = uiState.lightingSettings;

  const float panelWidth = 280.0f;
  const float panelHeight = 580.0f;

  // Initialize default position if not set
  if (!uiState.lightingPos.initialized) {
    uiState.lightingPos.x = static_cast<float>(screenWidth) - panelWidth - 10.0f;
    uiState.lightingPos.y = kToolbarHeight + 200.0f;
    uiState.lightingPos.initialized = true;
  }

  float panelX = uiState.lightingPos.x;
  float panelY = uiState.lightingPos.y;

  // Handle dragging
  HandlePanelDrag(uiState, 5, uiState.lightingPos, panelX, panelY, panelWidth, 28.0f);
  panelX = uiState.lightingPos.x;
  panelY = uiState.lightingPos.y;
  const float sliderWidth = panelWidth - 100.0f;

  // Panel background
  DrawRectangle(static_cast<int>(panelX), static_cast<int>(panelY),
                static_cast<int>(panelWidth), static_cast<int>(panelHeight),
                Fade(Color{25, 28, 35, 255}, 0.95f));
  DrawRectangleLines(static_cast<int>(panelX), static_cast<int>(panelY),
                     static_cast<int>(panelWidth), static_cast<int>(panelHeight), Color{60, 60, 70, 255});

  float yPos = panelY + 10.0f;

  // Title with drag handle
  DrawTextEx(uiFont, "LIGHTING", {panelX + 10, yPos}, 14.0f, 0.0f, WHITE);
  DrawDragHandle(uiFont, panelX, panelY, panelWidth);
  yPos += 24.0f;

  // === RENDER MODE ===
  DrawTextEx(uiFont, "RENDER MODE", {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);
  yPos += 14.0f;

  // PBR / Toon toggle buttons
  float btnWidth = 60.0f;
  float btnHeight = 20.0f;
  Rectangle pbrBtn = {panelX + 10, yPos, btnWidth, btnHeight};
  Rectangle toonBtn = {panelX + 75, yPos, btnWidth, btnHeight};

  bool pbrHovered = CheckCollisionPointRec(GetMousePosition(), pbrBtn);
  bool toonHovered = CheckCollisionPointRec(GetMousePosition(), toonBtn);

  Color pbrColor = settings.pbrModeEnabled ? Color{60, 120, 180, 255} : (pbrHovered ? Color{50, 55, 65, 255} : Color{40, 45, 55, 255});
  Color toonColor = !settings.pbrModeEnabled ? Color{180, 100, 60, 255} : (toonHovered ? Color{50, 55, 65, 255} : Color{40, 45, 55, 255});

  DrawRectangleRec(pbrBtn, pbrColor);
  DrawRectangleRec(toonBtn, toonColor);
  DrawTextEx(uiFont, "PBR", {panelX + 27, yPos + 5}, 11.0f, 0.0f, settings.pbrModeEnabled ? WHITE : LIGHTGRAY);
  DrawTextEx(uiFont, "Toon", {panelX + 90, yPos + 5}, 11.0f, 0.0f, !settings.pbrModeEnabled ? WHITE : LIGHTGRAY);

  if (pbrHovered && IsMouseButtonPressed(MOUSE_LEFT_BUTTON) && !settings.pbrModeEnabled) {
    settings.pbrModeEnabled = true;
    settingsChanged = true;
  }
  if (toonHovered && IsMouseButtonPressed(MOUSE_LEFT_BUTTON) && settings.pbrModeEnabled) {
    settings.pbrModeEnabled = false;
    settingsChanged = true;
  }
  yPos += 30.0f;

  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), Color{50, 50, 60, 255});
  yPos += 8.0f;

  // === AMBIENT LIGHT ===
  DrawTextEx(uiFont, "AMBIENT", {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);
  yPos += 14.0f;

  char label[32];
  snprintf(label, sizeof(label), "%.0f%%", settings.ambientIntensity * 100.0f);
  DrawTextEx(uiFont, label, {panelX + 10, yPos + 1}, 10.0f, 0.0f, Color{150, 170, 200, 255});
  Rectangle ambientSlider = {panelX + 55, yPos, sliderWidth, 12};
  float oldAmbient = settings.ambientIntensity;
  GuiSlider(ambientSlider, "", "", &settings.ambientIntensity, 0.0f, 1.0f);
  if (settings.ambientIntensity != oldAmbient) settingsChanged = true;
  yPos += 20.0f;

  // === SUN (MAIN LIGHT) ===
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), Color{50, 50, 60, 255});
  yPos += 8.0f;

  DrawTextEx(uiFont, "SUN (MAIN LIGHT)", {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);
  yPos += 14.0f;

  // Sun intensity
  snprintf(label, sizeof(label), "Int: %.0f%%", settings.sunIntensity * 100.0f);
  DrawTextEx(uiFont, label, {panelX + 10, yPos + 1}, 10.0f, 0.0f, Color{255, 240, 200, 255});
  Rectangle sunIntSlider = {panelX + 70, yPos, sliderWidth - 15, 12};
  float oldSunInt = settings.sunIntensity;
  GuiSlider(sunIntSlider, "", "", &settings.sunIntensity, 0.0f, 2.0f);
  if (settings.sunIntensity != oldSunInt) settingsChanged = true;
  yPos += 18.0f;

  // Sun azimuth (horizontal angle)
  snprintf(label, sizeof(label), "Az: %.0f\xc2\xb0", settings.sunAzimuth);
  DrawTextEx(uiFont, label, {panelX + 10, yPos + 1}, 10.0f, 0.0f, Color{200, 200, 150, 255});
  Rectangle azSlider = {panelX + 70, yPos, sliderWidth - 15, 12};
  float oldAz = settings.sunAzimuth;
  GuiSlider(azSlider, "", "", &settings.sunAzimuth, 0.0f, 360.0f);
  if (settings.sunAzimuth != oldAz) settingsChanged = true;
  yPos += 18.0f;

  // Sun elevation (vertical angle)
  snprintf(label, sizeof(label), "El: %.0f\xc2\xb0", settings.sunElevation);
  DrawTextEx(uiFont, label, {panelX + 10, yPos + 1}, 10.0f, 0.0f, Color{200, 200, 150, 255});
  Rectangle elSlider = {panelX + 70, yPos, sliderWidth - 15, 12};
  float oldEl = settings.sunElevation;
  GuiSlider(elSlider, "", "", &settings.sunElevation, 5.0f, 85.0f);
  if (settings.sunElevation != oldEl) settingsChanged = true;
  yPos += 22.0f;

  // === SHADOWS ===
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), Color{50, 50, 60, 255});
  yPos += 8.0f;

  DrawTextEx(uiFont, "SHADOWS", {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);
  yPos += 14.0f;

  // Shadows toggle
  Rectangle shadowBtn = {panelX + 10, yPos, 50, 18};
  bool shadowHovered = CheckCollisionPointRec(GetMousePosition(), shadowBtn);
  Color shadowColor = settings.shadowsEnabled ? Color{80, 140, 80, 255} : (shadowHovered ? Color{70, 50, 50, 255} : Color{50, 40, 40, 255});
  DrawRectangleRec(shadowBtn, shadowColor);
  DrawTextEx(uiFont, settings.shadowsEnabled ? "ON" : "OFF", {panelX + 22, yPos + 4}, 10.0f, 0.0f, WHITE);
  if (shadowHovered && IsMouseButtonPressed(MOUSE_LEFT_BUTTON)) {
    settings.shadowsEnabled = !settings.shadowsEnabled;
    settingsChanged = true;
  }

  // Shadow bias (small adjustment)
  snprintf(label, sizeof(label), "Bias: %.4f", settings.shadowBias);
  DrawTextEx(uiFont, label, {panelX + 70, yPos + 3}, 9.0f, 0.0f, Color{120, 120, 130, 255});
  yPos += 22.0f;

  // === SSAO ===
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), Color{50, 50, 60, 255});
  yPos += 8.0f;

  DrawTextEx(uiFont, "SSAO (Ambient Occlusion)", {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);
  yPos += 14.0f;

  // SSAO toggle
  Rectangle ssaoBtn = {panelX + 10, yPos, 50, 18};
  bool ssaoHovered = CheckCollisionPointRec(GetMousePosition(), ssaoBtn);
  Color ssaoColor = settings.ssaoEnabled ? Color{80, 100, 140, 255} : (ssaoHovered ? Color{50, 50, 60, 255} : Color{40, 40, 50, 255});
  DrawRectangleRec(ssaoBtn, ssaoColor);
  DrawTextEx(uiFont, settings.ssaoEnabled ? "ON" : "OFF", {panelX + 22, yPos + 4}, 10.0f, 0.0f, WHITE);
  if (ssaoHovered && IsMouseButtonPressed(MOUSE_LEFT_BUTTON)) {
    settings.ssaoEnabled = !settings.ssaoEnabled;
    settingsChanged = true;
  }
  yPos += 22.0f;

  // SSAO strength
  snprintf(label, sizeof(label), "Str: %.0f%%", settings.ssaoStrength * 100.0f);
  DrawTextEx(uiFont, label, {panelX + 10, yPos + 1}, 10.0f, 0.0f, Color{140, 160, 200, 255});
  Rectangle ssaoStrSlider = {panelX + 70, yPos, sliderWidth - 15, 12};
  float oldSSAOStr = settings.ssaoStrength;
  GuiSlider(ssaoStrSlider, "", "", &settings.ssaoStrength, 0.0f, 1.0f);
  if (settings.ssaoStrength != oldSSAOStr) settingsChanged = true;
  yPos += 22.0f;

  // === SPOTLIGHTS ===
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), Color{50, 50, 60, 255});
  yPos += 8.0f;

  char spotHeader[64];
  snprintf(spotHeader, sizeof(spotHeader), "SPOTLIGHTS (%zu/8)", spotlights.size());
  DrawTextEx(uiFont, spotHeader, {panelX + 10, yPos}, 10.0f, 0.0f, DARKGRAY);

  // Clear all button
  if (spotlights.size() > 0) {
    Rectangle clearBtn = {panelX + panelWidth - 60, yPos - 2, 50, 16};
    bool clearHovered = CheckCollisionPointRec(GetMousePosition(), clearBtn);
    DrawRectangleRec(clearBtn, clearHovered ? Color{120, 60, 60, 255} : Color{80, 50, 50, 255});
    DrawTextEx(uiFont, "Clear", {panelX + panelWidth - 52, yPos}, 9.0f, 0.0f, WHITE);
    if (clearHovered && IsMouseButtonPressed(MOUSE_LEFT_BUTTON)) {
      spotlights.clear();
      settingsChanged = true;
    }
  }
  yPos += 16.0f;

  // List spotlights with delete buttons
  for (size_t i = 0; i < spotlights.size() && i < 8; ++i) {
    Spotlight& spot = spotlights[i];
    char spotInfo[64];
    snprintf(spotInfo, sizeof(spotInfo), "%zu: (%.1f,%.1f,%.1f) I=%.0f",
             i + 1, spot.position.x, spot.position.y, spot.position.z, spot.intensity);
    DrawTextEx(uiFont, spotInfo, {panelX + 15, yPos}, 9.0f, 0.0f, Color{255, 240, 150, 255});

    // Delete button for this spotlight
    Rectangle delBtn = {panelX + panelWidth - 30, yPos - 1, 20, 14};
    bool delHovered = CheckCollisionPointRec(GetMousePosition(), delBtn);
    DrawRectangleRec(delBtn, delHovered ? Color{180, 60, 60, 255} : Color{100, 50, 50, 255});
    DrawTextEx(uiFont, "X", {panelX + panelWidth - 24, yPos}, 9.0f, 0.0f, WHITE);
    if (delHovered && IsMouseButtonPressed(MOUSE_LEFT_BUTTON)) {
      spotlights.erase(spotlights.begin() + static_cast<long>(i));
      settingsChanged = true;
      break;  // Exit loop since vector was modified
    }
    yPos += 16.0f;
  }

  if (spotlights.empty()) {
    DrawTextEx(uiFont, "Press L to place spotlight", {panelX + 15, yPos}, 9.0f, 0.0f, Color{80, 80, 90, 255});
    yPos += 14.0f;
  }

  // Keyboard hints at bottom
  yPos = panelY + panelHeight - 36.0f;
  DrawLine(static_cast<int>(panelX + 5), static_cast<int>(yPos),
           static_cast<int>(panelX + panelWidth - 5), static_cast<int>(yPos), Color{50, 50, 60, 255});
  yPos += 6.0f;
  DrawTextEx(uiFont, "[L] Place spotlight  [Shift+L] Clear", {panelX + 10, yPos}, 9.0f, 0.0f, Color{80, 80, 90, 255});
  yPos += 12.0f;
  DrawTextEx(uiFont, "[P] Toggle PBR  [F9] Debug views", {panelX + 10, yPos}, 9.0f, 0.0f, Color{80, 80, 90, 255});

  return settingsChanged;
}

bool DrawToolbar(UIState& uiState,
                 const Font& uiFont,
                 int screenWidth,
                 const std::string& statusMessage,
                 float brandWidth) {
  bool anyToggled = false;

  const float toolbarHeight = kToolbarHeight;
  const float btnH = 20.0f;
  const float gap = 2.0f;

  Vector2 mousePos = GetMousePosition();

  // Dark toolbar background
  DrawRectangle(0, 0, screenWidth, static_cast<int>(toolbarHeight), Color{20, 20, 25, 255});

  float x = brandWidth + 20.0f;
  float y = (toolbarHeight - btnH) / 2.0f;

  // Simple toggle button
  auto toggleBtn = [&](const char* label, bool& state, Color activeColor) -> bool {
    float btnW = 20.0f;
    Rectangle btn = {x, y, btnW, btnH};
    bool hovered = CheckCollisionPointRec(mousePos, btn);
    bool clicked = hovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT);

    Color bg = state ? activeColor : (hovered ? Color{45, 45, 50, 255} : Color{30, 30, 35, 255});
    DrawRectangleRec(btn, bg);

    Vector2 sz = MeasureTextEx(uiFont, label, 11.0f, 0.0f);
    DrawTextEx(uiFont, label, {x + (btnW - sz.x) / 2.0f, y + 4.0f}, 11.0f, 0.0f,
               state ? WHITE : (hovered ? LIGHTGRAY : Color{100, 100, 110, 255}));

    x += btnW + gap;
    if (clicked) { state = !state; return true; }
    return false;
  };

  // Panel toggles
  if (toggleBtn("M", uiState.showMaterialsPanel, Color{180, 100, 40, 255})) anyToggled = true;
  if (toggleBtn("T", uiState.showParametersPanel, Color{60, 120, 180, 255})) anyToggled = true;
  if (toggleBtn("H", uiState.thermalViewEnabled, Color{180, 60, 60, 255})) {
    uiState.showThermalPanel = uiState.thermalViewEnabled;
    anyToggled = true;
  }
  if (toggleBtn("S", uiState.showStructuralPanel, Color{180, 140, 40, 255})) anyToggled = true;
  if (toggleBtn("A", uiState.showAssemblyPanel, Color{100, 180, 100, 255})) anyToggled = true;
  if (toggleBtn("L", uiState.showLightingPanel, Color{255, 200, 100, 255})) anyToggled = true;

  // Separator
  x += 4.0f;
  DrawLine(static_cast<int>(x), 8, static_cast<int>(x), static_cast<int>(toolbarHeight - 8), Color{40, 40, 45, 255});
  x += 6.0f;

  // Export buttons
  auto exportBtn = [&](const char* label) -> bool {
    float btnW = 28.0f;
    Rectangle btn = {x, y, btnW, btnH};
    bool hovered = CheckCollisionPointRec(mousePos, btn);
    bool clicked = hovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT);
    DrawRectangleRec(btn, hovered ? Color{45, 45, 50, 255} : Color{30, 30, 35, 255});
    Vector2 sz = MeasureTextEx(uiFont, label, 10.0f, 0.0f);
    DrawTextEx(uiFont, label, {x + (btnW - sz.x) / 2.0f, y + 5.0f}, 10.0f, 0.0f,
               hovered ? WHITE : Color{100, 100, 110, 255});
    x += btnW + gap;
    return clicked;
  };

  if (exportBtn("STL")) uiState.stlExportClicked = true;
  if (exportBtn("IFC")) uiState.ifcExportClicked = true;
  if (exportBtn("SVG")) uiState.svgExportClicked = true;
  if (exportBtn("BOM")) uiState.bomExportClicked = true;
  if (exportBtn("IKEA")) uiState.instructionsExportClicked = true;

  // Status message on right side
  if (!statusMessage.empty()) {
    Vector2 statusSize = MeasureTextEx(uiFont, statusMessage.c_str(), 11.0f, 0.0f);
    float statusX = static_cast<float>(screenWidth) - statusSize.x - 15.0f;

    // Truncate if too long
    std::string displayStatus = statusMessage;
    float maxStatusWidth = static_cast<float>(screenWidth) - x - 30.0f;
    if (statusSize.x > maxStatusWidth && maxStatusWidth > 50.0f) {
      // Find how many chars fit
      size_t chars = static_cast<size_t>(maxStatusWidth / 7.0f);
      if (chars < statusMessage.size()) {
        displayStatus = "..." + statusMessage.substr(statusMessage.size() - chars + 3);
      }
      statusX = x + 20.0f;
    }

    // Status with subtle background
    DrawRectangle(static_cast<int>(statusX - 5), static_cast<int>(y + 2),
                  static_cast<int>(statusSize.x + 10), static_cast<int>(btnH - 4),
                  Fade(Color{40, 40, 50, 255}, 0.8f));
    DrawTextEx(uiFont, displayStatus.c_str(), {statusX, y + 5}, 11.0f, 0.0f, LIGHTGRAY);
  }

  return anyToggled;
}

}  // namespace helscoop
