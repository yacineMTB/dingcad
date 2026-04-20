import { Router } from "express";
import { requireAuth } from "../auth";

const router = Router();

router.use(requireAuth);

const SYSTEM_PROMPT = `You are a Helscoop scene editing assistant. You help users modify their parametric CAD scenes written in JavaScript.

Available primitives:
- box(width, height, depth) - creates a box
- cylinder(radius, height) - creates a cylinder
- sphere(radius) - creates a sphere

Transforms:
- translate(mesh, x, y, z) - moves a mesh
- rotate(mesh, rx, ry, rz) - rotates a mesh (degrees)
- scale(mesh, sx, sy, sz) - scales a mesh

Boolean operations:
- union(a, b) - combines two meshes
- subtract(a, b) - subtracts b from a
- intersect(a, b) - keeps intersection

Output:
- scene.add(mesh, { material: "name", color: [r, g, b] })

When the user asks you to modify a scene, respond with the complete updated scene script wrapped in a code block. Keep the same style and structure. Be concise in your explanation.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BomSummaryItem {
  material: string;
  qty: number;
  unit: string;
  total: number;
}

interface BuildingInfo {
  address?: string;
  type?: string;
  year_built?: number;
  area_m2?: number;
  floors?: number;
  material?: string;
  heating?: string;
}

interface ProjectInfo {
  name?: string;
  description?: string;
}

function buildContextBlock(
  currentScene: string,
  bomSummary?: BomSummaryItem[],
  buildingInfo?: BuildingInfo,
  projectInfo?: ProjectInfo,
): string {
  let context = `\n\nCurrent scene script:\n\`\`\`javascript\n${currentScene}\n\`\`\``;

  if (projectInfo?.name || projectInfo?.description) {
    context += `\n\nProject: "${projectInfo.name || "Untitled"}"`;
    if (projectInfo.description) {
      context += ` — ${projectInfo.description}`;
    }
  }

  if (buildingInfo && Object.keys(buildingInfo).length > 0) {
    const parts: string[] = [];
    if (buildingInfo.address) parts.push(`Address: ${buildingInfo.address}`);
    if (buildingInfo.type) parts.push(`Type: ${buildingInfo.type}`);
    if (buildingInfo.year_built) parts.push(`Built: ${buildingInfo.year_built}`);
    if (buildingInfo.area_m2) parts.push(`Area: ${buildingInfo.area_m2} m²`);
    if (buildingInfo.floors) parts.push(`Floors: ${buildingInfo.floors}`);
    if (buildingInfo.material) parts.push(`Material: ${buildingInfo.material}`);
    if (buildingInfo.heating) parts.push(`Heating: ${buildingInfo.heating}`);
    if (parts.length > 0) {
      context += `\n\nBuilding info:\n${parts.join(" | ")}`;
      context += `\nUse this info to give contextual renovation advice (e.g. building age affects insulation recommendations, heating type affects energy upgrade suggestions).`;
    }
  }

  if (bomSummary && bomSummary.length > 0) {
    const bomLines = bomSummary
      .slice(0, 20) // Cap at 20 items for token budget
      .map((item) => `  ${item.material}: ${item.qty} ${item.unit} = ${item.total.toFixed(2)} EUR`);
    const grandTotal = bomSummary.reduce((sum, item) => sum + item.total, 0);
    context += `\n\nCurrent BOM (${bomSummary.length} items, total ${grandTotal.toFixed(2)} EUR):\n${bomLines.join("\n")}`;
    context += `\nUse BOM data to give cost-aware suggestions. Reference actual prices when discussing additions or changes.`;
  }

  return context;
}

router.post("/", async (req, res) => {
  const {
    messages,
    currentScene,
    bomSummary,
    buildingInfo,
    projectInfo,
  }: {
    messages: ChatMessage[];
    currentScene: string;
    bomSummary?: BomSummaryItem[];
    buildingInfo?: BuildingInfo;
    projectInfo?: ProjectInfo;
  } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ error: "Messages required" });
  }

  const contextBlock = buildContextBlock(currentScene, bomSummary, buildingInfo, projectInfo);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.json({
      role: "assistant",
      content: generateLocalResponse(messages[messages.length - 1].content, currentScene),
    });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT + contextBlock,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = (await response.json()) as { content: { text: string }[] };
    res.json({
      role: "assistant",
      content: data.content[0].text,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    res.json({
      role: "assistant",
      content: generateLocalResponse(messages[messages.length - 1].content, currentScene),
    });
  }
});

function generateLocalResponse(userMessage: string, currentScene: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes("add") && lower.includes("roof")) {
    const roofCode = `\n// Roof\nconst roofLeft = translate(rotate(box(4.3, 0.1, 4.2), 0, 0, 30), -1.1, 3.5, 0);\nconst roofRight = translate(rotate(box(4.3, 0.1, 4.2), 0, 0, -30), 1.1, 3.5, 0);\nscene.add(roofLeft, { material: "roofing", color: [0.55, 0.27, 0.07] });\nscene.add(roofRight, { material: "roofing", color: [0.55, 0.27, 0.07] });`;
    return `Here's the scene with a simple A-frame roof added:\n\n\`\`\`javascript\n${currentScene}\n${roofCode}\n\`\`\`\n\nI added two angled roof panels forming an A-frame. Adjust the angles and dimensions to fit your design.`;
  }

  if (lower.includes("add") && lower.includes("door")) {
    const doorCode = `\n// Door opening\nconst doorHole = translate(box(0.9, 2.1, 0.2), 0, 1.05, 1.925);\nconst wallWithDoor = subtract(wall2, doorHole);\n// Replace wall2 in scene.add with wallWithDoor`;
    return `To add a door, you'd subtract a door-shaped box from a wall:\n\n\`\`\`javascript\n${doorCode}\n\`\`\`\n\nThis creates a 0.9m x 2.1m door opening in the front wall. You'll need to update the scene.add call to use the modified wall.`;
  }

  if (lower.includes("add") && lower.includes("window")) {
    return `To add a window, subtract a box from a wall:\n\n\`\`\`javascript\nconst windowHole = translate(box(1.0, 0.8, 0.2), 1.5, 1.5, -1.925);\nconst wallWithWindow = subtract(wall1, windowHole);\nscene.add(wallWithWindow, { material: "lumber", color: [0.85, 0.75, 0.55] });\n\`\`\`\n\nThis creates a 1m x 0.8m window opening at 1.5m height on the back wall.`;
  }

  if (lower.includes("bigger") || lower.includes("larger") || lower.includes("scale")) {
    return `To make the building larger, increase the dimensions in the box() calls. For example, change \`box(6, 0.2, 4)\` to \`box(8, 0.2, 6)\` for a wider/deeper floor, and adjust wall positions accordingly.\n\nWould you like me to generate the full updated scene with specific dimensions?`;
  }

  if (lower.includes("color") || lower.includes("colour")) {
    return `You can change colors by modifying the \`color: [r, g, b]\` values in scene.add(). Values are 0-1:\n- White: [1, 1, 1]\n- Wood: [0.85, 0.75, 0.55]\n- Red: [0.8, 0.2, 0.1]\n- Blue: [0.2, 0.4, 0.8]\n- Green: [0.2, 0.6, 0.3]\n\nWhich element would you like to recolor?`;
  }

  return `I can help you modify your scene. Try asking me to:\n- Add a roof, door, or window\n- Make the building bigger or smaller\n- Change colors or materials\n- Add new structural elements\n\nFor the best experience, set the \`ANTHROPIC_API_KEY\` environment variable to enable AI-powered responses.`;
}

export default router;
