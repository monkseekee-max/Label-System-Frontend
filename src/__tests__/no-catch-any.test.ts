import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("catch(err: any) elimination (审计整改 M8 / 2026-06-20)", () => {
	it("src/ 下不得再出现 catch (err: any) / catch (e: any) / catch (error: any) 模式", () => {
		const frontendRoot = join(__dirname, "..");
		const found: string[] = [];
		const walk = (dir: string) => {
			for (const name of readdirSync(dir)) {
				if (name === "node_modules" || name.startsWith(".")) continue;
				const p = join(dir, name);
				const s = statSync(p);
				if (s.isDirectory()) {
					if (name === "__tests__") continue;  // 跳过测试目录 (描述文字会自匹配)
					walk(p);
				}
				else if (/\.(ts|tsx)$/.test(name)) {
					const text = readFileSync(p, "utf-8");
					const re = /catch\s*\(\s*\w+\s*:\s*any\s*\)/g;
					for (const m of text.matchAll(re)) {
						const lineNo = text.slice(0, m.index ?? 0).split("\n").length;
						const rel = p.replace(frontendRoot + "/", "");
						found.push(`${rel}:${lineNo}: ${m[0]}`);
					}
				}
			}
		};
		walk(frontendRoot);
		expect(
			found,
			`仍有 ${found.length} 处 catch (*: any), 必须改为 catch (err: unknown) + 类型 narrow:\n  ${found.slice(0, 15).join("\n  ")}`,
		).toEqual([]);
	});
});
