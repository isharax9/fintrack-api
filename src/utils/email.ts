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

// ─── 6. Payday / Incoming Salary Reminder ──────────────────────────────────────
export type PaydayReminderPayload = {
  to: string;
  userName: string;
  expectedSalary: number;
  currentCash: number;
  billsBeforeSalary: number;
  safeToSpend: number;
  safeDailySpending: number;
  daysUntilPayday: number;
  currency?: string;
  isPaydayToday: boolean;
};

export const sendPaydayReminderEmail = async (payload: PaydayReminderPayload) => {
  const {
    to,
    userName,
    expectedSalary,
    currentCash,
    billsBeforeSalary,
    safeToSpend,
    safeDailySpending,
    daysUntilPayday,
    currency = 'USD',
    isPaydayToday,
  } = payload;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const headline = isPaydayToday
    ? `🎉 Payday is here!`
    : `⏳ Payday is arriving in ${daysUntilPayday} ${daysUntilPayday === 1 ? 'day' : 'days'}`;

  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 20px; font-weight: 700; margin: 0 0 6px;">
      ${headline}
    </p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Hi ${userName}, here is your cash-flow and payday planning overview.</p>

    <div style="background: ${BG_DARK}; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #1E293B;">
      <div style="margin-bottom: 16px;">
        <span style="color: ${TEXT_MUTED}; font-size: 13px;">Expected Salary / Income</span>
        <div style="color: #4ADE80; font-size: 28px; font-weight: 800; font-family: monospace;">
          ${fmt(expectedSalary)}
        </div>
      </div>

      <div style="border-top: 1px solid #1E293B; padding-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <span style="color: ${TEXT_MUTED}; font-size: 12px;">Current Cash</span>
          <div style="color: #E2E8F0; font-weight: 700; font-family: monospace;">${fmt(currentCash)}</div>
        </div>
        <div>
          <span style="color: ${TEXT_MUTED}; font-size: 12px;">Upcoming Bills</span>
          <div style="color: #F87171; font-weight: 700; font-family: monospace;">− ${fmt(billsBeforeSalary)}</div>
        </div>
      </div>

      <div style="border-top: 1px solid #1E293B; margin-top: 14px; padding-top: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="color: ${TEXT_MUTED}; font-size: 13px; font-weight: 600;">Safe to Spend:</span>
          <span style="color: ${BRAND_COLOR}; font-size: 20px; font-weight: 800; font-family: monospace;">${fmt(safeToSpend)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
          <span style="color: ${TEXT_MUTED}; font-size: 12px;">Safe daily rate:</span>
          <span style="color: #E2E8F0; font-size: 13px; font-weight: 600; font-family: monospace;">${fmt(safeDailySpending)}/day</span>
        </div>
      </div>
    </div>

    <a href="${env.FRONTEND_URL}/budget-goals"
       style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none;
              padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-right: 12px;">
      Fill Your Envelopes →
    </a>
    <a href="${env.FRONTEND_URL}/dashboard"
       style="display: inline-block; background: #1E293B; color: #E2E8F0; text-decoration: none;
              padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Dashboard
    </a>
  `);

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: isPaydayToday
      ? `🎉 Payday is here! Expected: ${fmt(expectedSalary)} — ${env.APP_NAME}`
      : `⏳ Payday in ${daysUntilPayday} days — ${env.APP_NAME}`,
    text: `${headline}\nExpected: ${fmt(expectedSalary)}\nSafe to Spend: ${fmt(safeToSpend)} (${fmt(safeDailySpending)}/day).`,
    html,
  });
};

// ─── 7. Friday Weekend Safe-to-Spend Digest ────────────────────────────────────
export type WeekendDigestPayload = {
  to: string;
  userName: string;
  safeToSpend: number;
  safeDailySpending: number;
  daysUntilPayday: number;
  upcomingBillsCount: number;
  upcomingBillsAmount: number;
  currency?: string;
};

export const sendWeekendSafeToSpendDigestEmail = async (payload: WeekendDigestPayload) => {
  const {
    to,
    userName,
    safeToSpend,
    safeDailySpending,
    daysUntilPayday,
    upcomingBillsCount,
    upcomingBillsAmount,
    currency = 'USD',
  } = payload;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 20px; font-weight: 700; margin: 0 0 6px;">
      ⚡ Can I Spend This Weekend?
    </p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Hi ${userName}, here is your weekend Safe-to-Spend check.</p>

    <div style="background: ${BG_DARK}; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #1E293B; text-align: center;">
      <span style="color: ${TEXT_MUTED}; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Current Safe to Spend</span>
      <div style="color: ${BRAND_COLOR}; font-size: 34px; font-weight: 800; font-family: monospace; margin: 6px 0;">
        ${fmt(safeToSpend)}
      </div>
      <p style="color: #E2E8F0; font-size: 14px; margin: 0;">
        Safe daily spending allowance: <strong style="color: #4ADE80; font-family: monospace;">${fmt(safeDailySpending)}/day</strong>
      </p>
      <p style="color: ${TEXT_MUTED}; font-size: 12px; margin: 8px 0 0;">
        ${daysUntilPayday} days until your next salary cycle
      </p>
    </div>

    ${
      upcomingBillsCount > 0
        ? `
      <p style="color: ${TEXT_MUTED}; font-size: 13px; margin: 0 0 16px;">
        💡 Remember: You have <strong style="color: #E2E8F0;">${upcomingBillsCount} upcoming bill${upcomingBillsCount === 1 ? '' : 's'}</strong> totaling <strong style="color: #F87171;">${fmt(upcomingBillsAmount)}</strong> scheduled before next payday.
      </p>
    `
        : ''
    }

    <a href="${env.FRONTEND_URL}/dashboard"
       style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none;
              padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Open FinTrack Simulator →
    </a>
  `);

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: `⚡ Weekend Safe-to-Spend: ${fmt(safeToSpend)} available — ${env.APP_NAME}`,
    text: `Weekend Safe-to-Spend: ${fmt(safeToSpend)} (${fmt(safeDailySpending)}/day) with ${daysUntilPayday} days until payday.`,
    html,
  });
};

// ─── 8. 1-Click Quick Snapshot Email (On Demand) ──────────────────────────────
export type QuickSnapshotPayload = {
  to: string;
  userName: string;
  currentCash: number;
  billsBeforeSalary: number;
  budgetCommitments: number;
  savingsCommitment: number;
  safeToSpend: number;
  safeDailySpending: number;
  daysUntilPayday: number;
  nextPaydayDate: string;
  currency?: string;
};

export const sendQuickSnapshotEmail = async (payload: QuickSnapshotPayload) => {
  const {
    to,
    userName,
    currentCash,
    billsBeforeSalary,
    budgetCommitments,
    savingsCommitment,
    safeToSpend,
    safeDailySpending,
    daysUntilPayday,
    nextPaydayDate,
    currency = 'USD',
  } = payload;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const html = emailWrapper(`
    <p style="color: #E2E8F0; font-size: 20px; font-weight: 700; margin: 0 0 6px;">
      📋 Your Instant Financial Snapshot
    </p>
    <p style="color: ${TEXT_MUTED}; margin: 0 0 24px;">Hi ${userName}, here is your real-time financial standing on demand.</p>

    <div style="background: ${BG_DARK}; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #1E293B;">
      <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 14px;">
        <tr>
          <td style="padding: 10px 0; color: #E2E8F0;">Current Cash Available</td>
          <td style="padding: 10px 0; text-align: right; color: #4ADE80; font-weight: 700;">${fmt(currentCash)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: ${TEXT_MUTED};">− Bills Before Next Salary</td>
          <td style="padding: 10px 0; text-align: right; color: #F87171;">− ${fmt(billsBeforeSalary)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: ${TEXT_MUTED};">− Envelope Budget Commitments</td>
          <td style="padding: 10px 0; text-align: right; color: #F87171;">− ${fmt(budgetCommitments)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: ${TEXT_MUTED};">− Savings Sinking Funds</td>
          <td style="padding: 10px 0; text-align: right; color: #F87171;">− ${fmt(savingsCommitment)}</td>
        </tr>
        <tr style="border-top: 1px solid #334155;">
          <td style="padding: 14px 0 4px; color: #E2E8F0; font-weight: 700;">Safe to Spend</td>
          <td style="padding: 14px 0 4px; text-align: right; color: ${BRAND_COLOR}; font-size: 18px; font-weight: 800;">${fmt(safeToSpend)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: ${TEXT_MUTED}; font-size: 12px;">Daily Spending Allowance (${daysUntilPayday} days)</td>
          <td style="padding: 4px 0; text-align: right; color: #E2E8F0; font-weight: 600;">${fmt(safeDailySpending)}/day</td>
        </tr>
      </table>
    </div>

    <p style="color: ${TEXT_MUTED}; font-size: 13px; margin: 0 0 20px;">
      Next Payday: <strong style="color: #E2E8F0;">${nextPaydayDate.slice(0, 10)}</strong> (${daysUntilPayday} days remaining)
    </p>

    <a href="${env.FRONTEND_URL}/dashboard"
       style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none;
              padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Open FinTrack Dashboard →
    </a>
  `);

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: `📋 Financial Snapshot: ${fmt(safeToSpend)} Safe to Spend — ${env.APP_NAME}`,
    text: `Safe to Spend: ${fmt(safeToSpend)}\nSafe Daily: ${fmt(safeDailySpending)}/day\nCash: ${fmt(currentCash)}\nBills: -${fmt(billsBeforeSalary)}\nNext Payday: ${nextPaydayDate.slice(0, 10)}.`,
    html,
  });
};

