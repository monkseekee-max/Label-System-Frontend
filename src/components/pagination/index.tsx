import type { PaginationProps as AntPaginationProps } from "antd";
import { Pagination } from "antd";

interface SimplePaginationProps {
	total: number
	current: number
	pageSize: number
	onChange: (page: number, pageSize: number) => void
	showSizeChanger?: boolean
	showTotal?: boolean
}

export function SimplePagination({
	total,
	current,
	pageSize,
	onChange,
	showSizeChanger = true,
	showTotal = true,
}: SimplePaginationProps) {
	const paginationProps: Partial<AntPaginationProps> = {
		total,
		current,
		pageSize,
		onChange,
		showSizeChanger,
	};
	if (showTotal) {
		paginationProps.showTotal = t => `共 ${t} 条`;
	}
	return <Pagination {...paginationProps} />;
}
