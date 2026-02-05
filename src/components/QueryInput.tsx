"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "use-debounce";

export default function QueryInput({
  param,
  placeholder,
}: {
  param: string;
  placeholder?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleChange = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(param, value);
      params.delete("page");
    } else {
      params.delete(param);
      params.delete("page");
    }
    router.replace(`?${params.toString()}`);
  }, 300);

  return (
    <Input
      placeholder={placeholder}
      onChange={(e) => handleChange(e.target.value)}
      defaultValue={searchParams.get(param) || ""}
    />
  );
}
