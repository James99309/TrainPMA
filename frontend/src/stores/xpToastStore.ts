import { create } from 'zustand';

export interface XPToast {
  id: string;
  amount: number;
  reason: string;
  icon?: string;
}

interface XPToastState {
  toasts: XPToast[];
  addToast: (toast: Omit<XPToast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useXPToastStore = create<XPToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Helper function to show XP toast from anywhere
export const showXPToast = (toast: Omit<XPToast, 'id'>) => {
  useXPToastStore.getState().addToast(toast);
};
