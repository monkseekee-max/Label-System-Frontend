import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("data-management auto-sync bug (审计整改 C5 / 2026-06-20)", () => {
	const file = resolve(__dirname, "../pages/label-system/data-management/index.tsx");
	const source = readFileSync(file, "utf-8");

	it("源码不得再次出现 syncSingleAsset(vars.name, vars.name) 这种把文件名当内容的调用", () => {
		expect(source).not.toMatch(/syncSingleAsset\(\s*vars\.name\s*,\s*vars\.name\s*\)/);
	});

	it("syncSingleAsset 的第二参数必须是 markdown 内容 (asset.normalized_markdown), 不是文件名", () => {
		// 期望形如: syncSingleAsset(<显示名>, asset.normalized_markdown)
		expect(source).toMatch(/syncSingleAsset\([^,]+,\s*asset\.normalized_markdown\)/);
	});

	it("syncSingleAsset 的 markdownFallback 参数语义不再被文件名覆盖", () => {
		// 函数定义里 markdownFallback 必须独立命名 (不能与 name 复用)
		expect(source).toMatch(/syncSingleAsset\s*=\s*async\s*\(\s*name[^)]*markdownFallback/);
	});
});
