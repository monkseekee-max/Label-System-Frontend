import type { dependencies, devDependencies } from "#package.json";

declare global {
	const __APP_INFO__: {
		pkg: {
			name: string
			version: string
			license: string
			author: string
			dependencies: typeof dependencies
			devDependencies: typeof devDependencies
		}
		lastBuildTime: string
	};

	/* Inspired by https://github.com/soybeanjs/soybean-admin/blob/v1.3.8/src/typings/global.d.ts */
	interface Window {
		/** ant design message instance */
		$message?: import("antd/es/message/interface").MessageInstance
		/** ant design modal instance */
		$modal?: Omit<import("antd/es/modal/confirm").ModalStaticFunctions, "warn">
		/** ant design notification instance */
		$notification?: import("antd/es/notification/interface").NotificationInstance
	}
}

export {};
