import { describe, expect, it } from "vitest";

import { renderMarkdownSafe } from "#src/utils/markdown";

describe("renderMarkdownSafe (审计整改 C4 / 2026-06-20)", () => {
	it("正常 markdown 渲染为 HTML 段落", () => {
		const html = renderMarkdownSafe("# 标题\n\n正文段落");
		expect(html).toContain("<h1>");
		expect(html).toContain("标题");
		expect(html).toContain("<p>");
		expect(html).toContain("正文段落");
	});

	it("剥离 <script> 标签 (XSS 防护)", () => {
		const payload = "# 标题\n\n<script>alert('xss')</script>\n\n正文";
		const html = renderMarkdownSafe(payload);
		expect(html).not.toContain("<script>");
		expect(html).not.toContain("alert");
		expect(html).toContain("正文");
	});

	it("剥离内联事件处理器 on*", () => {
		const payload = `<img src="x" onerror="alert('xss')">`;
		const html = renderMarkdownSafe(payload);
		expect(html).not.toContain("onerror");
		expect(html).not.toContain("alert");
	});

	it("剥离 javascript: URL", () => {
		const payload = `[click](javascript:alert(1))`;
		const html = renderMarkdownSafe(payload);
		expect(html).not.toContain("javascript:");
		expect(html).not.toContain("alert");
	});

	it("空串返回空串", () => {
		expect(renderMarkdownSafe("")).toBe("");
		expect(renderMarkdownSafe("   ")).toBe("");
	});

	it("保留安全的 HTML (链接 / 列表 / 代码)", () => {
		const html = renderMarkdownSafe("[example](https://example.com)\n\n- item1\n- item2\n\n`code`");
		expect(html).toContain("href=\"https://example.com\"");
		expect(html).toContain("<ul>");
		expect(html).toContain("<code>");
	});
});
