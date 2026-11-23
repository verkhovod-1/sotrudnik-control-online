
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

function PasswordSetup({ onSetPassword }: PasswordSetupProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    const result = await onSetPassword(password);

    if (!result.success) {
      setError(result.error || 'Не удалось установить пароль.');
    }

    setIsSaving(false);
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
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          className="mb-4 w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-blue-500"
          placeholder="Не менее 8 символов"
        />

        <label className="mb-2 block text-sm text-gray-300">
          Повторите пароль
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          className="mb-4 w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-blue-500"
          placeholder="Повторите новый пароль"
        />

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
