import PDFDocument from 'pdfkit-table';
import { prisma } from '../../config/db';

export const generateTransactionsPdf = async (userId: string) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });

  doc.fontSize(20).text('FinTrack - Transactions Report', { align: 'center' });
  doc.moveDown();

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true, account: true },
    orderBy: { date: 'desc' }
  });

  const tableFormat = {
    title: "Transactions List",
    headers: [
      { label: "Date", property: 'date', width: 100 },
      { label: "Title", property: 'title', width: 150 },
      { label: "Category", property: 'category', width: 100 },
      { label: "Amount", property: 'amount', width: 80 },
      { label: "Type", property: 'type', width: 80 }
    ],
    datas: transactions.map(t => ({
      date: t.date.toISOString().split('T')[0],
      title: t.title,
      category: t.category.name,
      amount: t.amount.toString(),
      type: t.type
    }))
  };

  await doc.table(tableFormat);
  return doc;
};

export const generateSummaryPdf = async (userId: string, month: number, year: number) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });

  doc.fontSize(20).text(`FinTrack - Summary Report (${month}/${year})`, { align: 'center' });
  doc.moveDown();

  // Basic stats
  const incomeAgg = await prisma.transaction.aggregate({
    where: { userId, type: 'INCOME' },
    _sum: { amount: true }
  });
  const expenseAgg = await prisma.transaction.aggregate({
    where: { userId, type: 'EXPENSE' },
    _sum: { amount: true }
  });

  const totalIncome = Number(incomeAgg._sum.amount || 0);
  const totalExpense = Number(expenseAgg._sum.amount || 0);

  doc.fontSize(14).text(`Total Income: $${totalIncome}`);
  doc.text(`Total Expense: $${totalExpense}`);
  doc.text(`Net Savings: $${totalIncome - totalExpense}`);
  doc.moveDown();

  // Draw a simple table of accounts
  const accounts = await prisma.account.findMany({ where: { userId }});
  
  const tableFormat = {
    title: "Accounts Overview",
    headers: [
      { label: "Account Name", property: 'name', width: 250 },
      { label: "Type", property: 'type', width: 150 },
      { label: "Balance", property: 'balance', width: 100 },
    ],
    datas: accounts.map(a => ({
      name: a.name,
      type: a.type,
      balance: a.balance.toString()
    }))
  };

  await doc.table(tableFormat);
  return doc;
};
