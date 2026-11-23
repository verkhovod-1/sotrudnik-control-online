
/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

// Запоминаем тип ссылки до обработки URL библиотекой Supabase
const getInitialAuthLinkType = (): string | null => {
  if (typeof window === 'undefined') return null;

  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, '')
  );
  const searchParams = new URLSearchParams(window.location.search);

  return hashParams.get('type') || searchParams.get('type');
};

export const initialAuthLinkType = getInitialAuthLinkType();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Не заданы настройки Supabase. Проверь переменные окружения.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
