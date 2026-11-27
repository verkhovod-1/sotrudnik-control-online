
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Task, User } from '../types';
import { supabase } from '../lib/supabase';
import { formatMSKDateTime } from '../store';

interface ProfileInfo {
  id: string;
  full_name: string | null;
}

interface TaskComment {
  id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

interface TaskDetailsModalProps {
  task: Task;
  user: User;
  profiles: Record<string, string>;
  assignees: ProfileInfo[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function TaskDetailsModal({
  task,
  user,
  profiles,
  assignees,
  onClose,
  onRefresh,
}: TaskDetailsModalProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [savingComment, setSavingComment] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [delegating, setDelegating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isManager = user.role === 'admin' || user.role === 'director';
  const isAssignee = task.assigneeId === user.id;
  const canDelegate = isManager || isAssignee;
  const canChangeStatus = isManager || isAssignee;

  const assigneeName = profiles[task.assigneeId] || 'Сотрудник';
  const creatorName =
    profiles[task.creatorId] ||
    (task.creatorId === user.id ? user.name : 'Сотрудник');

  const loadComments = async () => {
    setLoadingComments(true);

    const { data, error: commentsError } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });

    if (commentsError) {
      setError('Не удалось загрузить комментарии: ' + commentsError.message);
    } else {
      setComments((data || []) as TaskComment[]);
    }

    setLoadingComments(false);
  };

  useEffect(() => {
    void loadComments();
  }, [task.id]);

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();

    if (!commentText.trim() || savingComment) return;

    setSavingComment(true);
    setError('');
    setMessage('');

    const { error: insertError } = await supabase
      .from('task_comments')
      .insert({
        task_id: task.id,
        author_id: user.id,
        author_name: user.name || 'Сотрудник',
        content: commentText.trim(),
      });

    if (insertError) {
      setError('Не удалось добавить комментарий: ' + insertError.message);
    } else {
      setCommentText('');
      await loadComments();
    }

    setSavingComment(false);
  };

  const handleNotCompleted = async () => {
    if (!canChangeStatus) return;

    setError('');
    setMessage('');

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: false,
        completed_at: null,
        not_completed: true,
      })
      .eq('id', task.id);

    if (updateError) {
      setError('Не удалось изменить статус: ' + updateError.message);
      return;
    }

    setMessage('Задача отмечена как невыполненная.');
    await onRefresh();
  };

  const handleReturnToWork = async () => {
    if (!canChangeStatus) return;

    setError('');
    setMessage('');

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: false,
        completed_at: null,
        not_completed: false,
      })
      .eq('id', task.id);

    if (updateError) {
      setError('Не удалось вернуть задачу в работу: ' + updateError.message);
      return;
    }

    setMessage('Задача возвращена в работу.');
    await onRefresh();
  };

  const handleDelegate = async () => {
    if (!canDelegate || !selectedAssignee || delegating) return;

    if (selectedAssignee === task.assigneeId) {
      setError('Выберите другого исполнителя.');
      return;
    }

    setDelegating(true);
    setError('');
    setMessage('');

    const { error: insertError } = await supabase
      .from('tasks')
      .insert({
        title: task.title,
        description: task.description || null,
        assignee_id: selectedAssignee,
        creator_id: user.id,
        deadline: task.deadline,
        completed: false,
        not_completed: false,
        attachments: [],
      });

    if (insertError) {
      setError('Не удалось создать задачу для нового исполнителя: ' + insertError.message);
      setDelegating(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: false,
        completed_at: null,
        not_completed: true,
      })
      .eq('id', task.id);

    if (updateError) {
      setError(
        'Новая задача создана, но исходную не удалось обновить: ' +
        updateError.message
      );
      setDelegating(false);
      await onRefresh();
      return;
    }

    setMessage('Задача передана новому исполнителю. Для него создана отдельная задача.');
    setSelectedAssignee('');
    setDelegating(false);
    await onRefresh();
  };

  const handleDelegationSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleDelegate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="card-light w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">

        <div className="sticky top-0 z-10 card-light border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">Карточка задачи</p>
            <h2 className="text-xl font-bold text-gray-800 break-words">
              {task.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500 text-2xl leading-none p-1"
            title="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-4 h-4 rounded-full border-2 ${
              task.completed
                ? 'bg-green-500 border-green-500'
                : task.notCompleted
                ? 'bg-red-500 border-red-500'
                : 'bg-transparent border-gray-400'
            }`} />

            <span className="text-sm font-medium text-gray-700">
              {task.completed
                ? 'Выполнена'
                : task.notCompleted
                ? 'Не выполнена'
                : 'В работе'}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              Описание задачи
            </h3>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-gray-800 text-sm whitespace-pre-wrap break-words">
              {task.description || 'Описание не добавлено.'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Исполнитель</p>
              <p className="text-sm font-medium text-gray-800">
                {assigneeName}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Создатель</p>
              <p className="text-sm font-medium text-gray-800">
                {creatorName}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Дата создания</p>
              <p className="text-sm text-gray-800">
                {formatMSKDateTime(task.createdAt)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Срок исполнения</p>
              <p className="text-sm text-gray-800">
                {formatMSKDateTime(task.deadline)}
              </p>
            </div>
          </div>

          {canChangeStatus && !task.completed && (
            <div className="flex flex-wrap gap-2">
              {!task.notCompleted ? (
                <button
                  onClick={handleNotCompleted}
                  className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-sm font-medium"
                >
                  Отметить как невыполненную
                </button>
              ) : (
                <button
                  onClick={handleReturnToWork}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 text-sm font-medium"
                >
                  Вернуть в работу
                </button>
              )}
            </div>
          )}

          {canDelegate && (
            <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-2">
                Делегировать задачу
              </h3>

              <p className="text-xs text-gray-600 mb-3">
                Будет создана отдельная задача для нового исполнителя,
                а исходная задача получит статус «Не выполнена».
              </p>

              <form onSubmit={handleDelegationSubmit} className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm"
                  required
                >
                  <option value="">Выберите нового исполнителя</option>
                  {assignees
                    .filter((person) => person.id !== task.assigneeId)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name?.trim() || 'Сотрудник'}
                      </option>
                    ))}
                </select>

                <button
                  type="submit"
                  disabled={!selectedAssignee || delegating}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {delegating ? 'Передаём...' : 'Передать'}
                </button>
              </form>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-800 mb-3">
              Комментарии ({comments.length})
            </h3>

            {loadingComments ? (
              <p className="text-sm text-gray-500">Загружаем комментарии...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-500 rounded-lg bg-gray-50 p-3">
                Комментариев пока нет.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-xl border border-gray-200 p-3"
                  >
                    <div className="flex justify-between gap-2 flex-wrap mb-2">
                      <span className="text-sm font-semibold text-indigo-700">
                        {comment.author_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatMSKDateTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddComment} className="mt-3 space-y-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                placeholder="Напишите комментарий к задаче..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <button
                type="submit"
                disabled={!commentText.trim() || savingComment}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingComment ? 'Отправляем...' : 'Добавить комментарий'}
              </button>
            </form>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm break-words">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
              {message}
            </div>
          )}

          <div className="pt-2 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Закрыть карточку
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
