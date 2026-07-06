import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

const SAFE_SCHEMA = {
	ALLOWED_TAGS: [
		"h1", "h2", "h3", "h4", "h5", "h6",
		"p", "br", "hr",
		"strong", "em", "del", "mark", "sub", "sup",
		"ul", "ol", "li",
		"blockquote", "code", "pre",
		"a", "img",
		"table", "thead", "tbody", "tr", "th", "td",
		"details", "summary",
		"span", "div",
	],
	ALLOWED_ATTR: [
		"href", "src", "alt", "title",
		"class",
		"colspan", "rowspan",
		"target", "rel",
		"open",
	],
	ALLOW_DATA_ATTR: false,
	FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
	FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

export function renderMarkdownSafe(text: string): string {
	if (!text || !text.trim()) {
		return "";
	}
	const rawHtml = marked.parse(text, { breaks: true, gfm: true, async: false });
	return DOMPurify.sanitize(rawHtml, SAFE_SCHEMA);
}
