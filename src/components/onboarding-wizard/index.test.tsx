import { usePreferencesStore } from "#src/store/preferences";
import { fireEvent, render, screen } from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OnboardingWizard } from "./index";

describe("onboardingWizard", () => {
	beforeEach(() => {
		usePreferencesStore.setState({ onboardingCompleted: false });
	});

	afterEach(() => {
		usePreferencesStore.setState({ onboardingCompleted: true });
	});

	it("renders nothing when onboarding is already completed", () => {
		usePreferencesStore.setState({ onboardingCompleted: true });
		const { container } = render(<OnboardingWizard />);
		expect(container.textContent).toBe("");
	});

	it("renders the first step when onboarding is not completed", () => {
		render(<OnboardingWizard />);
		expect(screen.getByText("欢迎使用标注系统")).toBeInTheDocument();
		expect(screen.getByText("下一步")).toBeInTheDocument();
	});

	it("advances through steps via the next button", () => {
		render(<OnboardingWizard />);
		fireEvent.click(screen.getByText("下一步"));
		expect(screen.getByText("四步闭环")).toBeInTheDocument();
		fireEvent.click(screen.getByText("下一步"));
		expect(screen.getByText("按角色协作")).toBeInTheDocument();
		fireEvent.click(screen.getByText("下一步"));
		expect(screen.getByText("一切就绪")).toBeInTheDocument();
		expect(screen.getByText("开始使用")).toBeInTheDocument();
	});

	it("marks onboarding completed and unmounts the wizard on skip", () => {
		render(<OnboardingWizard />);
		fireEvent.click(screen.getByText("跳过引导"));
		expect(usePreferencesStore.getState().onboardingCompleted).toBe(true);
	});

	it("marks onboarding completed on finish (开始使用)", () => {
		render(<OnboardingWizard />);
		fireEvent.click(screen.getByText("下一步"));
		fireEvent.click(screen.getByText("下一步"));
		fireEvent.click(screen.getByText("下一步"));
		fireEvent.click(screen.getByText("开始使用"));
		expect(usePreferencesStore.getState().onboardingCompleted).toBe(true);
	});
});
