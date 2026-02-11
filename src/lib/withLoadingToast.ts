import { toast } from "sonner";

export async function withLoadingToast<T>(
  fn: () => Promise<T>,
  messages: { loading: string; success: string; error?: string }
) {
  const id = toast.loading(messages.loading);
  try {
    const res = await fn();
    toast.success(messages.success, { id });
    return res;
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof messages.error === "string"
          ? messages.error
          : "Something went wrong";
    toast.error(msg, { id });
    throw err;
  }
}

