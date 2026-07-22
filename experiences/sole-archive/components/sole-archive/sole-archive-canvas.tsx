"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { SoleArchiveScene } from "@/components/sole-archive/scene-controller";
import type { ArchiveSceneState, SceneDiagnostics, SceneStatus } from "@/components/sole-archive/types";

export type SoleArchiveCanvasHandle = {
	resetView: () => void;
	focusHotspot: (position: [number, number, number]) => void;
};

type SoleArchiveCanvasProps = {
	state: ArchiveSceneState;
	onDiagnostics?: (diagnostics: SceneDiagnostics) => void;
};

export const SoleArchiveCanvas = forwardRef<SoleArchiveCanvasHandle, SoleArchiveCanvasProps>(
	function SoleArchiveCanvas({ state, onDiagnostics }, ref) {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const sceneRef = useRef<SoleArchiveScene | null>(null);
		const [status, setStatus] = useState<SceneStatus>("initializing");

		useImperativeHandle(ref, () => ({
			resetView: () => sceneRef.current?.resetView(),
			focusHotspot: (position) => sceneRef.current?.focusHotspot(position),
		}));

		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			try {
				const scene = new SoleArchiveScene({
					canvas,
					onStatus: setStatus,
					onDiagnostics: (nextDiagnostics) => {
						onDiagnostics?.(nextDiagnostics);
						(
							window as typeof window & { __SOLE_ARCHIVE_DIAGNOSTICS__?: SceneDiagnostics }
						).__SOLE_ARCHIVE_DIAGNOSTICS__ = nextDiagnostics;
					},
				});
				sceneRef.current = scene;
				return () => {
					scene.dispose();
					sceneRef.current = null;
				};
			} catch {
				const statusTimer = window.setTimeout(() => setStatus("unsupported"), 0);
				return () => window.clearTimeout(statusTimer);
			}
		}, [onDiagnostics]);

		useEffect(() => {
			sceneRef.current?.update(state);
		}, [state]);

		return (
			<div className="absolute inset-0">
				<canvas
					ref={canvasRef}
					className="h-full w-full touch-none"
					aria-label="Interactive three-dimensional sneaker inspection stage"
				/>
				<div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2" aria-live="polite">
					{status !== "ready" && (
						<p className="archive-status">
							{status === "initializing" && "Preparing archive"}
							{status === "loading-model" && "Loading release model"}
							{status === "fallback" && "Procedural inspection model active"}
							{status === "unsupported" && "WebGL is unavailable on this device"}
						</p>
					)}
				</div>
			</div>
		);
	},
);
