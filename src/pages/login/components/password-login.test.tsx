import type { LoginInfo } from "#src/api/user";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordLogin } from "./password-login";

const mockNavigate = vi.fn();
const mockLogin = vi.fn<(...args: [LoginInfo]) => Promise<void>>();
const mockFetchCompanies = vi.fn();

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("react-router", () => ({
	useNavigate: () => mockNavigate,
	useSearchParams: () => [new URLSearchParams()],
}));

vi.mock("#src/store/auth", () => ({
	useAuthStore: (selector: any) =>
		selector({
			login: mockLogin,
		}),
}));

vi.mock("#src/api/user", async () => {
	const actual = await vi.importActual("#src/api/user");
	return {
		...actual,
		fetchLoginCompanies: (...args: any[]) => mockFetchCompanies(...args),
	};
});

describe("password-login", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not query companies for invalid phone", async () => {
		render(<PasswordLogin />);

		fireEvent.change(screen.getByPlaceholderText("form.mobile.required"), {
			target: { value: "123" },
		});

		await waitFor(() => {
			expect(mockFetchCompanies).not.toHaveBeenCalled();
		});
	});

	it("queries companies automatically and hides the query button", async () => {
		mockFetchCompanies.mockResolvedValue({
			result: [
				{ companyCode: "ALPHA", companyId: 1, companyName: "Alpha Corp" },
			],
		});

		render(<PasswordLogin />);

		expect(screen.queryByRole("button", { name: "authority.queryCompanies" })).not.toBeInTheDocument();

		fireEvent.change(screen.getByPlaceholderText("form.mobile.required"), {
			target: { value: "13800000000" },
		});

		await waitFor(() => {
			expect(mockFetchCompanies).toHaveBeenCalledWith({ phone: "13800000000" });
		});

		expect(screen.getByRole("button", { name: "authority.login" })).toBeEnabled();
	});

	it("submits phone, companyCode and password", async () => {
		mockFetchCompanies.mockResolvedValue({
			result: [
				{ companyCode: "ALPHA", companyId: 1, companyName: "Alpha Corp" },
			],
		});
		mockLogin.mockResolvedValue();

		render(<PasswordLogin />);

		fireEvent.change(screen.getByPlaceholderText("form.mobile.required"), {
			target: { value: "13800000000" },
		});

		await waitFor(() => {
			expect(mockFetchCompanies).toHaveBeenCalled();
		});

		fireEvent.change(screen.getByPlaceholderText("form.password.required"), {
			target: { value: "abc12345" },
		});
		fireEvent.click(screen.getByRole("button", { name: "authority.login" }));

		await waitFor(() => {
			expect(mockLogin).toHaveBeenCalledWith({
				phone: "13800000000",
				companyCode: "ALPHA",
				password: "abc12345",
			});
		});
	});
});
