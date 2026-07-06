import type * as React from "react";

function svgIcon(path: React.ReactNode, vb = "0 0 24 24") {
	return (
		<svg
			width="22"
			height="22"
			viewBox={vb}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			{path}
		</svg>
	);
}
export function EditIcon() {
	return svgIcon(
		<>
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
		</>,
	);
}
export function DatasetIcon() {
	return svgIcon(
		<>
			<ellipse cx="12" cy="5" rx="8" ry="3" />
			<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
			<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
		</>,
	);
}
export function TrainIcon() {
	return svgIcon(
		<>
			<rect x="3" y="4" width="18" height="12" rx="2" />
			<path d="M3 10h18" />
			<circle cx="7.5" cy="20" r="1.5" />
			<circle cx="16.5" cy="20" r="1.5" />
			<path d="M6 16v2M18 16v2" />
		</>,
	);
}
export const InferIcon = () => svgIcon(<><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></>);
export function EvalIcon() {
	return svgIcon(
		<>
			<path d="M9 11l3 3L22 4" />
			<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
		</>,
	);
}
export function LoopIcon() {
	return svgIcon(
		<>
			<path d="M17 2l4 4-4 4" />
			<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
			<path d="M7 22l-4-4 4-4" />
			<path d="M21 13v1a4 4 0 0 1-4 4H3" />
		</>,
	);
}
