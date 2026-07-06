import type { AuthType, LoginInfo } from "#src/api/user/types";

import { fetchLogin, fetchLogout } from "#src/api/user";
import { useAccessStore } from "#src/store/access";
import { useTabsStore } from "#src/store/tabs";
import { useUserStore } from "#src/store/user";
import { getAppNamespace } from "#src/utils/get-app-namespace";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const initialState = {
	token: "",
	refreshToken: "",
};

type AuthState = AuthType;

interface AuthAction {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	login: (loginPayload: LoginInfo) => Promise<any>
	logout: () => Promise<void>
	reset: () => void
};

export const useAuthStore = create<AuthState & AuthAction>()(

	persist((set, get) => ({
		...initialState,

		login: async (loginPayload) => {
			const response = await fetchLogin(loginPayload);
			set({
				token: response.result.token,
				refreshToken: response.result.refreshToken,
			});
			useUserStore.getState().setMustChangePassword(response.result.mustChangePassword);
			return response;
		},

		logout: async () => {
			/**
			 * 1. 通知后端退出登录 (best-effort: 网络失败不应阻塞本地登出)
			 *
			 * P0-4: 历史实现 `await fetchLogout(); get().reset();` 在 fetchLogout
			 * 网络失败时抛错, reset 永不执行, 用户卡在"已点退出但实际仍登录"的诡异态.
			 * logout 是用户明确意图, 后端调用失败只记录, 不阻塞本地状态清空.
			 */
			try {
				await fetchLogout();
			}
			catch (e) {
				console.error("logout 后端调用失败, 仍执行本地登出:", e);
			}
			finally {
				/**
				 * 2. 清空 token 等其他信息 (无论后端调用成败)
				 */
				get().reset();
			}
		},

		reset: () => {
			/**
			 * 清空 token
			 */
			set({
				...initialState,
			});
			/**
			 * 清空用户信息
			 * @see {@link https://github.com/pmndrs/zustand?tab=readme-ov-file#read-from-state-in-actions | Read from state in actions}
			 */
			useUserStore.getState().reset();

			/**
			 * 清空权限信息
			 * @see https://github.com/pmndrs/zustand?tab=readme-ov-file#readingwriting-state-and-reacting-to-changes-outside-of-components
			 */
			useAccessStore.getState().reset();

			/**
			 * 清空标签页
			 */
			useTabsStore.getState().resetTabs();

			/**
			 * 清空 keepAlive 缓存
			 * 在 container-layout 组件中，根据 openTabs 自动刷新 keepAlive 缓存
			 */
		},

	}), { name: getAppNamespace("access-token") }),

);
