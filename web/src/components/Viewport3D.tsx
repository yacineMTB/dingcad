"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { evaluateSceneWorker, initWorker } from "@/lib/manifold-worker-client";
import type { TessellatedObject, EvaluateOptions } from "@/lib/manifold-engine";
import { useTranslation } from "@/components/LocaleProvider";
import ViewportContextMenu, { type ContextMenuItem } from "@/components/ViewportContextMenu";
import ScreenshotPopover from "@/components/ScreenshotPopover";

interface Viewport3DProps {
  sceneJs: string;
  wireframe?: boolean;
  onObjectCount?: (count: number) => void;
  onError?: (error: string | null) => void;
  onErrorLine?: (line: number | null) => void;
  onWarnings?: (warnings: string[]) => void;
  captureRef?: React.MutableRefObject<(() => string | null) | null>;
  onToggleWireframe?: () => void;
  projectName?: string;
}

interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  key: string;
}

const CAMERA_PRESETS: CameraPreset[] = [
  { position: [0, 2, 8], target: [0, 1.5, 0], key: "editor.cameraFront" },
  { position: [8, 2, 0], target: [0, 1.5, 0], key: "editor.cameraSide" },
  { position: [0, 10, 0.01], target: [0, 0, 0], key: "editor.cameraTop" },
  { position: [5, 4, 5], target: [0, 1.5, 0], key: "editor.cameraIso" },
];

function disposeObject(obj: THREE.Object3D) {
  while (obj.children.length > 0) {
    const child = obj.children[0];
    disposeObject(child);
    obj.remove(child);
  }
  if (obj instanceof THREE.Mesh) {
    obj.geometry.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => m.dispose());
    } else if (obj.material) {
      obj.material.dispose();
    }
  }
}

interface MaterialPBR {
  roughness: number;
  metalness: number;
  opacity?: number;
  transparent?: boolean;
}

const MATERIAL_PBR: Record<string, MaterialPBR> = {
  galvanized_roofing: { roughness: 0.35, metalness: 0.85 },
  galvanized_flashing: { roughness: 0.3, metalness: 0.8 },
  hardware_cloth: { roughness: 0.5, metalness: 0.6, opacity: 0.7, transparent: true },
  hinges_galvanized: { roughness: 0.4, metalness: 0.75 },
  joist_hanger: { roughness: 0.45, metalness: 0.7 },
  screws_50mm: { roughness: 0.35, metalness: 0.8 },
  concrete_block: { roughness: 0.95, metalness: 0.0 },
  builders_sand: { roughness: 0.98, metalness: 0.0 },
  vapor_barrier: { roughness: 0.2, metalness: 0.1, opacity: 0.85, transparent: true },
  insulation_100mm: { roughness: 0.9, metalness: 0.0 },
  exterior_paint_red: { roughness: 0.6, metalness: 0.02 },
  exterior_paint_yellow: { roughness: 0.6, metalness: 0.02 },
  exterior_paint_gray_door: { roughness: 0.55, metalness: 0.03 },
  exterior_paint_white: { roughness: 0.55, metalness: 0.02 },
  osb_9mm: { roughness: 0.85, metalness: 0.0 },
  osb_18mm: { roughness: 0.85, metalness: 0.0 },
  door_thermal_bridge: { roughness: 0.5, metalness: 0.1 },
  vent_thermal_bridge: { roughness: 0.5, metalness: 0.15 },
};

function getMaterialPBR(materialId: string): MaterialPBR {
  return MATERIAL_PBR[materialId] || { roughness: 0.7, metalness: 0.05 };
}

function addSingleTessellatedMesh(
  parent: THREE.Group,
  tess: TessellatedObject,
  wireframe: boolean
): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(tess.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(tess.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(tess.indices, 1));

  const pbr = getMaterialPBR(tess.material);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tess.color[0], tess.color[1], tess.color[2]),
    roughness: pbr.roughness,
    metalness: pbr.metalness,
    wireframe,
    ...(pbr.transparent ? { transparent: true, opacity: pbr.opacity ?? 1 } : {}),
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function addTessellatedMeshes(
  parent: THREE.Group,
  meshes: TessellatedObject[],
  wireframe: boolean
): number {
  for (const tess of meshes) {
    addSingleTessellatedMesh(parent, tess, wireframe);
  }
  return meshes.length;
}

function animateCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  toPos: [number, number, number],
  toTarget: [number, number, number],
  duration = 400
) {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(...toPos);
  const endTarget = new THREE.Vector3(...toTarget);
  const startTime = performance.now();

  function step() {
    const elapsed = performance.now() - startTime;
    const raw = Math.min(elapsed / duration, 1);
    const t = 1 - Math.pow(1 - raw, 3);

    camera.position.lerpVectors(startPos, endPos, t);
    controls.target.lerpVectors(startTarget, endTarget, t);
    controls.update();

    if (raw < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

function computePresets(bounds: { center: THREE.Vector3; size: number } | null): CameraPreset[] {
  if (!bounds) {
    return [
      { position: [0, 2, 8], target: [0, 1.5, 0], key: "editor.cameraFront" },
      { position: [8, 2, 0], target: [0, 1.5, 0], key: "editor.cameraSide" },
      { position: [0, 10, 0.01], target: [0, 0, 0], key: "editor.cameraTop" },
      { position: [5, 4, 5], target: [0, 1.5, 0], key: "editor.cameraIso" },
    ];
  }
  const { center, size } = bounds;
  const d = size * 1.2;
  const cx = center.x, cy = center.y, cz = center.z;
  return [
    { position: [cx, cy + d * 0.15, cz + d], target: [cx, cy, cz], key: "editor.cameraFront" },
    { position: [cx + d, cy + d * 0.15, cz], target: [cx, cy, cz], key: "editor.cameraSide" },
    { position: [cx, cy + d, cz + 0.01], target: [cx, cy, cz], key: "editor.cameraTop" },
    { position: [cx + d * 0.55, cy + d * 0.45, cz + d * 0.55], target: [cx, cy, cz], key: "editor.cameraIso" },
  ];
}

function CameraToolbar({
  cameraRef,
  controlsRef,
  rendererRef,
  sceneRef,
  projectName,
  sceneBoundsRef,
}: {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  sceneRef: React.RefObject<THREE.Scene | null>;
  projectName?: string;
  sceneBoundsRef: React.RefObject<{ center: THREE.Vector3; size: number } | null>;
}) {
  const { t } = useTranslation();
  const [activePreset, setActivePreset] = useState(3);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  const handlePreset = useCallback(
    (preset: CameraPreset, index: number) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      setActivePreset(index);
      const presets = computePresets(sceneBoundsRef.current);
      animateCamera(camera, controls, presets[index].position, presets[index].target);
    },
    [cameraRef, controlsRef, sceneBoundsRef]
  );

  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);

    const canvas = renderer.domElement;
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);

    const fontSize = Math.max(12, Math.round(canvas.height * 0.018));
    ctx.font = `${fontSize}px "SF Mono", "Fira Code", "Cascadia Code", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      "helscoop.fi",
      canvas.width - fontSize,
      canvas.height - fontSize * 0.6
    );

    setScreenshotDataUrl(offscreen.toDataURL("image/png"));
  }, [rendererRef, sceneRef, cameraRef]);

  return (
    <>
      <div className="viewport-cam-bar">
        {CAMERA_PRESETS.map((preset, i) => (
          <button
            key={i}
            className="viewport-cam-btn"
            data-active={i === activePreset}
            onClick={() => handlePreset(preset, i)}
            data-tooltip={t(preset.key)}
          >
            {t(preset.key)}
          </button>
        ))}
        <button
          className="viewport-cam-btn"
          data-active={screenshotDataUrl !== null}
          onClick={handleScreenshot}
          data-tooltip={`${t("editor.screenshot")} (Cmd+Shift+S)`}
          aria-label={t("editor.screenshotAriaLabel")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
      </div>
      <ScreenshotPopover
        imageDataUrl={screenshotDataUrl}
        projectName={projectName}
        onClose={() => setScreenshotDataUrl(null)}
      />
    </>
  );
}

export default function Viewport3D({
  sceneJs,
  wireframe = false,
  onObjectCount,
  onError,
  onErrorLine,
  onWarnings,
  captureRef,
  onToggleWireframe,
  projectName,
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastValidSceneRef = useRef<string>(sceneJs);
  const sceneBoundsRef = useRef<{ center: THREE.Vector3; size: number } | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [tessProgress, setTessProgress] = useState<{ done: number; total: number } | null>(null);
  const updateIdRef = useRef(0);
  const { t } = useTranslation();

  // Pre-load Manifold WASM on mount
  useEffect(() => {
    initWorker().catch(() => {});
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Sky gradient background
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#0d1117");
    gradient.addColorStop(0.25, "#151b2b");
    gradient.addColorStop(0.5, "#1c2333");
    gradient.addColorStop(0.75, "#252a35");
    gradient.addColorStop(0.9, "#2d2f38");
    gradient.addColorStop(1, "#1e1d1b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);
    const bgTexture = new THREE.CanvasTexture(canvas);
    bgTexture.magFilter = THREE.LinearFilter;
    scene.background = bgTexture;

    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);
    camera.position.set(5, 4, 5);
    camera.lookAt(0, 1.5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.5, 0);
    controls.minDistance = 2;
    controls.maxDistance = 200;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xe8e4df, 0.35);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0x7799cc, 0x3d3528, 0.45);
    scene.add(hemisphereLight);

    const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.3);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xc4d4e8, 0.3);
    fillLight.position.set(-4, 3, -2);
    scene.add(fillLight);

    const gridMinor = new THREE.GridHelper(40, 40, 0x2a2a2a, 0x2a2a2a);
    (gridMinor.material as THREE.Material).opacity = 0.12;
    (gridMinor.material as THREE.Material).transparent = true;
    scene.add(gridMinor);
    const gridMajor = new THREE.GridHelper(40, 8, 0x3a3a3a, 0x3a3a3a);
    (gridMajor.material as THREE.Material).opacity = 0.25;
    (gridMajor.material as THREE.Material).transparent = true;
    gridMajor.position.y = 0.001;
    scene.add(gridMajor);

    const axesHelper = new THREE.AxesHelper(1.5);
    axesHelper.setColors(
      new THREE.Color(0xe05555),
      new THREE.Color(0x55b855),
      new THREE.Color(0x5588dd),
    );
    (axesHelper.material as THREE.Material).transparent = true;
    (axesHelper.material as THREE.Material).opacity = 0.6;
    scene.add(axesHelper);

    scene.fog = new THREE.Fog(0x1a1d22, 30, 120);

    const groundGeom = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1f1e1c,
      roughness: 0.92,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Object group — rotated to convert Z-up (Manifold/C++ viewer) to Y-up (Three.js)
    const objectGroup = new THREE.Group();
    objectGroup.rotation.x = -Math.PI / 2;
    scene.add(objectGroup);
    objectGroupRef.current = objectGroup;

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      bgTexture.dispose();
      groundGeom.dispose();
      groundMat.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasAutoFitRef = useRef(false);

  const updateScene = useCallback(
    async (script: string, wf: boolean) => {
      const group = objectGroupRef.current;
      const parentScene = sceneRef.current;
      if (!group || !parentScene) return;

      const thisId = ++updateIdRef.current;
      setIsComputing(true);
      setTessProgress(null);

      // Yield to browser so the spinner renders before heavy WASM work
      await new Promise((r) => setTimeout(r, 0));
      if (thisId !== updateIdRef.current) { setIsComputing(false); setTessProgress(null); return; }

      // Build new meshes into a staging group — old scene stays visible
      const stagingGroup = new THREE.Group();
      stagingGroup.rotation.x = -Math.PI / 2;

      let addedCount = 0;
      const progressOptions: EvaluateOptions = {
        onProgress: (meshes, done, total) => {
          if (thisId !== updateIdRef.current) return;
          for (let i = addedCount; i < meshes.length; i++) {
            addSingleTessellatedMesh(stagingGroup, meshes[i], wf);
          }
          addedCount = meshes.length;
          onObjectCount?.(addedCount);
          setTessProgress({ done, total });
        },
      };

      const result = await evaluateSceneWorker(script, progressOptions);

      // Stale update — a newer one has started
      if (thisId !== updateIdRef.current) {
        disposeObject(stagingGroup);
        setIsComputing(false);
        setTessProgress(null);
        return;
      }

      onWarnings?.(result.warnings);

      if (result.error) {
        onError?.(result.error);
        onErrorLine?.(result.errorLine);
        disposeObject(stagingGroup);
        if (script !== lastValidSceneRef.current) {
          const fallback = await evaluateSceneWorker(lastValidSceneRef.current);
          if (thisId !== updateIdRef.current) { setIsComputing(false); setTessProgress(null); return; }
          if (!fallback.error) {
            const freshGroup = new THREE.Group();
            freshGroup.rotation.x = -Math.PI / 2;
            const count = addTessellatedMeshes(freshGroup, fallback.meshes, wf);
            // Atomic swap
            parentScene.remove(group);
            disposeObject(group);
            parentScene.add(freshGroup);
            objectGroupRef.current = freshGroup;
            onObjectCount?.(count);
          }
        }
        setIsComputing(false);
        setTessProgress(null);
        return;
      }

      // Atomic swap — remove old group, add new one in same frame
      parentScene.remove(group);
      disposeObject(group);
      parentScene.add(stagingGroup);
      objectGroupRef.current = stagingGroup;

      lastValidSceneRef.current = script;
      onError?.(null);
      onErrorLine?.(null);
      onObjectCount?.(result.meshes.length);
      setIsComputing(false);
      setTessProgress(null);

      const box = new THREE.Box3().setFromObject(stagingGroup);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const sizeVec = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
        sceneBoundsRef.current = { center: center.clone(), size: maxDim };

        if (!hasAutoFitRef.current && result.meshes.length > 10) {
          hasAutoFitRef.current = true;
          const camera = cameraRef.current;
          const controls = controlsRef.current;
          if (camera && controls) {
            const fov = camera.fov * (Math.PI / 180);
            const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.4;
            const newPos: [number, number, number] = [
              center.x + dist * 0.5,
              center.y + dist * 0.4,
              center.z + dist * 0.5,
            ];
            const newTarget: [number, number, number] = [center.x, center.y, center.z];
            animateCamera(camera, controls, newPos, newTarget, 600);
          }
        }
      }
    },
    [onObjectCount, onError, onErrorLine, onWarnings]
  );

  // Debounced scene update — 100ms for snappy param slider response
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScene(sceneJs, wireframe);
    }, 100);
    return () => clearTimeout(timer);
  }, [sceneJs, wireframe, updateScene]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    (container as HTMLDivElement & { resetCamera?: () => void }).resetCamera =
      () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (camera && controls) {
          const p = computePresets(sceneBoundsRef.current);
          animateCamera(camera, controls, p[3].position, p[3].target);
        }
      };
  }, []);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;
      renderer.render(scene, camera);
      const canvas = renderer.domElement;
      const thumbW = 320;
      const thumbH = 180;
      const offscreen = document.createElement("canvas");
      offscreen.width = thumbW;
      offscreen.height = thumbH;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(canvas, 0, 0, thumbW, thumbH);
      return offscreen.toDataURL("image/webp", 0.7);
    };
    return () => {
      captureRef.current = null;
    };
  }, [captureRef]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null);
  }, []);

  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
    const fontSize = Math.max(12, Math.round(canvas.height * 0.018));
    ctx.font = `${fontSize}px "SF Mono", "Fira Code", "Cascadia Code", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("helscoop.fi", canvas.width - fontSize, canvas.height - fontSize * 0.6);
    const link = document.createElement("a");
    link.download = "helscoop-screenshot.png";
    link.href = offscreen.toDataURL("image/png");
    link.click();
  }, []);

  const contextMenuItems: ContextMenuItem[] = [
    {
      id: "camera-front",
      label: t("editor.cameraFront"),
      icon: "M3 12h18M12 3v18",
      onClick: () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;
        const p = computePresets(sceneBoundsRef.current);
        animateCamera(camera, controls, p[0].position, p[0].target);
      },
    },
    {
      id: "camera-side",
      label: t("editor.cameraSide"),
      icon: "M12 3v18M21 12H3",
      onClick: () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;
        const p = computePresets(sceneBoundsRef.current);
        animateCamera(camera, controls, p[1].position, p[1].target);
      },
    },
    {
      id: "camera-top",
      label: t("editor.cameraTop"),
      icon: "M12 5v14M5 12h14M7.5 7.5l9 9M16.5 7.5l-9 9",
      onClick: () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;
        const p = computePresets(sceneBoundsRef.current);
        animateCamera(camera, controls, p[2].position, p[2].target);
      },
    },
    {
      id: "camera-iso",
      label: t("editor.cameraIso"),
      icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
      onClick: () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;
        const p = computePresets(sceneBoundsRef.current);
        animateCamera(camera, controls, p[3].position, p[3].target);
      },
    },
    {
      id: "wireframe",
      label: t("editor.wireframe"),
      icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
      active: wireframe,
      onClick: () => { onToggleWireframe?.(); },
    },
    {
      id: "screenshot",
      label: t("editor.screenshot"),
      icon: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      onClick: handleScreenshot,
    },
    {
      id: "reset-camera",
      label: t("editor.resetCamera"),
      icon: "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15",
      onClick: () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;
        const p = computePresets(sceneBoundsRef.current);
        animateCamera(camera, controls, p[3].position, p[3].target);
      },
    },
  ];

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 200,
        background: "var(--bg-secondary)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {isComputing && (
        <>
          <div
            className="viewport-progress-bar"
            style={{ animation: "fadeIn 0.3s ease" }}
          >
            <div
              className="viewport-progress-fill"
              style={{
                width: tessProgress && tessProgress.total > 0
                  ? `${Math.round((tessProgress.done / tessProgress.total) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <div className="viewport-computing-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            <span style={{ color: "var(--text-secondary)", fontSize: 12, fontFamily: "var(--font-sans)" }}>
              {tessProgress && tessProgress.total > 0
                ? `${Math.round((tessProgress.done / tessProgress.total) * 100)}%`
                : "Computing\u2026"}
            </span>
          </div>
        </>
      )}
      <CameraToolbar
        cameraRef={cameraRef}
        controlsRef={controlsRef}
        rendererRef={rendererRef}
        sceneRef={sceneRef}
        projectName={projectName}
        sceneBoundsRef={sceneBoundsRef}
      />
      <ViewportContextMenu
        items={contextMenuItems}
        position={contextMenuPos}
        onClose={closeContextMenu}
      />
    </div>
  );
}
