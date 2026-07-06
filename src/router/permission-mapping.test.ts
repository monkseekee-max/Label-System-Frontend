import { describe, expect, it } from "vitest";

import { mapAuthIdentityToFrontendRoles } from "./permission-mapping";

describe("permission-mapping", () => {
	it("maps super admin position to super admin role", () => {
		expect(
			mapAuthIdentityToFrontendRoles({
				role: "EMPLOYEE",
				position: "SUPER_ADMIN",
			}),
		).toEqual(["SUPER_ADMIN"]);
	});

	it("maps admin position to admin role", () => {
		expect(
			mapAuthIdentityToFrontendRoles({
				role: "EMPLOYEE",
				position: "ADMIN",
			}),
		).toEqual(["ADMIN"]);
	});

	it("maps trainer position to data trainer role", () => {
		expect(
			mapAuthIdentityToFrontendRoles({
				role: "EMPLOYEE",
				position: "DATA_TRAINER",
			}),
		).toEqual(["DATA_TRAINER"]);
	});

	it("maps reviewer position to reviewer role", () => {
		expect(
			mapAuthIdentityToFrontendRoles({
				role: "EMPLOYEE",
				position: "REVIEWER",
			}),
		).toEqual(["REVIEWER"]);
	});

	it("maps manager role to admin role when position is missing", () => {
		expect(
			mapAuthIdentityToFrontendRoles({
				role: "MANAGER",
				position: undefined,
			}),
		).toEqual(["ADMIN"]);
	});

	it("falls back to annotator role for unknown identity", () => {
		expect(
			mapAuthIdentityToFrontendRoles({
				role: "UNKNOWN" as any,
				position: "UNKNOWN" as any,
			}),
		).toEqual(["ANNOTATOR"]);
	});
});
