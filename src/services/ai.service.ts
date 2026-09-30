import { env } from '../config/env';

export interface GeminiParsedTransaction {
  title: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  categoryName: string;
  accountName?: string;
  date: string;
  confidence: number;
}

/**
 * Attempts to parse natural language financial input using Google Gemini.
 * Uses the free Google AI Studio API key (GEMINI_API_KEY).
 * If the key is not configured, or if the request fails (offline, rate limit, timeout),
 * it returns null so the system seamlessly falls back to the smart local algorithm.
 */
export async function parseWithGemini(
  input: string,
  categories: Array<{ id: string; name: string }>,
  accounts: Array<{ id: string; name: string; type: string }>,
  currency = 'LKR',
): Promise<GeminiParsedTransaction | null> {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const categoryNames = categories.map((c) => c.name);
  const accountNames = accounts.map((a) => a.name);

  const systemPrompt = `You are a financial transaction parser for FinTrack.
Your job is to extract structured transaction details from user messages.
Today is ${todayStr}. User's currency is ${currency}.

Available Categories: ${categoryNames.join(', ')}
Available Accounts: ${accountNames.join(', ')}

Classification Rules:
1. TYPE:
   - "INCOME" if the user received money, got a salary, gift, allowance, mom/dad gave money, client payment, dividend, or deposit.
   - "EXPENSE" if the user paid for, spent, bought, or incurred a cost.
2. TITLE:
   - Extract the clean merchant, person, or reason (e.g., "Keells Super", "Mom", "Dialog Broadband", "Uber Trip"). Avoid redundant filler words like "spent", "paid", "bought".
3. AMOUNT:
   - Numeric number only (e.g. 100, 3000, 12500). Handle "k" notation (e.g. "400k" = 400000).
4. CATEGORY:
   - Pick the single closest matching category name from the Available Categories list. If income from a person/family, pick Allowance/Gifts/Income rather than an expense category.
5. ACCOUNT:
   - Pick the best account name if mentioned (e.g. Cash, Bank, Card), or omit if not specified.
6. DATE:
   - YYYY-MM-DD format. Handle "yesterday", "tomorrow", or specific days.

Return ONLY a valid JSON object matching the requested schema.`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nParse this input:\n"${input}"`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          amount: { type: 'NUMBER' },
          type: { type: 'STRING', enum: ['INCOME', 'EXPENSE'] },
          categoryName: { type: 'STRING' },
          accountName: { type: 'STRING' },
          date: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['title', 'amount', 'type', 'categoryName', 'date'],
      },
    },
  };

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try fallback model if 404 or other model-specific issue
        continue;
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) continue;

      const parsed = JSON.parse(rawJson) as GeminiParsedTransaction;
      if (parsed.amount && parsed.amount > 0 && parsed.title) {
        return parsed;
      }
    } catch {
      // If network fails or timeout occurs, continue to fallback or return null
    }
  }

  return null;
}
