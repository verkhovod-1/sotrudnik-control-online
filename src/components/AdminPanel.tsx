
import { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { supabase } from '../lib/supabase';
import SearchBar from './SearchBar';

interface AdminPanelProps {
  user: User;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canManageRoles = user.role === 'director';
  const canInvite = user.role === 'director' || user.role === 'admin';

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      setError('Не удалось загрузить сотрудников: ' + error.message);
      setLoading(false);
      return;
    }

    const mapped = (data as ProfileRow[]).map((p) => ({
      id: p.id,
      name: p.full_name || p.email,
      email: p.email,
      role: p.role as Role,
      isActive: p.is_active,
    })) as User[];

    setUsers(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const activeUsers = users.filter((u) => u.isActive);
  const directorCount = activeUsers.filter((u) => u.role === 'director').length;
  const adminCount = activeUsers.filter((u) => u.role === 'admin').length;

  const filteredUsers = searchQuery.trim()
    ? users.filter((u) => {
        const query = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
        );
      })
    : users;

  const callFunction = async (body: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke(
      'manage-users',
      { body }
    );

    if (error) {
      throw new Error(error.message || 'Ошибка обращения к серверу');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    if (!confirm('Изменить роль сотрудника?')) return;

    try {
      await callFunction({
        action: 'set_role',
        user_id: userId,
        role,
      });

      alert('Роль успешно изменена');
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось изменить роль');
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm(
      'Отключить учётную запись сотрудника? Его история задач и сообщений сохранится.'
    )) return;

    try {
      await callFunction({
        action: 'deactivate',
        user_id: userId,
      });

      alert('Учётная запись отключена');
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось отключить сотрудника');
    }
  };

  const handleActivate = async (userId: string) => {
    if (!confirm('Снова включить учётную запись участника?')) return;

    try {
      await callFunction({
        action: 'activate',
        user_id: userId,
      });

      alert('Учётная запись снова активна');
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось включить участника');
    }
  };

  const handleDelete = async (u: User) => {
    const confirmation = prompt(
      `ВНИМАНИЕ! Учётная запись будет удалена без возможности восстановления.\n\n` +
      `История задач, сообщений, документов и заметок сохранится.\n\n` +
      `Для подтверждения введи email участника:\n${u.email}`
    );

    if (confirmation === null) return;

    if (confirmation.trim().toLowerCase() !== u.email.toLowerCase()) {
      alert('Email не совпадает. Удаление отменено.');
      return;
    }

    try {
      await callFunction({
        action: 'delete_user',
        user_id: u.id,
      });

      alert('Участник удалён. История сохранена.');
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось удалить участника');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'director':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-300">
            Управляющий
          </span>
        );
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 border border-purple-300">
            Администратор
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 border border-indigo-300">
            Сотрудник
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Панель управления</h3>
          <p className="text-gray-600 text-sm">
            Управление сотрудниками и ролями
          </p>
        </div>

        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition text-sm font-medium shadow-md"
          >
            + Пригласить сотрудника
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card-light rounded-xl p-4">
          <p className="text-amber-600 text-sm">Управляющий</p>
          <p className="text-gray-800 text-2xl font-bold">{directorCount}/1</p>
        </div>
        <div className="card-light rounded-xl p-4">
          <p className="text-purple-600 text-sm">Администраторы</p>
          <p className="text-gray-800 text-2xl font-bold">{adminCount}/3</p>
        </div>
        <div className="card-light rounded-xl p-4">
          <p className="text-indigo-600 text-sm">Всего сотрудников</p>
          <p className="text-gray-800 text-2xl font-bold">{users.length}</p>
        </div>
      </div>

      <div className="card-light rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-gray-800 font-semibold mb-3">
            Список сотрудников
          </h4>
          <div className="max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск по имени или email..."
            />
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            Загрузка сотрудников...
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                {searchQuery.trim()
                  ? 'Сотрудники не найдены'
                  : 'Нет сотрудников'}
              </div>
            ) : null}

            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="p-4 flex flex-wrap items-center gap-4 hover:bg-gray-50 transition"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-800 font-medium truncate">
                      {u.name}
                    </p>

                    {!u.isActive && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 border border-yellow-300">
                        Отключён
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs">{u.email}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {getRoleBadge(u.role)}

                  {canManageRoles && u.id !== user.id && u.isActive && (
                    <div className="flex gap-1">
                      {u.role !== 'director' && directorCount < 1 && (
                        <button
                          onClick={() => handleRoleChange(u.id, 'director')}
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition"
                          title="Назначить управляющим"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                          </svg>
                        </button>
                      )}

                      {u.role !== 'admin' && adminCount < 3 && (
                        <button
                          onClick={() => handleRoleChange(u.id, 'admin')}
                          className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition"
                          title="Назначить администратором"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          </svg>
                        </button>
                      )}

                      {u.role !== 'employee' && (
                        <button
                          onClick={() => handleRoleChange(u.id, 'employee')}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                          title="Снять роль"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13H5v-2h14v2z" />
                          </svg>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded transition"
                        title="Отключить сотрудника"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvite && (
        <InviteModal
          userRole={user.role}
          onClose={() => setShowInvite(false)}
          onInvited={async () => {
            setShowInvite(false);
            await loadUsers();
          }}
        />
      )}
    </div>
  );
}

function InviteModal({
  onClose,
  onInvited,
  userRole,
}: {
  onClose: () => void;
  onInvited: () => void;
  userRole: string;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const isDirector = userRole === 'director';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim()) {
      setError('Заполните имя и электронную почту');
      return;
    }

    if (!isDirector && role !== 'employee') {
      setError('Администратор может приглашать только сотрудников');
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'manage-users',
        {
          body: {
            action: 'invite',
            email: email.trim(),
            full_name: name.trim(),
            role,
          },
        }
      );

      
if (error) {
  let message = error.message || 'Ошибка отправки приглашения';

  const response = (error as any).context;

  if (response && typeof response.clone === 'function') {
    try {
      const details = await response.clone().json();
      message =
        details.error ||
        details.message ||
        details.msg ||
        JSON.stringify(details);
    } catch {
      // Если тело ответа не удалось прочитать,
      // оставляем исходное сообщение
    }
  }

  throw new Error(message);
}
      if (data?.error) {
        throw new Error(data.error);
      }

      alert(data?.message || 'Приглашение отправлено на почту');
      onInvited();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось отправить приглашение'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-light rounded-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          Пригласить сотрудника
        </h3>

        <p className="text-gray-600 text-sm mb-4">
          На указанную почту будет отправлено настоящее приглашение от Supabase.
          Ссылка позволит сотруднику завершить регистрацию.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              ФИО сотрудника
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Электронная почта
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Роль в системе
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="employee">Сотрудник</option>
              {isDirector && (
                <>
                  <option value="admin">Администратор</option>
                  <option value="director">Управляющий</option>
                </>
              )}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <p className="text-indigo-700 text-xs">
              Временный пароль не создаётся. Сотрудник получит письмо со ссылкой
              для завершения регистрации.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={sending}
              className="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition font-medium shadow-md disabled:opacity-50"
            >
              {sending ? 'Отправка...' : 'Пригласить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
