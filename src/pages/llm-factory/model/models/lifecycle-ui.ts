import type { ModelLifecycleState } from "#src/api/llm-factory";

const STATE_COLORS: Record<ModelLifecycleState, string> = {
	prod: "success",
	staging: "gold",
	training: "blue",
	superseded: "default",
	archived: "default",
	discarded: "error",
	rejected: "error",
};

const STATE_LABELS: Record<ModelLifecycleState, string> = {
	prod: "生产",
	staging: "待评测",
	training: "训练中",
	superseded: "已取代",
	archived: "已归档",
	discarded: "已废弃",
	rejected: "已拒绝",
};

export function lifecycleStateColor(state: ModelLifecycleState | string | null | undefined): string {
	if (!state)
		return "default";
	return STATE_COLORS[state as ModelLifecycleState] ?? "default";
}

export function lifecycleStateLabel(state: ModelLifecycleState | string | null | undefined): string {
	if (!state)
		return "未注册";
	return STATE_LABELS[state as ModelLifecycleState] ?? String(state);
}

export type LifecycleAction = "promote" | "archive" | "discard";

const ACTION_ALLOWED_FROM: Record<LifecycleAction, ReadonlySet<ModelLifecycleState>> = {
	promote: new Set(["staging"] as ModelLifecycleState[]),
	archive: new Set(["staging", "prod", "superseded", "rejected"] as ModelLifecycleState[]),
	discard: new Set(["training"] as ModelLifecycleState[]),
};

export function isValidLifecycleAction(
	state: ModelLifecycleState | string | null | undefined,
	action: LifecycleAction | string,
): boolean {
	if (!state)
		return false;
	const allowed = ACTION_ALLOWED_FROM[action as LifecycleAction];
	if (!allowed)
		return false;
	return allowed.has(state as ModelLifecycleState);
}
