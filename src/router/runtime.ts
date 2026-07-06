import type { ReactRouterType } from "#src/router/types";
import type { RouteObject } from "react-router";

let routerRuntime: ReactRouterType | null = null;
let rootRouteRuntime: RouteObject[] = [];

export function setRouterRuntime(router: ReactRouterType, rootRoute: RouteObject[]) {
	routerRuntime = router;
	rootRouteRuntime = rootRoute;
}

export function getRouterRuntime() {
	if (!routerRuntime) {
		throw new Error("Router runtime has not been initialized yet.");
	}

	return routerRuntime;
}

export function getRootRouteRuntime() {
	return rootRouteRuntime;
}
