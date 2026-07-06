import type { UserInfoType } from "#src/api/user/types";
import { fetchUserInfo } from "#src/api/user";

import { create } from "zustand";

const initialState: UserInfoType = {
	id: "",
	avatar: "",
	username: "",
	email: "",
	phoneNumber: "",
	description: "",
	roles: [],
	companyId: undefined,
	companyCode: "",
	companyName: "",
	phone: "",
	realName: "",
	role: undefined,
	position: undefined,
	mustChangePassword: false,
	// menus: [],
};

type UserState = UserInfoType;

interface UserAction {
	getUserInfo: () => Promise<UserInfoType>
	setMustChangePassword: (value: boolean) => void
	reset: () => void
};

export const useUserStore = create<UserState & UserAction>()(

	set => ({
		...initialState,

		getUserInfo: async () => {
			const response = await fetchUserInfo();
			set({
				...response.result,
			});
			return response.result;
		},

		setMustChangePassword: (value: boolean) => {
			set({ mustChangePassword: value });
		},

		reset: () => {
			return set({
				...initialState,
			});
		},

	}),

);
