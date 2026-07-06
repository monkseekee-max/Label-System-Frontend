export const FrontendRoles = {
	superAdmin: "SUPER_ADMIN",
	admin: "ADMIN",
	annotator: "ANNOTATOR",
	dataTrainer: "DATA_TRAINER",
	reviewer: "REVIEWER",
} as const;

export type FrontendRole = typeof FrontendRoles[keyof typeof FrontendRoles];

const ROLE_INHERITANCE: Record<FrontendRole, FrontendRole[]> = {
	[FrontendRoles.superAdmin]: [
		FrontendRoles.admin,
		FrontendRoles.annotator,
		FrontendRoles.dataTrainer,
		FrontendRoles.reviewer,
	],
	[FrontendRoles.admin]: [
		FrontendRoles.annotator,
		FrontendRoles.dataTrainer,
		FrontendRoles.reviewer,
	],
	[FrontendRoles.annotator]: [],
	[FrontendRoles.dataTrainer]: [],
	[FrontendRoles.reviewer]: [],
};

const ROLE_ALIASES: Record<string, FrontendRole[]> = {
	[FrontendRoles.superAdmin]: [FrontendRoles.superAdmin],
	[FrontendRoles.admin]: [FrontendRoles.admin],
	[FrontendRoles.annotator]: [FrontendRoles.annotator],
	[FrontendRoles.dataTrainer]: [FrontendRoles.dataTrainer],
	[FrontendRoles.reviewer]: [FrontendRoles.reviewer],
	// legacy aliases
	admin: [FrontendRoles.superAdmin],
	common: [FrontendRoles.annotator, FrontendRoles.reviewer],
};

function resolveRoleByAlias(role: string): FrontendRole[] | null {
	const trimmed = role.trim();
	const direct = ROLE_ALIASES[trimmed];
	if (direct?.length) {
		return direct;
	}

	const upper = ROLE_ALIASES[trimmed.toUpperCase()];
	if (upper?.length) {
		return upper;
	}

	const lower = ROLE_ALIASES[trimmed.toLowerCase()];
	if (lower?.length) {
		return lower;
	}

	return null;
}

function resolveRoleTokens(roleTokens: string[]) {
	const resolved = new Set<string>();

	roleTokens.forEach((role) => {
		const aliases = resolveRoleByAlias(role) ?? [role.trim()];
		aliases.forEach(alias => resolved.add(alias));
	});

	return [...resolved];
}

export function isKnownRole(role: string) {
	return Boolean(resolveRoleByAlias(role));
}

export function expandRoleHierarchy(roleTokens: string[]) {
	const queue = resolveRoleTokens(roleTokens);
	const expanded = new Set<string>();

	while (queue.length > 0) {
		const role = queue.shift()!;
		if (expanded.has(role)) {
			continue;
		}

		expanded.add(role);
		const inherited = ROLE_INHERITANCE[role as FrontendRole] ?? [];
		inherited.forEach((nextRole) => {
			if (!expanded.has(nextRole)) {
				queue.push(nextRole);
			}
		});
	}

	return [...expanded];
}

export function hasAnyRole(userRoles: string[], requiredRoles: string[]) {
	if (!requiredRoles.length) {
		return false;
	}

	const userRoleSet = new Set(expandRoleHierarchy(userRoles));
	const requiredRoleSet = new Set(resolveRoleTokens(requiredRoles));

	for (const role of requiredRoleSet) {
		if (userRoleSet.has(role)) {
			return true;
		}
	}

	return false;
}
