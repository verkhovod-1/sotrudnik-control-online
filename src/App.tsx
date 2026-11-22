
import { useState, useEffect } from 'react';
import type { User } from './types';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

type LoginResult = {
  success: boolean;
  error?: string;
};

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        const profile = await loadProfile(data.session.user.id);

        if (!profile) {
          await supabase.auth.signOut();
        }

        if (mounted) {
          setCurrentUser(profile);
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
        if (mounted) setCurrentUser(null);
      }

      if (event === 'SIGNED_IN' && session) {
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
