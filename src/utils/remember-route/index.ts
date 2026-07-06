import { changePasswordPath, loginPath } from "#src/router/extra-info";

const noRememberPaths = [loginPath, changePasswordPath];

export function rememberRoute() {
	const { pathname, search } = window.location;
	if (pathname.length > 1 && !noRememberPaths.includes(pathname)) {
		return `?redirect=${pathname}${search}`;
	}
	return "";
}
