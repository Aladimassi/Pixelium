/** Shared budget parsing for RAG advisor. */
export function extractBudgetCents(message: string): { cents: number; explicit: boolean } {
  const patterns = [
    /under\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /below\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /less\s+than\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /max(?:imum)?\s+(?:of\s+)?\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /budget\s+(?:of\s+)?\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /\$\s*(\d+(?:\.\d{1,2})?)\s*(?:max|limit|ceiling|or\s+less)?/i,
  ];

  for (const pattern of patterns) {
    const m = message.match(pattern);
    if (m) {
      const dollars = parseFloat(m[1]);
      if (!Number.isNaN(dollars) && dollars > 0) {
        return { cents: Math.round(dollars * 100), explicit: true };
      }
    }
  }

  return { cents: 0, explicit: false };
}
