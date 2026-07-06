import { describe, expect, it } from "vitest";

import {
	mapBackendIdentityToIamRole,
	mapFrontendUserToIamCreatePayload,
	mapIamUserToFrontendUser,
} from "./iam-user-mapping";

describe("iam-user-mapping", () => {
	it("maps active IAM admin to frontend super admin fields", () => {
		const user = mapIamUserToFrontendUser({
			id: "user-1",
			username: "admin",
			email: "admin@example.com",
			role: "admin",
			is_active: true,
			created_at: "2026-01-01T00:00:00Z",
		});

		expect(user.userId).toBe("user-1");
		expect(user.email).toBe("admin@example.com");
		expect(user.role).toBe("ENGINEER");
		expect(user.position).toBe("SUPER_ADMIN");
		expect(user.status).toBe("ENABLED");
	});

	it("maps disabled IAM reviewer to frontend reviewer fields", () => {
		const user = mapIamUserToFrontendUser({
			id: "user-2",
			username: "reviewer",
			email: "reviewer@example.com",
			role: "reviewer",
			is_active: false,
		});

		expect(user.role).toBe("ENGINEER");
		expect(user.position).toBe("REVIEWER");
		expect(user.status).toBe("DISABLED");
	});

	it("maps frontend role and position to IAM role", () => {
		expect(mapBackendIdentityToIamRole("EMPLOYEE", "REVIEWER")).toBe("reviewer");
		expect(mapBackendIdentityToIamRole("MANAGER", "ADMIN")).toBe("admin");
		expect(mapBackendIdentityToIamRole("EMPLOYEE", "ANNOTATOR")).toBe("operator");
	});

	it("builds IAM create payload from frontend form fields", () => {
		expect(mapFrontendUserToIamCreatePayload({
			username: "alice",
			email: "alice@example.com",
			password: "ChangeMe123!",
			position: "REVIEWER",
		})).toEqual({
			username: "alice",
			email: "alice@example.com",
			password: "ChangeMe123!",
			role: "reviewer",
			is_active: true,
		});
	});
});
