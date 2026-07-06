import type { InputProps } from "antd";
import { useDebounceFn } from "ahooks";
import { Input } from "antd";
import { useEffect, useState } from "react";

interface SearchInputProps extends Omit<InputProps, "onChange" | "onPressEnter"> {
	onSearch: (value: string) => void
	debounceWait?: number
	label?: string
}

export function SearchInput({
	onSearch,
	debounceWait = 300,
	label,
	placeholder = "请输入关键词搜索",
	...restProps
}: SearchInputProps) {
	const [value, setValue] = useState("");

	const { run: debouncedSearch } = useDebounceFn(
		(v: string) => onSearch(v),
		{ wait: debounceWait },
	);

	useEffect(() => {
		debouncedSearch(value);
	}, [value, debouncedSearch]);

	return (
		<Input
			aria-label={label ?? placeholder}
			placeholder={placeholder}
			value={value}
			onChange={e => setValue(e.target.value)}
			onPressEnter={e => onSearch((e.target as HTMLInputElement).value)}
			{...restProps}
		/>
	);
}
