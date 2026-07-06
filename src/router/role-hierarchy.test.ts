import { describe, expect, it } from "vitest";

import { expandRoleHierarchy, hasAnyRole } from "./role-hierarchy";

describe("role-hierarchy", () => {
	it("super admin inherits admin, annotator, trainer and reviewer", () => {
		const expanded = expandRoleHierarchy(["SUPER_ADMIN"]);
		expect(expanded).toEqual(
			expect.arrayContaining(["SUPER_ADMIN", "ADMIN", "ANNOTATOR", "DATA_TRAINER", "REVIEWER"]),
		);
	});

	it("admin can access annotator, trainer and reviewer routes", () => {
		expect(hasAnyRole(["ADMIN"], ["ANNOTATOR"])).toBe(true);
		expect(hasAnyRole(["ADMIN"], ["DATA_TRAINER"])).toBe(true);
		expect(hasAnyRole(["ADMIN"], ["REVIEWER"])).toBe(true);
	});

	it("annotator, trainer and reviewer are peer permissions", () => {
		expect(hasAnyRole(["ANNOTATOR"], ["REVIEWER"])).toBe(false);
		expect(hasAnyRole(["REVIEWER"], ["ANNOTATOR"])).toBe(false);
		expect(hasAnyRole(["ANNOTATOR"], ["DATA_TRAINER"])).toBe(false);
		expect(hasAnyRole(["DATA_TRAINER"], ["ANNOTATOR"])).toBe(false);
	});

	it("legacy admin/common aliases remain compatible", () => {
		expect(hasAnyRole(["admin"], ["ANNOTATOR"])).toBe(true);
		expect(hasAnyRole(["common"], ["REVIEWER"])).toBe(true);
	});

	it("lowercase enum-like tokens still resolve via canonical case", () => {
		expect(hasAnyRole(["super_admin"], ["reviewer"])).toBe(true);
		expect(hasAnyRole(["admin"], ["data_trainer"])).toBe(true);
	});
});
