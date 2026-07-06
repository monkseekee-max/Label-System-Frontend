import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("H-F3: unified request layer (审计整改 / 2026-06-20)", () => {
	it("frontend/src/pages/**/*.tsx 不得直接 import ky (应通过 src/utils/request 统一层)", () => {
		const pagesDir = join(__dirname, "..", "pages");
		const offenders: string[] = [];

		const walk = (dir: string) => {
			for (const name of readdirSync(dir)) {
				if (name === "node_modules" || name.startsWith(".")) continue;
				const p = join(dir, name);
				const s = statSync(p);
				if (s.isDirectory()) {
					walk(p);
				}
				else if (name.endsWith(".tsx")) {
					const text = readFileSync(p, "utf-8");
					const lines = text.split("\n");
					for (let i = 0; i < lines.length; i++) {
						const stripped = lines[i].split("//")[0];
						if (/^\s*import\s+.*\bky\b/.test(stripped) && !stripped.includes("from \"#src/utils")) {
							const rel = p.replace(join(__dirname, ".."), "src/pages");
							offenders.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
						}
					}
				}
			}
		};
		walk(pagesDir);
		expect(
			offenders,
			`${offenders.length} 个 .tsx 页面文件直接 import ky, 应改为 import { request } from "#src/utils/request":\n  ${offenders.join("\n  ")}`,
		).toEqual([]);
	});

	it("frontend/src/api/**/*.ts 不得用 raw fetch() (SSE streaming 函数除外)", () => {
		const apiDir = join(__dirname, "..", "api");
		const offenders: string[] = [];

		const walk = (dir: string) => {
			for (const name of readdirSync(dir)) {
				if (name === "node_modules" || name.startsWith(".")) continue;
				const p = join(dir, name);
				const s = statSync(p);
				if (s.isDirectory()) {
					walk(p);
				}
				else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
					const text = readFileSync(p, "utf-8");
					// 自定义 base URL 的 API 文件豁免 (factory-client / data-productivity 用
					// LLM_FACTORY_BASE / getBase() 直连 :9090, 不走 /api 代理, 共享 request 不兼容)
					if (/LLM_FACTORY_BASE|getBase\(\)/.test(text)) continue;
					const lines = text.split("\n");
					// SSE streaming 函数 (async function* stream... 或 function* stream...) 豁免:
					// ky 不支持 ReadableStream, SSE 流式必须用 raw fetch
					let inStreamingFn = false;
					for (let i = 0; i < lines.length; i++) {
						const ln = lines[i];
						if (/async\s+function\*?\s+stream\w*/.test(ln)) {
							inStreamingFn = true;
						}
						if (inStreamingFn && /^export\s+async\s+function\*?\s+\w/.test(ln) && !/stream/.test(ln)) {
							inStreamingFn = false;
						}
						const stripped = ln.split("//")[0];
						if (!inStreamingFn && /\bfetch\s*\(/.test(stripped) && !stripped.includes("import")) {
							const rel = p.replace(join(__dirname, ".."), "src/api");
							offenders.push(`${rel}:${i + 1}: ${ln.trim()}`);
						}
					}
				}
			}
		};
		walk(apiDir);
		expect(
			offenders,
			`${offenders.length} 个 api 模块用 raw fetch() (非 streaming), 应改为 request client:\n  ${offenders.join("\n  ")}`,
		).toEqual([]);
	});
});
