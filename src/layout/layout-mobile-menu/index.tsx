import { Scrollbar } from "#src/components/scrollbar";
import { useDeviceType } from "#src/hooks/use-device-type";
import { usePreferences } from "#src/hooks/use-preferences";
import { cn } from "#src/utils/cn";

import { theme as antdTheme, Drawer } from "antd";

import LayoutMenu from "../layout-menu";
import { useMenu } from "../layout-menu/use-menu";
import "./layout-mobile-menu.css";

export default function LayoutMobileMenu() {
	const { token: { Menu } } = antdTheme.useToken();
	const { sidebarCollapsed, setPreferences, isDark, sidebarTheme } = usePreferences();
	const { isMobile } = useDeviceType();
	const { sideNavItems, handleMenuSelect } = useMenu();
	const isFixedDarkTheme = isDark || sidebarTheme === "dark";

	return (
		isMobile
			? (
				<Drawer
					styles={{
						body: {
							backgroundColor: isFixedDarkTheme ? Menu?.darkItemBg : Menu?.itemBg,
						},
					}}
					open={sidebarCollapsed}
					placement="left"
					width="clamp(200px, 50vw, 210px)"
					className={cn("mobile-menu-drawer")}
					onClose={() => setPreferences("sidebarCollapsed", false)}
				>
					<Scrollbar>
						<LayoutMenu
							autoExpandCurrentMenu
							menus={sideNavItems}
							handleMenuSelect={handleMenuSelect}
						/>
					</Scrollbar>
				</Drawer>
			)
			: null
	);
}
