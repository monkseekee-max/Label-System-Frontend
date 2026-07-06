import type { Rule } from "antd/es/form";

import { describe, expect, it } from "vitest";

import { email, integer, maxLength, minLength, pattern, range, required, tokenName, url } from ".";

type ValidatorRule = Rule & {
	validator: (rule: unknown, value: unknown) => Promise<void>;
};

function expectMessage(rule: Rule) {
	expect(rule).toEqual(expect.objectContaining({ message: expect.any(String) }));
}

function expectValidator(rule: Rule): ValidatorRule {
	expect(rule).toEqual(expect.objectContaining({ validator: expect.any(Function) }));
	return rule as ValidatorRule;
}

async function expectAccepts(rule: Rule, value: unknown) {
	await expect(expectValidator(rule).validator({}, value)).resolves.toBeUndefined();
}

async function expectRejects(rule: Rule, value: unknown) {
	await expect(expectValidator(rule).validator({}, value)).rejects.toBeInstanceOf(Error);
}

describe("validation rule factories", () => {
	it("creates a required rule", () => {
		expect(required()).toEqual({ required: true, message: expect.any(String) });
		expect(required("custom required")).toEqual({ required: true, message: "custom required" });
	});

	it("validates minimum string length", async () => {
		const rule = minLength(3);

		expectMessage(rule);
		await expectRejects(rule, "ab");
		await expectAccepts(rule, "abc");
		await expectAccepts(rule, "");
	});

	it("validates maximum string length", async () => {
		const rule = maxLength(5);

		expectMessage(rule);
		await expectRejects(rule, "abcdef");
		await expectAccepts(rule, "abcde");
		await expectAccepts(rule, undefined);
	});

	it("validates numeric ranges", async () => {
		const rule = range(1, 365);

		expectMessage(rule);
		await expectRejects(rule, 0);
		await expectRejects(rule, 366);
		await expectRejects(rule, "abc");
		await expectAccepts(rule, 1);
		await expectAccepts(rule, "365");
	});

	it("validates custom patterns", async () => {
		const rule = pattern(/^[a-z]+$/);

		expectMessage(rule);
		await expectRejects(rule, "abc1");
		await expectAccepts(rule, "abc");
	});

	it("validates email addresses", async () => {
		const rule = email();

		expectMessage(rule);
		await expectRejects(rule, "not-email");
		await expectAccepts(rule, "user@example.com");
	});

	it("validates URLs", async () => {
		const rule = url();

		expectMessage(rule);
		await expectRejects(rule, "not-a-url");
		await expectAccepts(rule, "https://example.com/path");
	});

	it("validates integers", async () => {
		const rule = integer();

		expectMessage(rule);
		await expectRejects(rule, 1.5);
		await expectRejects(rule, "2.5");
		await expectAccepts(rule, 2);
		await expectAccepts(rule, "2");
	});

	it("validates token names", async () => {
		const rule = tokenName();

		expectMessage(rule);
		await expectRejects(rule, "ab");
		await expectRejects(rule, "bad name");
		await expectRejects(rule, "a".repeat(65));
		await expectAccepts(rule, "ci-pipeline_01");
	});
});
