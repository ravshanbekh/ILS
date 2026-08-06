import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getResultLabel(result: string) {
  switch (result) {
    case 'green': return '✅ Yashil';
    case 'blue': return '☑️ Ko\'k';
    case 'red': return '❌ Qizil';
    default: return '⏳ Kutilmoqda';
  }
}

export function getResultColor(result: string) {
  switch (result) {
    case 'green': return '#22c55e';
    case 'blue': return '#3b82f6';
    case 'red': return '#ef4444';
    default: return '#f59e0b';
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export function parseExcelQuestions(rows: any[]): { question: string; options: string[]; correct: number }[] {
  const validRows = rows.slice(1).filter(r => r && r[0] && String(r[0]).trim() !== '');

  if (validRows.length === 0) return [];

  // Auto-detect sheet indexing mode for numeric values in column F (r[5])
  let hasZero = false;
  let hasFour = false;

  validRows.forEach(r => {
    const val = r[5];
    if (val !== undefined && val !== null) {
      if (typeof val === 'number') {
        if (Math.round(val) === 0) hasZero = true;
        if (Math.round(val) === 4) hasFour = true;
      } else {
        const s = String(val).trim();
        if (s === '0') hasZero = true;
        if (s === '4') hasFour = true;
      }
    }
  });

  const isOneBased = hasFour && !hasZero;

  return validRows.map(r => {
    const questionText = String(r[0]).trim();
    const options = [
      String(r[1] ?? '').trim(),
      String(r[2] ?? '').trim(),
      String(r[3] ?? '').trim(),
      String(r[4] ?? '').trim(),
    ];

    const correctVal = r[5];
    let correctIdx = 0;

    if (correctVal !== undefined && correctVal !== null) {
      const rawStr = String(correctVal).trim();
      const lowerStr = rawStr.toLowerCase();

      // 1. Text match: Check if column F matches exact text of one of the options
      const textMatchIdx = options.findIndex(opt => opt.length > 0 && opt.toLowerCase() === lowerStr);
      if (textMatchIdx !== -1) {
        correctIdx = textMatchIdx;
      }
      // 2. Letter match: A/B/C/D or A./B./C./D. or A)/B)/C)/D)
      else if (/^(a|0|1-a|variant\s*a)/i.test(rawStr) || /^a[\.\)\:\s]/i.test(rawStr) || rawStr.toUpperCase() === 'A') {
        correctIdx = 0;
      } else if (/^(b|1-b|variant\s*b)/i.test(rawStr) || /^b[\.\)\:\s]/i.test(rawStr) || rawStr.toUpperCase() === 'B') {
        correctIdx = 1;
      } else if (/^(c|1-c|variant\s*c)/i.test(rawStr) || /^c[\.\)\:\s]/i.test(rawStr) || rawStr.toUpperCase() === 'C') {
        correctIdx = 2;
      } else if (/^(d|1-d|variant\s*d)/i.test(rawStr) || /^d[\.\)\:\s]/i.test(rawStr) || rawStr.toUpperCase() === 'D') {
        correctIdx = 3;
      }
      // 3. Numeric match
      else if (typeof correctVal === 'number' || !isNaN(Number(rawStr))) {
        const num = typeof correctVal === 'number' ? Math.round(correctVal) : Math.round(Number(rawStr));
        if (isOneBased) {
          if (num >= 1 && num <= 4) correctIdx = num - 1;
          else if (num === 0) correctIdx = 0;
        } else {
          if (num >= 0 && num <= 3) correctIdx = num;
          else if (num >= 4) correctIdx = 3;
        }
      }
    }

    if (isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3) {
      correctIdx = 0;
    }

    return {
      question: questionText,
      options,
      correct: correctIdx,
    };
  });
}
