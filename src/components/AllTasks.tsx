
import { useState, useEffect } from 'react';
import type { User, Task } from '../types';
import { supabase } from '../lib/supabase';
import { formatMSKDateTime } from '../store';
import SearchBar from './SearchBar';

interface AllTasksProps {
  user: User;
}

interface ProfileInfo {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function AllTasks({ user }: AllTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isManager = user.role === 'director' || user.role === 'admin';

  const loadTasks = async () => {
    setLoading(true);
    setError('');

    const { data, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (tasksError) {
      setError('Не удалось загрузить задачи: ' + tasksError.message);
      setLoading(false);
      return;
    }

    const mappedTasks: Task[] = (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      assigneeId: item.assignee_id || '',
      creatorId: item.creator_id || '',
      createdAt: item.created_at,
      deadline: item.deadline,
      completed: item.completed,
      completedAt: item.completed_at || undefined,
      attachments: item.attachments || [],
    }));

    setTasks(mappedTasks);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email');

    const profileMap: Record<string, string> = {};

    (profileData as ProfileInfo[] | null || []).forEach((profile) => {
      profileMap[profile.id] =
        profile.full_name?.trim() || profile.email || 'Сотрудник';
    });

    profileMap[user.id] = user.name || user.email || 'Вы';

    setProfiles(profileMap);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      const { data, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!active) return;

      if (tasksError) {
        setError('Не удалось загрузить задачи: ' + tasksError.message);
        setLoading(false);
        return;
      }

      const mappedTasks: Task[] = (data || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        assigneeId: item.assignee_id || '',
        creatorId: item.creator_id || '',
        createdAt: item.created_at,
        deadline: item.deadline,
        completed: item.completed,
        completedAt: item.completed_at || undefined,
        attachments: item.attachments || [],
      }));

      setTasks(mappedTasks);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      if (!active) return;

      const profileMap: Record<string, string> = {};

      (profileData as ProfileInfo[] | null || []).forEach((profile) => {
        profileMap[profile.id] =
          profile.full_name?.trim() || profile.email || 'Сотрудник';
      });

      profileMap[user.id] = user.name || user.email || 'Вы';

      setProfiles(profileMap);
      setLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [user.id]);

  const handleComplete = async (taskId: string) => {
    setError('');

    const { data, error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      setError('Не удалось выполнить задачу: ' + updateError.message);
      return;
    }

    setTasks((previous) =>
      previous.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: data.completed,
              completedAt: data.completed_at || undefined,
            }
          : task
      )
    );
  };

  const handleUncomplete = async (taskId: string) => {
    setError('');

    const { data, error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: false,
        completed_at: null,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      setError('Не удалось вернуть задачу в работу: ' + updateError.message);
      return;
    }

    setTasks((previous) =>
      previous.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: data.completed,
              completedAt: undefined,
            }
          : task
      )
    );
  };

  const handleDelete = async (taskId: string) => {
    setError('');

    const { data, error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .select('id')
      .single();

    if (deleteError || !data) {
      setError(
        'Не удалось удалить задачу. Возможно, у вас нет прав на её удаление.'
      );
      return;
    }

    setTasks((previous) => previous.filter((task) => task.id !== taskId));
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active' && task.completed) return false;
    if (filter === 'completed' && !task.completed) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      const creator =
        profiles[task.creatorId] ||
        (task.creatorId === user.id ? 'Вы' : 'Сотрудник');

      const assignee =
        profiles[task.assigneeId] ||
        (task.assigneeId === user.id ? 'Вы' : 'Сотрудник');

      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesDescription = task.description?.toLowerCase().includes(query);
      const matchesCreator = creator.toLowerCase().includes(query);
      const matchesAssignee = assignee.toLowerCase().includes(query);

      return (
        matchesTitle ||
        matchesDescription ||
        matchesCreator ||
        matchesAssignee
      );
    }

    return true;
  });

  const isOverdue = (task: Task) => {
    if (task.completed) return false;
    return new Date(task.deadline) < new Date();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Все задачи</h3>
          <p className="text-gray-600 text-sm">
            Всего: {tasks.length} | Активных: {tasks.filter((t) => !t.completed).length} | Выполнено: {tasks.filter((t) => t.completed).length}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm break-words">
          {error}
        </div>
      )}

      <div className="mb-4 max-w-md">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск задач..."
        />
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filter === f
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200'
                : 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
            }`}
          >
            {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Выполненные'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 card-light rounded-xl text-gray-500">
            Загружаем задачи...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 card-light rounded-xl">
            <p className="text-gray-500">Задач не найдено</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const creator =
              profiles[task.creatorId] ||
              (task.creatorId === user.id ? 'Вы' : 'Сотрудник');

            const assignee =
              profiles[task.assigneeId] ||
              (task.assigneeId === user.id ? 'Вы' : 'Сотрудник');

            const canChangeStatus =
              isManager || task.assigneeId === user.id;

            const canDelete =
              isManager || task.creatorId === user.id;

            return (
              <div
                key={task.id}
                className={`card-light rounded-xl p-4 transition hover-lift ${
                  task.completed
                    ? 'border-green-200'
                    : isOverdue(task)
                    ? 'border-red-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {canChangeStatus ? (
                    <button
                      onClick={() =>
                        task.completed
                          ? handleUncomplete(task.id)
                          : handleComplete(task.id)
                      }
                      className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        task.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-400 hover:border-indigo-500'
                      }`}
                      title={task.completed ? 'Вернуть в работу' : 'Выполнить'}
                    >
                      {task.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div
                      className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        task.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {task.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-gray-600 text-sm mt-1">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                      <span className="text-purple-600">
                        Исполнитель: {assignee}
                      </span>

                      <span className="text-gray-500">
                        Создана: {formatMSKDateTime(task.createdAt)}
                      </span>

                      <span className={isOverdue(task) ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                        Срок: {formatMSKDateTime(task.deadline)}
                        {isOverdue(task) && (
                          <span className="inline-flex items-center ml-1">
                            <span className="text-red-500 text-lg animate-pulse">❗</span>
                            <span className="text-red-600 text-xs ml-1">
                              Просрочено
                            </span>
                          </span>
                        )}
                      </span>

                      <span className="text-gray-500">
                        От: {creator}
                      </span>

                      {task.completed && task.completedAt && (
                        <span className="text-green-600">
                          ✓ Выполнено: {formatMSKDateTime(task.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-gray-400 hover:text-red-500 transition p-1"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
