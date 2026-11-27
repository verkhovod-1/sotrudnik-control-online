
import { useState } from 'react';

type LoginResult = {
  success: boolean;
  error?: string;
};

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onForgotPassword: (email: string) => Promise<LoginResult>;
}

export default function Login({ onLogin, onForgotPassword }: LoginProps) {
  const [screen, setScreen] = useState<'login' | 'forgot' | 'sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await onLogin(email.trim(), password);
      if (!result.success) {
        setError(result.error || 'Не удалось войти');
      }
    } catch {
      setError('Ошибка подключения. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await onForgotPassword(email.trim());
      if (result.success) {
        setScreen('sent');
      } else {
        setError(result.error || 'Не удалось отправить письмо');
      }
    } catch {
      setError('Ошибка подключения. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScreen('login');
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 decorative-bg relative">
      <div className="relative w-full max-w-md z-10 animate-fade-in">
        <div className="card-light rounded-2xl p-8">
          <div className="text-center mb-8">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="Синхрон"
              className="w-24 h-24 object-contain mb-4 mx-auto"
            />
            <h1 className="text-3xl font-bold gradient-text mb-2">Синхрон</h1>
            <p className="text-gray-600 text-sm">Система управления задачами</p>
          </div>

          {screen === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Электронная почта
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-indigo-600"
                  >
                    {showPassword ? (
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
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 disabled:opacity-60"
              >
                {loading ? 'Выполняется вход...' : 'Войти'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setScreen('forgot');
                    setError('');
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-sm underline underline-offset-2"
                >
                  Забыли пароль?
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-gray-500 text-xs text-center">
                  Вход только по приглашению. Обратитесь к администратору для получения доступа.
                </p>
              </div>
            </form>
          )}

          {screen === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-gray-600 text-sm text-center">
                Укажите email своей учётной записи. Мы отправим ссылку для восстановления пароля.
              </p>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800"
                placeholder="email@example.com"
                required
              />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg disabled:opacity-60"
              >
                {loading ? 'Отправка...' : 'Отправить ссылку'}
              </button>

              <button
                type="button"
                onClick={reset}
                className="w-full py-2 text-indigo-600 text-sm"
              >
                ← Вернуться ко входу
              </button>
            </form>
          )}

          {screen === 'sent' && (
            <div className="space-y-4 text-center">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700 font-medium mb-2">
                  Письмо отправлено
                </p>
                <p className="text-green-600 text-sm">
                  Если учётная запись существует, на адрес {email} придёт ссылка для восстановления пароля.
                </p>
              </div>

              <button
                type="button"
                onClick={reset}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg"
              >
                Вернуться ко входу
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
