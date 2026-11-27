
import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { User, Task } from '../types';
import { supabase } from '../lib/supabase';
import { formatMSKDateTime } from '../store';
import SearchBar from './SearchBar';
import TaskDetailsModal from './TaskDetailsModal';

interface TasksProps {
  user: User;
}

interface ProfileInfo {
  id: string;
  full_name: string | null;
}

export default function Tasks({ user }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [assignees, setAssignees] = useState<ProfileInfo[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<
    'all' | 'active' | 'completed' | 'notCompleted'
  >('all');
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
      notCompleted: item.not_completed ?? false,
      completedAt: item.completed_at || undefined,
      attachments: item.attachments || [],
    }));

    setTasks(mappedTasks);

    // Обновляем открытую карточку, если задача изменилась.
    setSelectedTask((current) => {
      if (!current) return null;
      return mappedTasks.find((task) => task.id === current.id) || null;
    });

    const { data: profileData, error: profileError } = await supabase
      .rpc('get_task_assignees');

    if (profileError) {
      setError('Не удалось загрузить список сотрудников: ' + profileError.message);
      setLoading(false);
      return;
    }

    const availableProfiles = (profileData || []) as ProfileInfo[];
    setAssignees(availableProfiles);

    const profileMap: Record<string, string> = {};

    availableProfiles.forEach((profile) => {
      profileMap[profile.id] =
        profile.full_name?.trim() || 'Сотрудник';
    });

    profileMap[user.id] = user.name || 'Вы';

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
        notCompleted: item.not_completed ?? false,
        completedAt: item.completed_at || undefined,
        attachments: item.attachments || [],
      }));

      setTasks(mappedTasks);

      const { data: profileData, error: profileError } = await supabase
        .rpc('get_task_assignees');

      if (!active) return;

      if (profileError) {
        setError('Не удалось загрузить список сотрудников: ' + profileError.message);
        setLoading(false);
        return;
      }

      const availableProfiles = (profileData || []) as ProfileInfo[];
      setAssignees(availableProfiles);

      const profileMap: Record<string, string> = {};

      availableProfiles.forEach((profile) => {
        profileMap[profile.id] =
          profile.full_name?.trim() || 'Сотрудник';
      });

      profileMap[user.id] = user.name || 'Вы';

      setProfiles(profileMap);
      setLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [user.id, user.name]);

  // Отметить задачу выполненной.
  const handleComplete = async (taskId: string) => {
    setError('');

    const { data, error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        not_completed: false,
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
              completedAt: data.completed_at,
              notCompleted: false,
            }
          : task
      )
    );
  };

  // Вернуть задачу в работу.
  const handleUncomplete = async (taskId: string) => {
    setError('');

    const { data, error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: false,
        completed_at: null,
        not_completed: false,
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
              notCompleted: false,
            }
          : task
      )
    );
  };

  const handleDelete = async (taskId: string) => {
    if (!isManager) return;

    setError('');

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      setError('Не удалось удалить задачу: ' + deleteError.message);
      return;
    }

    setTasks((previous) => previous.filter((task) => task.id !== taskId));

    setSelectedTask((current) =>
      current?.id === taskId ? null : current
    );
  };

  const handleCreate = async (
    title: string,
    description: string,
    deadline: string,
    assigneeId: string
  ) => {
    setError('');

    const { error: insertError } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId,
        creator_id: user.id,
        deadline: new Date(deadline).toISOString(),
        completed: false,
        not_completed: false,
        attachments: [],
      });

    if (insertError) {
      setError('Не удалось создать задачу: ' + insertError.message);
      return;
    }

    setShowCreateModal(false);
    await loadTasks();
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active' && (task.completed || task.notCompleted)) {
      return false;
    }

    if (filter === 'completed' && !task.completed) {
      return false;
    }

    if (filter === 'notCompleted' && !task.notCompleted) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      const creator =
        task.creatorId === user.id
          ? user.name || user.email
          : profiles[task.creatorId] || 'Сотрудник';

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
    if (task.completed || task.notCompleted) return false;
    return new Date(task.deadline) < new Date();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Мои задачи</h3>

          <p className="text-gray-600 text-sm">
            Всего: {tasks.length} |
            Активных: {tasks.filter((t) => !t.completed && !t.notCompleted).length} |
            Выполнено: {tasks.filter((t) => t.completed).length} |
            Не выполнено: {tasks.filter((t) => t.notCompleted).length}
          </p>
        </div>

        <button
          onClick={() => {
            setError('');
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition text-sm font-medium shadow-md"
        >
          + Новая задача
        </button>
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

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          ['all', 'active', 'completed', 'notCompleted'] as const
        ).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filter === f
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200'
                : 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
            }`}
          >
            {f === 'all'
              ? 'Все'
              : f === 'active'
              ? 'Активные'
              : f === 'completed'
              ? 'Выполненные'
              : 'Не выполнены'}
          </button>
        ))}
      </div>

      {/* Прокручиваемый список задач */}
      <div className="max-h-[65vh] min-h-[220px] overflow-y-auto overscroll-contain pr-2 space-y-3">
        {loading ? (
          <div className="text-center py-12 card-light rounded-xl text-gray-500">
            Загружаем задачи...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 card-light rounded-xl">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>

            <p className="text-gray-500">Задач пока нет</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const creator =
              task.creatorId === user.id
                ? user.name || user.email
                : profiles[task.creatorId] || 'Сотрудник';

            const assignee =
              profiles[task.assigneeId] ||
              (task.assigneeId === user.id ? 'Вы' : 'Сотрудник');

            const canChangeStatus =
              isManager || task.assigneeId === user.id;

            const canDelete = isManager;

            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTask(task)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTask(task);
                  }
                }}
                className={`card-light rounded-xl p-4 transition hover-lift cursor-pointer ${
                  task.completed
                    ? 'border-green-200'
                    : task.notCompleted
                    ? 'border-red-300'
                    : isOverdue(task)
                    ? 'border-red-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {canChangeStatus ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        if (task.completed || task.notCompleted) {
                          void handleUncomplete(task.id);
                        } else {
                          void handleComplete(task.id);
                        }
                      }}
                      className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        task.completed
                          ? 'bg-green-500 border-green-500'
                          : task.notCompleted
                          ? 'bg-red-500 border-red-500'
                          : 'bg-transparent border-gray-500 hover:border-blue-400'
                      }`}
                      title={
                        task.completed || task.notCompleted
                          ? 'Вернуть в работу'
                          : 'Выполнить'
                      }
                    >
                      {task.completed && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div
                      className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        task.completed
                          ? 'bg-green-500 border-green-500'
                          : task.notCompleted
                          ? 'bg-red-500 border-red-500'
                          : 'bg-transparent border-gray-400'
                      }`}
                    >
                      {task.completed && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4
                      className={`font-medium break-words ${
                        task.completed
                          ? 'text-gray-400 line-through'
                          : task.notCompleted
                          ? 'text-red-700'
                          : 'text-gray-800'
                      }`}
                    >
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap break-words">
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

                      <span
                        className={
                          isOverdue(task)
                            ? 'text-red-600 font-semibold'
                            : 'text-gray-500'
                        }
                      >
                        Срок: {formatMSKDateTime(task.deadline)}

                        {isOverdue(task) && (
                          <span className="inline-flex items-center ml-1">
                            <span className="text-red-500 text-lg animate-pulse">
                              ❗
                            </span>
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

                      {task.notCompleted && (
                        <span className="text-red-600 font-medium">
                          Не выполнена
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-indigo-500 mt-2">
                      Нажмите, чтобы открыть карточку задачи
                    </p>
                  </div>

                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(task.id);
                      }}
                      className="text-gray-400 hover:text-red-500 transition p-1"
                      title="Удалить"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          assignees={assignees}
          currentUserId={user.id}
        />
      )}

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          user={user}
          profiles={profiles}
          assignees={assignees}
          onClose={() => setSelectedTask(null)}
          onRefresh={loadTasks}
        />
      )}
    </div>
  );
}

function CreateTaskModal({
  onClose,
  onCreate,
  assignees,
  currentUserId,
}: {
  onClose: () => void;
  onCreate: (
    title: string,
    description: string,
    deadline: string,
    assigneeId: string
  ) => Promise<void>;
  assignees: ProfileInfo[];
  currentUserId: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !deadline || !assigneeId || saving) return;

    setSaving(true);
    await onCreate(title, description, deadline, assigneeId);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-light rounded-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Новая задача
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Название задачи
            </label>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Описание
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Кому назначить
            </label>

            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            >
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name?.trim() || 'Сотрудник'}
                  {person.id === currentUserId ? ' (Вы)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Срок исполнения
            </label>

            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={saving || assignees.length === 0}
              className="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition font-medium shadow-md disabled:opacity-50"
            >
              {saving ? 'Сохраняем...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
