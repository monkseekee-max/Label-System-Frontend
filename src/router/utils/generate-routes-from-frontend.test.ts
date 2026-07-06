import type { AppRouteRecordRaw } from "#src/router/types";

import { describe, expect, it } from "vitest";

import { generateRoutesByFrontend } from "./generate-routes-from-frontend";

const mockRoutes: AppRouteRecordRaw[] = [
	{
		path: "/public",
		handle: { title: "public" },
		Component: null as any,
	},
	{
		path: "/system",
		handle: { title: "system", roles: ["SUPER_ADMIN", "ADMIN"] },
		Component: null as any,
		children: [
			{
				path: "/system/user",
				handle: { title: "user", roles: ["SUPER_ADMIN", "ADMIN"] },
				Component: null as any,
			},
			{
				path: "/system/role",
				handle: { title: "role", roles: ["SUPER_ADMIN"] },
				Component: null as any,
			},
		],
	},
	{
		path: "/label-system",
		handle: { title: "label", roles: ["ANNOTATOR", "DATA_TRAINER"] },
		Component: null as any,
	},
	{
		path: "/label-intelligence",
		handle: { title: "intelligence", roles: ["REVIEWER"] },
		Component: null as any,
	},
];

function listPaths(routes: AppRouteRecordRaw[], acc: string[] = []) {
	routes.forEach((route) => {
		if (route.path) {
			acc.push(route.path);
		}
		if (route.children) {
			listPaths(route.children, acc);
		}
	});
	return acc;
}

describe("generate-routes-from-frontend", () => {
	it("allows super admin to access all protected routes", () => {
		const result = generateRoutesByFrontend(structuredClone(mockRoutes), ["SUPER_ADMIN"]);
		expect(listPaths(result)).toEqual(
			expect.arrayContaining([
				"/public",
				"/system",
				"/system/user",
				"/system/role",
				"/label-system",
				"/label-intelligence",
			]),
		);
	});

	it("allows admin to access system, label-system and label-intelligence", () => {
		const result = generateRoutesByFrontend(structuredClone(mockRoutes), ["ADMIN"]);
		const paths = listPaths(result);

		expect(paths).toEqual(
			expect.arrayContaining([
				"/public",
				"/system",
				"/system/user",
				"/label-system",
				"/label-intelligence",
			]),
		);
		expect(paths).not.toContain("/system/role");
	});

	it("allows annotator to access only label-system from protected menus", () => {
		const result = generateRoutesByFrontend(structuredClone(mockRoutes), ["ANNOTATOR"]);
		const paths = listPaths(result);

		expect(paths).toEqual(expect.arrayContaining(["/public", "/label-system"]));
		expect(paths).not.toEqual(expect.arrayContaining(["/system", "/label-intelligence"]));
	});

	it("allows data trainer to access only label-system from protected menus", () => {
		const result = generateRoutesByFrontend(structuredClone(mockRoutes), ["DATA_TRAINER"]);
		const paths = listPaths(result);

		expect(paths).toEqual(expect.arrayContaining(["/public", "/label-system"]));
		expect(paths).not.toEqual(expect.arrayContaining(["/system", "/label-intelligence"]));
	});

	it("allows reviewer to access only label-intelligence from protected menus", () => {
		const result = generateRoutesByFrontend(structuredClone(mockRoutes), ["REVIEWER"]);
		const paths = listPaths(result);

		expect(paths).toEqual(expect.arrayContaining(["/public", "/label-intelligence"]));
		expect(paths).not.toEqual(expect.arrayContaining(["/system", "/label-system"]));
	});
});
