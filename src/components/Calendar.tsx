
import { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import { getMSKDateString } from '../store';
import SearchBar from './SearchBar';
import {
  formatFileSize,
  getFileIcon,
  isAllowedFile,
} from '../utils/files';

interface CalendarAttachment {
  name: string;
  size: number;
  type: string;
  file_path: string;
}

interface CalendarNoteView {
  id: string;
  userId: string;
  title: string;
  date: string;
  time: string;
  recurring: boolean;
  remindDaysBefore: number;
  taskId: string | null;
  attachments: CalendarAttachment[];
}

interface CalendarProps {
  user: User;
}

function mapNote(row: any): CalendarNoteView {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || '',
    date: row.date,
    time: row.time || '',
    recurring: Boolean(row.recurring),
    remindDaysBefore: Number(row.remind_days_before ?? 1),
    taskId: row.task_id || null,
    attachments: Array.isArray(row.attachments)
      ? row.attachments
      : [],
  };
}

function getDaysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);

  const first = Date.UTC(fy, fm - 1, fd);
  const second = Date.UTC(ty, tm - 1, td);

  return Math.round((second - first) / 86400000);
}

export default function Calendar({ user }: CalendarProps) {
  const [notes, setNotes] = useState<CalendarNoteView[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const processedReminders = useRef(new Set<string>());

  const loadNotes = async () => {
    const { data, error: loadError } = await supabase
      .from('calendar_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (loadError) {
      console.error('Ошибка загрузки календаря:', loadError);
      setError('Не удалось загрузить заметки');
      return;
    }

    setError('');
    setNotes((data || []).map(mapNote));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data, error: loadError } = await supabase
        .from('calendar_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (cancelled) return;

      if (loadError) {
        console.error('Ошибка загрузки календаря:', loadError);
        setError('Не удалось загрузить заметки');
      } else {
        setError('');
        setNotes((data || []).map(mapNote));
      }

      setLoading(false);
    };

    processedReminders.current.clear();
    load();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  // Автоматическое создание задач-напоминаний.
  useEffect(() => {
    let cancelled = false;

    const processReminders = async () => {
      const today = getMSKDateString();

      for (const note of notes) {
        if (cancelled) return;
        if (note.taskId) continue;
        if (processedReminders.current.has(note.id)) continue;

        const daysUntil = getDaysBetween(today, note.date);

        if (daysUntil !== note.remindDaysBefore) continue;

        processedReminders.current.add(note.id);

        const deadlineDate = new Date(
          `${note.date}T${note.time || '09:00'}:00`
        );

        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: `📅 Напоминание: ${note.title}`,
            description:
              `Автоматически созданная задача из календаря. Заметка на ${note.date}`,
            assignee_id: user.id,
            creator_id: user.id,
            deadline: deadlineDate.toISOString(),
            completed: false,
            attachments: [],
          })
          .select('id')
          .single();

        if (cancelled) return;

        if (taskError || !task) {
          console.error('Ошибка создания задачи-напоминания:', taskError);
          processedReminders.current.delete(note.id);
          continue;
        }

        const { error: updateError } = await supabase
          .from('calendar_notes')
          .update({ task_id: task.id })
          .eq('id', note.id)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Ошибка сохранения напоминания:', updateError);
          // Удаляем созданную задачу, чтобы не оставлять дубликат.
          await supabase
            .from('tasks')
            .delete()
            .eq('id', task.id)
            .eq('creator_id', user.id);

          processedReminders.current.delete(note.id);
        } else {
          await loadNotes();
        }
      }
    };

    if (notes.length > 0) {
      processReminders();
    }

    return () => {
      cancelled = true;
    };
  }, [notes, user.id]);

  const filteredNotes = searchQuery.trim()
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const todayStr = getMSKDateString();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek =
    firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const daysInMonth = lastDay.getDate();
  const calendarDays: (number | null)[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getDateString = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getNotesForDay = (day: number) => {
    const dateStr = getDateString(day);
    return filteredNotes.filter((n) => n.date === dateStr);
  };

  const prevMonth = () =>
    setCurrentMonth(new Date(year, month - 1, 1));

  const nextMonth = () =>
    setCurrentMonth(new Date(year, month + 1, 1));

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const selectedNotes = selectedDate
    ? filteredNotes.filter((n) => n.date === selectedDate)
    : [];

  const deleteNote = async (note: CalendarNoteView) => {
    if (!confirm('Удалить эту заметку?')) return;

    const { error: deleteError } = await supabase
      .from('calendar_notes')
      .delete()
      .eq('id', note.id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Ошибка удаления заметки:', deleteError);
      alert('Не удалось удалить заметку');
      return;
    }

    if (note.attachments.length > 0) {
      const paths = note.attachments
        .map((a) => a.file_path)
        .filter(Boolean);

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('synchron-calendar')
          .remove(paths);

        if (storageError) {
          console.error('Ошибка удаления файлов:', storageError);
        }
      }
    }

    processedReminders.current.delete(note.id);
    await loadNotes();
  };

  const removeAttachment = async (
    note: CalendarNoteView,
    index: number
  ) => {
    const attachment = note.attachments[index];
    if (!attachment) return;

    const updatedAttachments = note.attachments.filter(
      (_, i) => i !== index
    );

    const { error: updateError } = await supabase
      .from('calendar_notes')
      .update({ attachments: updatedAttachments })
      .eq('id', note.id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Ошибка обновления вложений:', updateError);
      alert('Не удалось удалить вложение');
      return;
    }

    if (attachment.file_path) {
      const { error: storageError } = await supabase.storage
        .from('synchron-calendar')
        .remove([attachment.file_path]);

      if (storageError) {
        console.error('Ошибка удаления файла:', storageError);
      }
    }

    await loadNotes();
  };

  const downloadAttachment = async (attachment: CalendarAttachment) => {
    const { data, error: urlError } = await supabase.storage
      .from('synchron-calendar')
      .createSignedUrl(attachment.file_path, 60);

    if (urlError || !data?.signedUrl) {
      console.error('Ошибка получения ссылки:', urlError);
      alert('Не удалось открыть файл');
      return;
    }

    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = attachment.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4 max-w-md">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск заметок..."
        />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card-light rounded-xl p-8 text-center text-gray-500">
          Загрузка календаря...
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="card-light rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevMonth}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <h3 className="text-gray-800 font-semibold text-lg">
                  {monthNames[month]} {year}
                </h3>

                <button
                  onClick={nextMonth}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((d) => (
                  <div
                    key={d}
                    className="text-center text-gray-500 text-xs font-medium py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={idx} className="aspect-square" />;
                  }

                  const dateStr = getDateString(day);
                  const dayNotes = getNotesForDay(day);
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition relative ${
                        isToday
                          ? 'bg-indigo-100 border border-indigo-300 text-indigo-700'
                          : isSelected
                          ? 'bg-purple-100 border border-purple-300 text-purple-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>{day}</span>

                      {dayNotes.length > 0 && (
                        <div className="absolute bottom-1 flex gap-0.5">
                          {dayNotes.slice(0, 3).map((n, i) => (
                            <div
                              key={`${n.id}-${i}`}
                              className={`w-1.5 h-1.5 rounded-full ${
                                n.recurring ? 'bg-amber-500' : 'bg-indigo-500'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-4 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  Разовое
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Ежемесячное
                </span>
              </div>
            </div>
          </div>

          <div className="lg:w-80">
            <div className="card-light rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-800 font-semibold">
                  {selectedDate
                    ? `Заметки на ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                      })}`
                    : 'Выберите дату'}
                </h3>

                {selectedDate && (
                  <button
                    onClick={() => setShowAddNote(true)}
                    className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition shadow-md"
                    title="Добавить заметку"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>

              {!selectedDate ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  Нажмите на дату в календаре
                </p>
              ) : selectedNotes.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  Нет заметок на эту дату
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedNotes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 rounded-lg border ${
                        note.recurring
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-indigo-50 border-indigo-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800 text-sm font-medium">
                            {note.title}
                          </p>

                          <p className="text-gray-600 text-xs mt-1">
                            {note.time && `🕐 ${note.time}`}
                            {note.recurring && ' • 🔄 Ежемесячно'}
                            {note.remindDaysBefore > 0 &&
                              ` • ⏰ За ${note.remindDaysBefore} дн.`}
                          </p>

                          {note.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {note.attachments.map((att, idx) => (
                                <div
                                  key={`${att.file_path}-${idx}`}
                                  className="flex items-center gap-2 p-1.5 bg-white rounded"
                                >
                                  <span className="text-xs flex-shrink-0">
                                    {getFileIcon(att.name)}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => downloadAttachment(att)}
                                    className="flex-1 min-w-0 text-left"
                                  >
                                    <span className="text-xs text-indigo-600 truncate block">
                                      {att.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {formatFileSize(att.size)}
                                    </span>
                                  </button>

                                  <button
                                    onClick={() => removeAttachment(note, idx)}
                                    className="text-gray-400 hover:text-red-500 transition"
                                    title="Удалить вложение"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1 ml-2">
                          <NoteAttachButton
                            userId={user.id}
                            note={note}
                            onAttached={loadNotes}
                          />

                          <button
                            onClick={() => deleteNote(note)}
                            className="text-gray-400 hover:text-red-500 transition"
                            title="Удалить заметку"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddNote && selectedDate && (
        <AddNoteModal
          user={user}
          date={selectedDate}
          onClose={() => setShowAddNote(false)}
          onAdded={async () => {
            setShowAddNote(false);
            await loadNotes();
          }}
        />
      )}
    </div>
  );
}

function AddNoteModal({
  user,
  date,
  onClose,
  onAdded,
}: {
  user: User;
  date: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [remindDaysBefore, setRemindDaysBefore] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setSaving(true);
    setError('');

    const { error: insertError } = await supabase
      .from('calendar_notes')
      .insert({
        user_id: user.id,
        title: title.trim(),
        date,
        time: time || null,
        recurring,
        remind_days_before: remindDaysBefore,
        task_id: null,
        attachments: [],
      });

    setSaving(false);

    if (insertError) {
      console.error('Ошибка создания заметки:', insertError);
      setError('Не удалось сохранить заметку');
      return;
    }

    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-light rounded-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Новая заметка на{' '}
          {new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Название заметки
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
              Время (необязательно)
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
              />
              <span className="text-gray-700 text-sm">
                Ежемесячно
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Напомнить за сколько дней до события?
            </label>
            <input
              type="number"
              value={remindDaysBefore}
              onChange={(e) =>
                setRemindDaysBefore(
                  Math.max(0, Math.min(30, parseInt(e.target.value) || 0))
                )
              }
              min={0}
              max={30}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition font-medium shadow-md disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoteAttachButton({
  userId,
  note,
  onAttached,
}: {
  userId: string;
  note: CalendarNoteView;
  onAttached: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedFile(file.name)) {
      alert('Формат файла не поддерживается');
      e.target.value = '';
      return;
    }

    setUploading(true);

    const safeName = file.name.replace(/[^\w.\-а-яА-ЯёЁ]/g, '_');
    const filePath =
      `${userId}/${note.id}-${crypto.randomUUID()}-${safeName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('synchron-calendar')
        .upload(filePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const newAttachment: CalendarAttachment = {
        name: file.name,
        size: file.size,
        type: file.type,
        file_path: filePath,
      };

      const updatedAttachments = [
        ...note.attachments,
        newAttachment,
      ];

      const { error: updateError } = await supabase
        .from('calendar_notes')
        .update({ attachments: updatedAttachments })
        .eq('id', note.id)
        .eq('user_id', userId);

      if (updateError) {
        await supabase.storage
          .from('synchron-calendar')
          .remove([filePath]);

        throw updateError;
      }

      await onAttached();
    } catch (error) {
      console.error('Ошибка загрузки файла:', error);
      alert('Не удалось прикрепить файл');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="text-gray-400 hover:text-indigo-600 transition disabled:opacity-50"
        title={uploading ? 'Загрузка...' : 'Прикрепить файл'}
      >
        {uploading ? (
          <span className="text-xs">...</span>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        )}
      </button>
    </>
  );
}
