import { prisma } from "@/lib/prisma";

export async function createNotification(input: {
  userId?: string | null;
  type: string;
  message: string;
  status?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId || null,
      type: input.type,
      message: input.message,
      status: input.status || "NEW",
    },
  });
}
