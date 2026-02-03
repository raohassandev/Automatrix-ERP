"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Option {
  label: string;
  value: string;
}

export default function QuerySelect({
  param,
  options,
  placeholder = "All",
  className,
}: {
  param: string;
  options: Option[];
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get(param) ?? "";

  const handleChange = (nextValue: string) => {
    const params = new URLSearchParams(searchParams);
    if (nextValue) {
      params.set(param, nextValue);
    } else {
      params.delete(param);
    }
    params.delete("page");
    router.replace(`?${params.toString()}`);
  };

  return (
    <select
      className={className || "rounded-md border px-3 py-2 text-sm"}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value || option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
