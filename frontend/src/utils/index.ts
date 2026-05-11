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
