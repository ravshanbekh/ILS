import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Rostdan ham o'chirmoqchimisiz?",
  description = "Bu amalni ortga qaytarib bo'lmaydi.",
  confirmText = "Ha, o'chirish",
  cancelText = "Bekor qilish",
  danger = true,
  loading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold ${
            danger
              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
          }`}>
            {danger ? '🗑️' : '⚠️'}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white leading-snug">{title}</h3>
            {description && (
              <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">{description}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition p-1 rounded-lg hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition border border-zinc-700/50 outline-none disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm text-white transition shadow-lg flex items-center justify-center gap-2 outline-none disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
            }`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
