import type { Rule } from "antd/es/form";

import { i18n } from "#src/locales";

type Validator = NonNullable<Exclude<Rule, (...args: never[]) => unknown>["validator"]>;

function validationMessage(key: string, fallback: string, options: Record<string, number> = {}) {
	const path = `form.validation.${key}`;
	if (!i18n.isInitialized) {
		return fallback;
	}

	const message = i18n.t(path, { ...options, defaultValue: fallback });
	return typeof message === "string" && message !== path ? message : fallback;
}

function isEmpty(value: unknown) {
	return value == null || value === "";
}

function reject(message: string) {
	return Promise.reject(new Error(message));
}

function validatorRule(message: string, validate: (value: unknown) => boolean): Rule {
	const validator: Validator = (_, value) => {
		if (isEmpty(value) || validate(value)) {
			return Promise.resolve();
		}

		return reject(message);
	};

	return { message, validator };
}

function toText(value: unknown) {
	return typeof value === "string" ? value : String(value);
}

export function required(message?: string): Rule {
	return { required: true, message: message ?? validationMessage("required", "必填项") };
}

export function minLength(n: number, message?: string): Rule {
	const ruleMessage = message ?? validationMessage("minLength", `至少 ${n} 个字符`, { min: n });
	return validatorRule(ruleMessage, value => toText(value).length >= n);
}

export function maxLength(n: number, message?: string): Rule {
	const ruleMessage = message ?? validationMessage("maxLength", `最多 ${n} 个字符`, { max: n });
	return validatorRule(ruleMessage, value => toText(value).length <= n);
}

export function range(min: number, max: number, message?: string): Rule {
	const ruleMessage = message ?? validationMessage("range", `请输入 ${min} 到 ${max} 之间的数值`, { min, max });
	return validatorRule(ruleMessage, (value) => {
		const numericValue = Number(value);
		return Number.isFinite(numericValue) && numericValue >= min && numericValue <= max;
	});
}

export function pattern(re: RegExp, message?: string): Rule {
	const ruleMessage = message ?? validationMessage("pattern", "格式不正确");
	return validatorRule(ruleMessage, value => re.test(toText(value)));
}

export function email(message?: string): Rule {
	const ruleMessage = message ?? validationMessage("email", "邮箱格式错误");
	return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, ruleMessage);
}

export function url(message?: string): Rule {
	const ruleMessage = message ?? validationMessage("url", "URL 格式错误");
	return validatorRule(ruleMessage, (value) => {
		try {
			const parsed = new URL(toText(value));
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		}
		catch {
			return false;
		}
	});
}

export function integer(message?: string): Rule {
	const ruleMessage = message ?? validationMessage("integer", "请输入整数");
	return validatorRule(ruleMessage, (value) => {
		if (typeof value === "number") {
			return Number.isInteger(value);
		}

		return /^-?\d+$/.test(toText(value));
	});
}

export function tokenName(message?: string): Rule {
	const ruleMessage = message ?? validationMessage("tokenName", "3 到 64 位，仅支持字母、数字、减号和下划线");
	return pattern(/^[A-Z0-9_-]{3,64}$/i, ruleMessage);
}
