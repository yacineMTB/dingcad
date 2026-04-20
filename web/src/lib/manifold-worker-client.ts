/**
 * Manifold Worker Client
 *
 * Provides the same evaluateScene() API as manifold-engine.ts but runs
 * the heavy WASM computation in a Web Worker, keeping the main thread
 * free for smooth 60fps rendering.
 *
 * Falls back to the main-thread engine if Workers are unavailable.
 */

import type { TessellatedObject, EvaluateOptions, ManifoldSceneResult } from "./manifold-engine";
import type {
  WorkerOutMessage,
  WorkerInMessage,
  SerializedMesh,
} from "./manifold-worker";

function serializedToTessellated(mesh: SerializedMesh): TessellatedObject {
  return {
    positions: mesh.positions,
    indices: mesh.indices,
    normals: mesh.normals,
    color: mesh.color,
    material: mesh.material,
    objectId: mesh.objectId,
  };
}

let workerInstance: Worker | null = null;
let workerReady = false;
let readyPromise: Promise<void> | null = null;
let readyResolve: (() => void) | null = null;
let messageId = 0;

type PendingEval = {
  resolve: (result: ManifoldSceneResult) => void;
  reject: (err: Error) => void;
  onProgress?: EvaluateOptions["onProgress"];
  /** Accumulates meshes from progress messages */
  accumulatedMeshes: TessellatedObject[];
};

const pendingEvals = new Map<number, PendingEval>();

function getWorker(): Worker | null {
  if (workerInstance) return workerInstance;

  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  try {
    // Next.js webpack worker syntax — the bundler will emit a separate chunk
    workerInstance = new Worker(
      new URL("./manifold-worker.ts", import.meta.url),
      { type: "module" },
    );

    readyPromise = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });

    workerInstance.onmessage = handleWorkerMessage;
    workerInstance.onerror = (err) => {
      console.error("[manifold-worker-client] Worker error:", err);
      // Reject all pending evaluations
      pendingEvals.forEach((pending, id) => {
        pending.reject(new Error(`Worker error: ${err.message}`));
        pendingEvals.delete(id);
      });
    };

    return workerInstance;
  } catch (err) {
    console.warn("[manifold-worker-client] Failed to create Worker, falling back to main thread:", err);
    return null;
  }
}

function handleWorkerMessage(event: MessageEvent<WorkerOutMessage>) {
  const msg = event.data;

  switch (msg.type) {
    case "ready":
      workerReady = true;
      readyResolve?.();
      break;

    case "progress": {
      const pending = pendingEvals.get(msg.id);
      if (pending?.onProgress) {
        const meshes = msg.meshes.map(serializedToTessellated);
        pending.accumulatedMeshes = meshes;
        pending.onProgress(meshes, msg.done, msg.total);
      }
      break;
    }

    case "result": {
      const pending = pendingEvals.get(msg.id);
      if (pending) {
        pendingEvals.delete(msg.id);
        const result: ManifoldSceneResult = {
          // Use accumulated meshes from progress if available, otherwise convert result meshes
          meshes: pending.accumulatedMeshes.length > 0
            ? pending.accumulatedMeshes
            : msg.result.meshes.map(serializedToTessellated),
          error: msg.result.error,
          errorLine: msg.result.errorLine,
          warnings: msg.result.warnings,
          displayScale: msg.result.displayScale,
        };
        pending.resolve(result);
      }
      break;
    }

    case "error": {
      const pending = pendingEvals.get(msg.id);
      if (pending) {
        pendingEvals.delete(msg.id);
        pending.resolve({
          meshes: [],
          error: msg.error,
          errorLine: null,
          warnings: [],
        });
      }
      break;
    }
  }
}

/**
 * Initialize the worker. Returns a promise that resolves when WASM is loaded.
 * Safe to call multiple times.
 */
export async function initWorker(): Promise<void> {
  const worker = getWorker();
  if (!worker) {
    // Fallback: init main-thread engine
    const { initManifold } = await import("./manifold-engine");
    await initManifold();
    return;
  }
  if (workerReady) return;
  await readyPromise;
}

/**
 * Evaluate a scene script in the Web Worker.
 *
 * API-compatible with manifold-engine.ts evaluateScene() so Viewport3D
 * can swap in with minimal changes.
 */
export async function evaluateSceneWorker(
  script: string,
  options?: EvaluateOptions,
): Promise<ManifoldSceneResult> {
  const worker = getWorker();

  if (!worker) {
    // Fallback to main-thread engine
    const { evaluateScene } = await import("./manifold-engine");
    return evaluateScene(script, options);
  }

  // Wait for WASM initialization
  if (!workerReady) {
    await readyPromise;
  }

  const id = ++messageId;

  return new Promise<ManifoldSceneResult>((resolve, reject) => {
    pendingEvals.set(id, {
      resolve,
      reject,
      onProgress: options?.onProgress,
      accumulatedMeshes: [],
    });

    const msg: WorkerInMessage = { type: "evaluate", id, script };
    worker.postMessage(msg);
  });
}

/**
 * Terminate the worker. Useful for cleanup.
 */
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    workerReady = false;
    readyPromise = null;
    readyResolve = null;

    // Reject any pending evaluations
    pendingEvals.forEach((pending) => {
      pending.reject(new Error("Worker terminated"));
    });
    pendingEvals.clear();
  }
}
