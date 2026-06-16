import { prisma } from '../../config/db';
import { UpdateNotificationPreferencesInput, UpdateUserInput } from './user.schema';
import { badRequest, notFound } from '../../utils/errors';
import { hashPassword, comparePassword } from '../../utils/hash';


export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  if (!user) throw notFound('User not found');
  return user;
};

export const updateProfile = async (userId: string, data: UpdateUserInput) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  return user;
};

const mapNotificationPreferences = (user: {
  notifyBudgetAlerts: boolean;
  notifyMonthlyReports: boolean;
  notifyBillReminders: boolean;
}) => ({
  budgetAlerts: user.notifyBudgetAlerts,
  monthlyReports: user.notifyMonthlyReports,
  billReminders: user.notifyBillReminders,
});

export const getNotificationPreferences = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notifyBudgetAlerts: true,
      notifyMonthlyReports: true,
      notifyBillReminders: true,
    },
  });
  if (!user) throw notFound('User not found');
  return mapNotificationPreferences(user);
};

export const updateNotificationPreferences = async (
  userId: string,
  data: UpdateNotificationPreferencesInput,
) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      notifyBudgetAlerts: data.budgetAlerts,
      notifyMonthlyReports: data.monthlyReports,
      notifyBillReminders: data.billReminders,
    },
    select: {
      notifyBudgetAlerts: true,
      notifyMonthlyReports: true,
      notifyBillReminders: true,
    },
  });

  return mapNotificationPreferences(user);
};

export const deleteAccount = async (userId: string) => {
  await prisma.user.delete({
    where: { id: userId }
  });
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) throw badRequest('Incorrect current password');

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
};
