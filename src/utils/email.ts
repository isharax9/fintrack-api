import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);

// ─── Shared styling ────────────────────────────────────────────────────────────
const BRAND_COLOR = '#14B8A6';
const BG_DARK = '#0B1120';
const BG_CARD = '#111827';
const TEXT_MUTED = '#94A3B8';

const emailWrapper = (body: string) => `
  <div style="font-family: 'Segoe UI', sans-serif; background: ${BG_DARK}; padding: 40px 0; min-height: 100vh;">
    <div style="max-width: 560px; margin: 0 auto; background: ${BG_CARD}; border-radius: 16px; overflow: hidden; border: 1px solid #1E293B;">
      <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 24px 32px; border-bottom: 1px solid #1E293B;">
        <span style="color: ${BRAND_COLOR}; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">${env.APP_NAME}</span>
      </div>
      <div style="padding: 32px;">
        ${body}
      </div>
      <div style="padding: 20px 32px; border-top: 1px solid #1E293B; text-align: center;">
        <p style="color: ${TEXT_MUTED}; font-size: 12px; margin: 0;">
          You received this because you have notifications enabled in ${env.APP_NAME}.
          <br/>Manage preferences in your <a href="${env.FRONTEND_URL}/settings" style="color: ${BRAND_COLOR}; text-decoration: none;">account settings</a>.
        </p>
      </div>
    </div>
  </div>
`;

const pill = (text: string, bg: string, color = '#fff') =>
  `<span style="background: ${bg}; color: ${color}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">${text}</span>`;

// ─── 1. OTP / Password Reset ────────────────────────────────────────────────────
export const sendOTP = async (email: string, otp: string) => {
  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 18px; font-weight: 600; margin: 0 0 8px;">Password Reset Request</p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Your one-time password is:</p>
    <div style="font-size: 38px; font-weight: 800; letter-spacing: 12px; text-align: center;
                padding: 28px; background: ${BG_DARK}; border-radius: 12px; margin: 0 0 24px;
                color: ${BRAND_COLOR}; border: 1px solid #1E293B;">
      ${otp}
    </div>
    <p style="color: ${TEXT_MUTED}; font-size: 14px; margin: 0;">
      This code is valid for <strong style="color: #E2E8F0;">10 minutes</strong>.
      If you didn't request this, you can safely ignore this email.
    </p>
  `);

  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [email],
      subject: `Your ${env.APP_NAME} verification code`,
      text: `Your OTP for resetting the password is: ${otp}. It is valid for 10 minutes.`,
      html,
    });

    if (error) throw new Error(`Resend ${error.name}: ${error.message}`);
    console.log(`OTP email sent — id: ${data?.id}`);
    return data;
  } catch (err) {
    console.error(`Failed to send OTP email to ${email}:`, err);
    throw err;
  }
};

// ─── 2. Budget Alert ────────────────────────────────────────────────────────────
export type BudgetAlertPayload = {
  to: string;
  userName: string;
  categoryName: string;
  spentAmount: number;
  limitAmount: number;
  percent: number;
  currency?: string;
};

export const sendBudgetAlertEmail = async (payload: BudgetAlertPayload) => {
  const { to, userName, categoryName, spentAmount, limitAmount, percent, currency = 'USD' } = payload;
  const isOver = percent >= 100;
  const barColor = isOver ? '#EF4444' : percent >= 90 ? '#F97316' : '#EAB308';
  const barWidth = Math.min(percent, 100);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 18px; font-weight: 600; margin: 0 0 4px;">
      ${isOver ? '🚨 Budget Exceeded' : '⚠️ Budget Alert'}
    </p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Hi ${userName},</p>
    <div style="background: ${BG_DARK}; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #1E293B;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #E2E8F0; font-weight: 600;">${categoryName}</span>
        ${pill(`${percent}%`, isOver ? '#7F1D1D' : '#78350F', isOver ? '#FCA5A5' : '#FDE68A')}
      </div>
      <div style="background: #1E293B; border-radius: 6px; height: 8px; margin: 12px 0;">
        <div style="background: ${barColor}; height: 8px; border-radius: 6px; width: ${barWidth}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; color: ${TEXT_MUTED}; font-size: 13px;">
        <span>Spent: <strong style="color: #E2E8F0;">${fmt(spentAmount)}</strong></span>
        <span>Limit: <strong style="color: #E2E8F0;">${fmt(limitAmount)}</strong></span>
      </div>
    </div>
    <p style="color: ${TEXT_MUTED}; font-size: 14px; margin: 0 0 20px;">
      ${isOver
        ? `Your <strong style="color: #E2E8F0;">${categoryName}</strong> spending has exceeded the monthly limit by <strong style="color: #EF4444;">${fmt(spentAmount - limitAmount)}</strong>.`
        : `Your <strong style="color: #E2E8F0;">${categoryName}</strong> spending is at ${percent}% of the monthly limit.`}
    </p>
    <a href="${env.FRONTEND_URL}/budget-goals"
       style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none;
              padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Budget Goals →
    </a>
  `);

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: isOver
      ? `🚨 ${categoryName} budget exceeded — ${env.APP_NAME}`
      : `⚠️ ${categoryName} budget alert — ${env.APP_NAME}`,
    text: `${categoryName} is at ${percent}% of its monthly budget. Spent: ${fmt(spentAmount)} / Limit: ${fmt(limitAmount)}.`,
    html,
  });
};

// ─── 3. Bill / Recurring Reminder ──────────────────────────────────────────────
export type BillReminderPayload = {
  to: string;
  userName: string;
  bills: Array<{
    title: string;
    amount: number;
    dueDate: string; // ISO date string (YYYY-MM-DD)
    frequency: string;
  }>;
  currency?: string;
};

export const sendBillReminderEmail = async (payload: BillReminderPayload) => {
  const { to, userName, bills, currency = 'USD' } = payload;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const billRows = bills
    .map(
      (b) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #1E293B; color: #E2E8F0;">${b.title}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #1E293B; color: #E2E8F0; text-align: right;">
          ${fmt(b.amount)}
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #1E293B; color: ${TEXT_MUTED}; text-align: right; font-size: 13px;">
          ${b.dueDate}
        </td>
      </tr>
    `,
    )
    .join('');

  const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);

  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 18px; font-weight: 600; margin: 0 0 4px;">
      📅 Upcoming Bills Reminder
    </p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Hi ${userName}, you have ${bills.length} bill${bills.length > 1 ? 's' : ''} coming up soon.</p>
    <div style="background: ${BG_DARK}; border-radius: 12px; padding: 8px 20px; margin-bottom: 24px; border: 1px solid #1E293B;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="padding: 12px 0; text-align: left; color: ${TEXT_MUTED}; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #1E293B;">Bill</th>
            <th style="padding: 12px 0; text-align: right; color: ${TEXT_MUTED}; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #1E293B;">Amount</th>
            <th style="padding: 12px 0; text-align: right; color: ${TEXT_MUTED}; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #1E293B;">Due Date</th>
          </tr>
        </thead>
        <tbody>${billRows}</tbody>
        <tfoot>
          <tr>
            <td style="padding: 14px 0 4px; color: ${TEXT_MUTED}; font-size: 13px;">Total upcoming</td>
            <td colspan="2" style="padding: 14px 0 4px; text-align: right; color: ${BRAND_COLOR}; font-weight: 700; font-size: 16px;">${fmt(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <a href="${env.FRONTEND_URL}/recurring"
       style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none;
              padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Recurring Transactions →
    </a>
  `);

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: `📅 ${bills.length} upcoming bill${bills.length > 1 ? 's' : ''} — ${env.APP_NAME}`,
    text: bills.map((b) => `${b.title}: ${fmt(b.amount)} due ${b.dueDate}`).join('\n'),
    html,
  });
};

// ─── 4. Monthly Financial Report ───────────────────────────────────────────────
export type MonthlyReportPayload = {
  to: string;
  userName: string;
  month: string; // e.g. "September 2026"
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  topCategories: Array<{ name: string; amount: number; percent: number }>;
  currency?: string;
};

export const sendMonthlyReportEmail = async (payload: MonthlyReportPayload) => {
  const { to, userName, month, totalIncome, totalExpenses, netSavings, topCategories, currency = 'USD' } = payload;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const savingsColor = netSavings >= 0 ? BRAND_COLOR : '#EF4444';
  const savingsLabel = netSavings >= 0 ? '💚 Net Savings' : '🔴 Net Loss';

  const categoryRows = topCategories
    .slice(0, 5)
    .map(
      (c) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #1E293B; color: #E2E8F0;">${c.name}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1E293B; text-align: right;">
          <div style="background: #1E293B; border-radius: 4px; height: 6px; width: 80px; display: inline-block; vertical-align: middle; margin-right: 8px;">
            <div style="background: ${BRAND_COLOR}; height: 6px; border-radius: 4px; width: ${Math.min(c.percent, 100)}%;"></div>
          </div>
          <span style="color: ${TEXT_MUTED}; font-size: 13px;">${c.percent}%</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1E293B; text-align: right; color: #E2E8F0;">${fmt(c.amount)}</td>
      </tr>
    `,
    )
    .join('');

  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 18px; font-weight: 600; margin: 0 0 4px;">
      📊 Monthly Financial Report
    </p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Hi ${userName}, here's your financial summary for <strong style="color: #E2E8F0;">${month}</strong>.</p>

    <div style="display: grid; gap: 12px; margin-bottom: 24px;">
      <div style="background: ${BG_DARK}; border-radius: 10px; padding: 16px 20px; border: 1px solid #1E293B; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: ${TEXT_MUTED}; font-size: 13px; font-weight: 500;">💰 Total Income</span>
        <span style="color: #4ADE80; font-size: 18px; font-weight: 700;">${fmt(totalIncome)}</span>
      </div>
      <div style="background: ${BG_DARK}; border-radius: 10px; padding: 16px 20px; border: 1px solid #1E293B; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: ${TEXT_MUTED}; font-size: 13px; font-weight: 500;">💸 Total Expenses</span>
        <span style="color: #F87171; font-size: 18px; font-weight: 700;">${fmt(totalExpenses)}</span>
      </div>
      <div style="background: ${BG_DARK}; border-radius: 10px; padding: 16px 20px; border: 1px solid #1E293B; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: ${TEXT_MUTED}; font-size: 13px; font-weight: 500;">${savingsLabel}</span>
        <span style="color: ${savingsColor}; font-size: 18px; font-weight: 700;">${fmt(Math.abs(netSavings))}</span>
      </div>
    </div>

    ${
      topCategories.length > 0
        ? `
      <p style="color: #E2E8F0; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Top Spending Categories</p>
      <div style="background: ${BG_DARK}; border-radius: 12px; padding: 8px 20px; margin-bottom: 24px; border: 1px solid #1E293B;">
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>${categoryRows}</tbody>
        </table>
      </div>
    `
        : ''
    }

    <a href="${env.FRONTEND_URL}/reports"
       style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none;
              padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Full Report →
    </a>
  `);

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: `📊 Your ${month} financial report — ${env.APP_NAME}`,
    text: `${month} Summary\nIncome: ${fmt(totalIncome)}\nExpenses: ${fmt(totalExpenses)}\nNet: ${fmt(netSavings)}`,
    html,
  });
};

// ─── 5. Savings Milestone ──────────────────────────────────────────────────────
export type SavingsMilestonePayload = {
  to: string;
  userName: string;
  goalName: string;
  currentAmount: number;
  targetAmount?: number;
  milestonePercent: number;
  currency?: string;
};

export const sendSavingsMilestoneEmail = async (payload: SavingsMilestonePayload) => {
  const { to, userName, goalName, currentAmount, targetAmount, milestonePercent, currency = 'USD' } = payload;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const isComplete = milestonePercent >= 100;

  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 18px; font-weight: 600; margin: 0 0 4px;">
      ${isComplete ? '🎉 Savings Goal Achieved!' : '🎯 Savings Milestone Reached!'}
    </p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Hi ${userName},</p>
    <div style="background: ${BG_DARK}; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #1E293B; text-align: center;">
      <p style="color: ${TEXT_MUTED}; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">${goalName}</p>
      <p style="color: ${BRAND_COLOR}; font-size: 36px; font-weight: 800; margin: 0 0 4px;">${milestonePercent}%</p>
      <p style="color: ${TEXT_MUTED}; font-size: 14px; margin: 0 0 16px;">of goal reached</p>
      <div style="background: #1E293B; border-radius: 8px; height: 10px; margin-bottom: 16px;">
        <div style="background: ${BRAND_COLOR}; height: 10px; border-radius: 8px; width: ${Math.min(milestonePercent, 100)}%;"></div>
      </div>
      <p style="color: #E2E8F0; font-size: 16px; font-weight: 600; margin: 0;">
        ${fmt(currentAmount)}${targetAmount ? ` / ${fmt(targetAmount)}` : ' saved'}
      </p>
    </div>
    <a href="${env.FRONTEND_URL}/savings"
       style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none;
              padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Savings Goals →
    </a>
  `);

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: isComplete
      ? `🎉 You've reached your "${goalName}" savings goal! — ${env.APP_NAME}`
      : `🎯 ${milestonePercent}% of your "${goalName}" goal reached — ${env.APP_NAME}`,
    text: `You've saved ${fmt(currentAmount)}${targetAmount ? ` of ${fmt(targetAmount)}` : ''} toward "${goalName}" (${milestonePercent}%).`,
    html,
  });
};
