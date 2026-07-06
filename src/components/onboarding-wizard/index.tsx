import { usePreferencesStore } from "#src/store/preferences";
import { Button, Modal, Result, Steps } from "antd";

import { useState } from "react";

const ONBOARDING_STEPS = [
	{
		title: "欢迎",
		key: "welcome",
		content: {
			status: "info" as const,
			title: "欢迎使用标注系统",
			subTitle: "数据飞轮驱动的智能标注与模型训练平台。接下来用 1 分钟了解核心流程。",
		},
	},
	{
		title: "核心流程",
		key: "flow",
		content: {
			status: "info" as const,
			title: "四步闭环",
			subTitle: "① 上传资料 → ② 智能标注/人工复核 → ③ 训练流水线 → ④ 评测与对齐。审批通过的数据自动回流为下一轮训练集。",
		},
	},
	{
		title: "角色",
		key: "roles",
		content: {
			status: "info" as const,
			title: "按角色协作",
			subTitle: "标注员/训练员上传与标注，审核员审批结果，企业管理员管理人员与任务，平台管理员管理企业。菜单按你的角色自动过滤。",
		},
	},
	{
		title: "开始",
		key: "start",
		content: {
			status: "success" as const,
			title: "一切就绪",
			subTitle: "从左侧菜单进入「资料管理」上传第一批素材，或前往「任务管理」查看待办。可随时在偏好设置中重置本向导。",
		},
	},
];

export function OnboardingWizard() {
	const onboardingCompleted = usePreferencesStore(s => s.onboardingCompleted);
	const setPreferences = usePreferencesStore(s => s.setPreferences);
	const [current, setCurrent] = useState(0);

	if (onboardingCompleted) {
		return null;
	}

	const isLast = current === ONBOARDING_STEPS.length - 1;
	const step = ONBOARDING_STEPS[current];

	const finish = () => {
		setPreferences("onboardingCompleted", true);
	};

	return (
		<Modal
			open
			closable={false}
			maskClosable={false}
			footer={null}
			width={520}
			centered
			destroyOnClose
		>
			<Steps
				current={current}
				size="small"
				items={ONBOARDING_STEPS.map(s => ({ title: s.title }))}
				style={{ marginBottom: 24 }}
			/>
			<Result
				status={step.content.status}
				title={step.content.title}
				subTitle={step.content.subTitle}
				extra={[
					<Button key="skip" type="text" onClick={finish}>跳过引导</Button>,
					isLast
						? (
							<Button key="done" type="primary" onClick={finish}>
								开始使用
							</Button>
						)
						: (
							<Button key="next" type="primary" onClick={() => setCurrent(c => c + 1)}>
								下一步
							</Button>
						),
				]}
			/>
		</Modal>
	);
}
