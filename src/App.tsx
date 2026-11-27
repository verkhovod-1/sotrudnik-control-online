
import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import type { User } from './types';
import { supabase, initialAuthLinkType } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

type LoginResult = {
  success: boolean;
  error?: string;
};

type PasswordSetupProps = {
  onSetPassword: (password: string) => Promise<LoginResult>;
};

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.3 4.2 9.5 7-.4 1-1.2 2.2-2.4 3.3" />
      <path d="M6.6 6.6C4.4 7.8 3 10 2.5 12c.5 1.2 1.5 2.8 3.5 4.2A10.8 10.8 0 0012 19c1 0 2-.2 2.9-.5" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordSetup({ onSetPassword }: PasswordSetupProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Пароль должен содержать не менее 8 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setIsSaving(true);

    try {
      const result = await onSetPassword(password);

      if (!result.success) {
        setError(result.error || 'Не удалось установить пароль.');
      }
    } catch {
      setError('Ошибка подключения. Попробуйте ещё раз.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-gray-800 p-6 shadow-xl"
      >
        <h1 className="mb-2 text-2xl font-bold text-white">
          Создание пароля
        </h1>

        <p className="mb-6 text-gray-300">
          Придумайте пароль для входа в приложение.
        </p>

        <label className="mb-2 block text-sm text-gray-300">
          Новый пароль
        </label>
        <div className="relative mb-4">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-lg border border-gray-600 bg-gray-700 p-3 pr-12 text-white outline-none focus:border-blue-500"
            placeholder="Не менее 8 символов"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-300 hover:text-white"
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>

        <label className="mb-2 block text-sm text-gray-300">
          Повторите пароль
        </label>
        <div className="relative mb-4">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-lg border border-gray-600 bg-gray-700 p-3 pr-12 text-white outline-none focus:border-blue-500"
            placeholder="Повторите новый пароль"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
            title={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-300 hover:text-white"
          >
            <EyeIcon visible={showConfirmPassword} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить пароль'}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [needsPassword, setNeedsPassword] = useState(
    initialAuthLinkType === 'invite' ||
    initialAuthLinkType === 'recovery'
  );

  const inviteFlow = useRef(initialAuthLinkType === 'invite');

  // Загружает профиль пользователя из Supabase
  const loadProfile = async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at, invited_by')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Ошибка загрузки профиля:', error);
      return null;
    }

    if (!data.is_active) {
      return null;
    }

    return {
      id: data.id,
      email: data.email || '',
      name: data.full_name || '',
      password: '',
      role: data.role as User['role'],
      isActive: data.is_active,
      createdAt: data.created_at,
      invitedBy: data.invited_by || undefined,
    };
  };

  // Проверка существующей сессии и отслеживание входа/выхода
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Ошибка проверки сессии:', error);
      }

      if (data.session) {
        // При приглашении или восстановлении сначала нужно создать пароль
        if (
          initialAuthLinkType !== 'invite' &&
          initialAuthLinkType !== 'recovery'
        ) {
          const profile = await loadProfile(data.session.user.id);

          if (!profile) {
            await supabase.auth.signOut();
          }

          if (mounted) {
            setCurrentUser(profile);
          }
        }
      }

      if (mounted) {
        setIsLoading(false);
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (mounted) {
          setCurrentUser(null);
        }
      }

      if (event === 'PASSWORD_RECOVERY') {
        if (mounted) {
          setNeedsPassword(true);
        }
      }

      if (event === 'SIGNED_IN' && session) {
        if (inviteFlow.current) {
          if (mounted) {
            setNeedsPassword(true);
          }
          return;
        }

        setTimeout(async () => {
          const profile = await loadProfile(session.user.id);

          if (!profile) {
            await supabase.auth.signOut();
          }

          if (mounted) {
            setCurrentUser(profile);
          }
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Установка нового пароля после приглашения или восстановления
  const handleSetPassword = async (
    password: string
  ): Promise<LoginResult> => {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error('Ошибка установки пароля:', error);

      return {
        success: false,
        error: 'Не удалось сохранить пароль. Возможно, ссылка устарела. Запросите новое письмо.',
      };
    }

    const { data, error: userError } = await supabase.auth.getUser();

    if (userError || !data.user) {
      return {
        success: false,
        error: 'Пароль сохранён, но не удалось определить пользователя. Попробуйте войти.',
      };
    }

    const profile = await loadProfile(data.user.id);

    if (!profile) {
      await supabase.auth.signOut();

      return {
        success: false,
        error: 'Профиль не найден или доступ отключён. Обратитесь к администратору.',
      };
    }

    inviteFlow.current = false;
    setCurrentUser(profile);
    setNeedsPassword(false);

    return { success: true };
  };

  // Вход через Supabase Auth
  const handleLogin = async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      return {
        success: false,
        error: 'Неверный email или пароль',
      };
    }

    const profile = await loadProfile(data.user.id);

    if (!profile) {
      await supabase.auth.signOut();

      return {
        success: false,
        error: 'Доступ не активирован. Обратитесь к администратору.',
      };
    }

    setCurrentUser(profile);
    return { success: true };
  };

  // Восстановление пароля через письмо Supabase
  const handleForgotPassword = async (
    email: string
  ): Promise<LoginResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: window.location.origin + '/sotrudnik-control-online/',
      }
    );

    if (error) {
      console.error('Ошибка восстановления пароля:', error);

      return {
        success: false,
        error: 'Не удалось отправить письмо. Проверьте настройки почты.',
      };
    }

    return { success: true };
  };

  // Выход из аккаунта
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Ошибка выхода:', error);
    }

    setCurrentUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (needsPassword) {
    return <PasswordSetup onSetPassword={handleSetPassword} />;
  }

  if (!currentUser) {
    return (
      <Login
        onLogin={handleLogin}
        onForgotPassword={handleForgotPassword}
      />
    );
  }

  return <Dashboard user={currentUser} onLogout={handleLogout} />;
}

export default App;
