import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("access store", () => {
	it("imports without route initialization errors", async () => {
		await expect(import("./access")).resolves.toMatchObject({
			useAccessStore: expect.any(Function),
		});
	}, 15000);

	it("does not import router routes directly", () => {
		const source = readFileSync(resolve(process.cwd(), "src/store/access.ts"), "utf8");
		expect(source).not.toContain("from \"#src/router/routes\"");
	});
});
