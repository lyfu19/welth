"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const serializeTransaction = (obj) => {
  const serialized = { ...obj };

  if (obj.balance && typeof obj.balance.toNumber === 'function') {
    serialized.balance = obj.balance.toNumber();
  }

  if (obj.amount && typeof obj.amount.toNumber === 'function') {
    serialized.amount = obj.amount.toNumber();
  }

  return serialized;
}

export async function createAccount(data) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // convert balance to float before saving
    const balanceFloat = parseFloat(data.balance);
    if (isNaN(balanceFloat)) {
      throw new Error("invalid balance amount");
    }

    // check if this is the user's first account
    const existingAccounts = await db.account.findMany({
      where: { userId: user.id }
    });

    const shouldBeDefault = existingAccounts.length === 0 ? true : data.isDefault;

    // if this account should be default, unset other default accounts
    if (shouldBeDefault) {
      await db.account.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const account = await db.account.create({
      data: {
        ...data,
        balance: balanceFloat,
        userId: user.id,
        isDefault: shouldBeDefault,
      }
    });

    const serializedAccount = serializeTransaction(account);

    revalidatePath("/dashboard");

    return { success: true, data: serializedAccount };

  } catch (error) {
    throw error;
  }
}

export async function getUserAccounts() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const accounts = await db.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          transactions: true,
        }
      }
    }
  });

  const serializedAccount = accounts.map(serializeTransaction);
  return serializedAccount;
}

export async function getDashboardData() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // get all user transactions
  const transactions = await db.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  return transactions.map(serializeTransaction);
}