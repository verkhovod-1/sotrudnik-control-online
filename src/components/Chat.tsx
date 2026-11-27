
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import SearchBar from './SearchBar';
import {
  formatFileSize,
  getFileIcon,
  isAllowedFile,
} from '../utils/files';
import { formatMSKDateTime } from '../store';

interface ChatProps {
  user: User;
}

interface Contact {
  id: string;
  full_name: string;
  email: string;
  role: 'director' | 'admin' | 'employee';
}

interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  file_path: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  timestamp: string;
  read: boolean;
  attachment: ChatAttachment | null;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function isAudioFile(filename: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg|flac|opus|amr|3gp|webm)$/i.test(filename);
}

function AudioAttachment({ file }: { file: ChatAttachment }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAudio = async () => {
      const { data, error } = await supabase.storage
        .from('synchron-chat')
        .createSignedUrl(file.file_path, 3600);

      if (cancelled) return;

      if (error || !data?.signedUrl) {
        setAudioError(true);
        return;
      }

      setAudioUrl(data.signedUrl);
    };

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [file.file_path]);

  if (audioError) {
    return (
      <p className="text-xs text-red-500 mt-2">
        Не удалось загрузить аудио
      </p>
    );
  }

  if (!audioUrl) {
    return (
      <p className="text-xs opacity-70 mt-2">
        Загрузка аудио...
      </p>
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      src={audioUrl}
      className="w-full mt-2"
    >
      Ваш браузер не поддерживает воспроизведение аудио.
    </audio>
  );
}

export default function Chat({ user }: ChatProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousLastMessageIdRef = useRef<string | null>(null);

  const selectedContact = contacts.find(
    (contact) => contact.id === selectedUser
  );

  const filteredContacts = contacts.filter((contact) => {
    const query = contactSearch.trim().toLowerCase();

    if (!query) return true;

    return (
      contact.full_name.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query)
    );
  });

  const filteredMessages = messages.filter((message) => {
    const query = messageSearch.trim().toLowerCase();

    if (!query) return true;

    return (
      message.text.toLowerCase().includes(query) ||
      message.attachment?.name.toLowerCase().includes(query)
    );
  });

  // Предварительное прослушивание аудиозаписи
  useEffect(() => {
    if (!attachment || !isAudioFile(attachment.name)) {
      setAttachmentPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(attachment);
    setAttachmentPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [attachment]);

  // Очистка микрофона и таймера при закрытии компонента
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Загрузка списка сотрудников
  const loadContacts = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_chat_contacts');

    if (error) {
      console.error('Ошибка загрузки сотрудников:', error);
      alert('Не удалось загрузить список сотрудников');
      return;
    }

    setContacts((data || []) as Contact[]);
  }, []);

  // Загрузка непрочитанных сообщений
  const loadUnreadCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('sender_id')
      .eq('receiver_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Ошибка загрузки непрочитанных сообщений:', error);
      return;
    }

    const counts: Record<string, number> = {};

    (data || []).forEach((message) => {
      counts[message.sender_id] =
        (counts[message.sender_id] || 0) + 1;
    });

    setUnreadCounts(counts);
  }, [user.id]);

  // Загрузка переписки
  const loadMessages = useCallback(async () => {
    if (!selectedUser) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser}),and(sender_id.eq.${selectedUser},receiver_id.eq.${user.id})`
      )
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки сообщений:', error);
      return;
    }

    setMessages((data || []) as ChatMessage[]);
  }, [selectedUser, user.id]);

  // Отметка входящих сообщений как прочитанных
  const markAsRead = useCallback(async () => {
    if (!selectedUser) return;

    const { error } = await supabase
      .from('chat_messages')
      .update({ read: true })
      .eq('sender_id', selectedUser)
      .eq('receiver_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Ошибка отметки прочтения:', error);
      return;
    }

    await loadUnreadCounts();
  }, [selectedUser, user.id, loadUnreadCounts]);

  // Первоначальная загрузка
  useEffect(() => {
    loadContacts();
    loadUnreadCounts();
  }, [loadContacts, loadUnreadCounts]);

  // Загрузка переписки и отметка прочтения
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      previousLastMessageIdRef.current = null;
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      await loadMessages();

      if (!cancelled) {
        await markAsRead();
      }
    };

    refresh();

    const interval = window.setInterval(async () => {
      if (!cancelled) {
        await loadMessages();
        await markAsRead();
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    selectedUser,
    loadMessages,
    markAsRead,
    loadUnreadCounts,
  ]);

  // Прокрутка только при появлении нового сообщения
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const previousId = previousLastMessageIdRef.current;

    if (previousId === null) {
      previousLastMessageIdRef.current = lastMessage.id;

      if (shouldAutoScrollRef.current) {
        requestAnimationFrame(() => {
          const container = messagesContainerRef.current;

          if (container && shouldAutoScrollRef.current) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }

      return;
    }

    if (previousId === lastMessage.id) {
      return;
    }

    previousLastMessageIdRef.current = lastMessage.id;

    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;

        if (container && shouldAutoScrollRef.current) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [messages]);

  // Выбор файла
  const handleFileAttach = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!isAllowedFile(file.name)) {
      alert('Формат файла не поддерживается');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('Максимальный размер файла — 25 МБ');
      e.target.value = '';
      return;
    }

    setAttachment(file);
    e.target.value = '';
  };

  // Начало записи голоса
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        alert('Запись голоса не поддерживается этим браузером.');
        return;
      }

      if (attachment) {
        alert('Сначала отправьте или удалите текущее вложение.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];

      const supportedType = mimeTypes.find(type =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        recordingStreamRef.current?.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        alert('Произошла ошибка во время записи.');
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';

        const extension = mimeType.includes('mp4')
          ? 'm4a'
          : mimeType.includes('ogg')
            ? 'ogg'
            : 'webm';

        const audioBlob = new Blob(recordingChunksRef.current, {
          type: mimeType,
        });

        if (audioBlob.size > MAX_FILE_SIZE) {
          alert('Запись слишком большая. Максимальный размер — 25 МБ.');
        } else if (audioBlob.size > 0) {
          const audioFile = new File(
            [audioBlob],
            `voice-${Date.now()}.${extension}`,
            { type: mimeType }
          );

          setAttachment(audioFile);
        } else {
          alert('Запись получилась пустой. Попробуйте ещё раз.');
        }

        setIsRecording(false);

        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        setRecordingTime(0);

        recordingStreamRef.current?.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      recorder.start();
      recordingStartRef.current = Date.now();
      setRecordingTime(0);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(
          Math.floor((Date.now() - recordingStartRef.current) / 1000)
        );
      }, 1000);
    } catch (error) {
      console.error('Ошибка записи голоса:', error);

      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      setIsRecording(false);
      alert('Не удалось включить микрофон. Проверьте разрешение на его использование.');
    }
  };

  // Остановка записи
  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  // Отправка сообщения
  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if ((!messageText.trim() && !attachment) || !selectedUser) {
      return;
    }

    if (sending || isRecording) return;

    setSending(true);

    let uploadedPath: string | null = null;

    try {
      let attachmentData: ChatAttachment | null = null;

      if (attachment) {
        const safeName = attachment.name
          .normalize('NFKD')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/_+/g, '_');

        const filePath =
          `${user.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('synchron-chat')
          .upload(filePath, attachment, {
            cacheControl: '3600',
            upsert: false,
            contentType: attachment.type || 'application/octet-stream',
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedPath = filePath;

        attachmentData = {
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          file_path: filePath,
        };
      }

      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser,
          text: messageText.trim(),
          read: false,
          attachment: attachmentData,
        });

      if (insertError) {
        throw insertError;
      }

      setMessageText('');
      setAttachment(null);

      shouldAutoScrollRef.current = true;

      await loadMessages();
      await loadUnreadCounts();
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);

      if (uploadedPath) {
        const { error: removeError } = await supabase.storage
          .from('synchron-chat')
          .remove([uploadedPath]);

        if (removeError) {
          console.error('Не удалось удалить файл:', removeError);
        }
      }

      alert(
        'Ошибка отправки: ' +
        (error instanceof Error
          ? error.message
          : JSON.stringify(error))
      );
    } finally {
      setSending(false);
    }
  };

  // Удаление собственного сообщения
  const handleDeleteMessage = async (msg: ChatMessage) => {
    const confirmed = window.confirm(
      'Удалить это сообщение у обоих участников?'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', msg.id)
        .eq('sender_id', user.id);

      if (error) {
        throw error;
      }

      if (msg.attachment?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('synchron-chat')
          .remove([msg.attachment.file_path]);

        if (storageError) {
          console.error('Ошибка удаления вложения:', storageError);
        }
      }

      await loadMessages();
      await loadUnreadCounts();
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
      alert(
        'Не удалось удалить сообщение: ' +
        (error instanceof Error
          ? error.message
          : JSON.stringify(error))
      );
    }
  };

  // Скачивание вложения
  const handleDownload = async (file: ChatAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('synchron-chat')
        .createSignedUrl(file.file_path, 60);

      if (error || !data?.signedUrl) {
        throw error || new Error('Не удалось получить ссылку');
      }

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = file.name;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Не удалось скачать вложение');
    }
  };

  const getRoleName = (role: string) => {
    if (role === 'director') return 'Управляющий';
    if (role === 'admin') return 'Администратор';
    return 'Сотрудник';
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-180px)]">
      <div className="flex card-light rounded-xl h-full overflow-hidden">

        {/* Список сотрудников */}
        <div
          className={`w-full md:w-80 border-r border-gray-200 flex flex-col ${
            selectedUser ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-gray-800 font-semibold">
              Сотрудники
            </h3>

            <p className="text-gray-600 text-xs mt-1">
              Выберите сотрудника для чата
            </p>

            <div className="mt-2">
              <SearchBar
                value={contactSearch}
                onChange={setContactSearch}
                placeholder="Поиск сотрудника..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {contacts.length === 0
                  ? 'Пока нет других сотрудников'
                  : 'Ничего не найдено'}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const unread = unreadCounts[contact.id] || 0;

                return (
                  <button
                    key={contact.id}
                    onClick={() => {
                      shouldAutoScrollRef.current = true;
                      previousLastMessageIdRef.current = null;

                      setUnreadCounts((prev) => ({
                        ...prev,
                        [contact.id]: 0,
                      }));

                      setSelectedUser(contact.id);
                      setMessageSearch('');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                      selectedUser === contact.id
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-2 border-indigo-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {contact.full_name?.charAt(0) || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-sm font-medium truncate">
                        {contact.full_name}
                      </p>

                      <p className="text-gray-500 text-xs">
                        {getRoleName(contact.role)}
                      </p>
                    </div>

                    {unread > 0 && (
                      <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Область переписки */}
        <div
          className={`flex-1 flex flex-col min-h-0 ${
            !selectedUser ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>

                <p className="text-gray-500">
                  Выберите сотрудника для начала диалога
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Заголовок переписки */}
              <div className="p-4 border-b border-gray-200 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="md:hidden text-gray-600 hover:text-gray-800"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                    {selectedContact?.full_name?.charAt(0) || '?'}
                  </div>

                  <div>
                    <p className="text-gray-800 font-medium text-sm">
                      {selectedContact?.full_name || 'Сотрудник'}
                    </p>

                    <p className="text-gray-500 text-xs">
                      Личный чат
                    </p>
                  </div>
                </div>

                <SearchBar
                  value={messageSearch}
                  onChange={setMessageSearch}
                  placeholder="Поиск по сообщениям..."
                />
              </div>

              {/* Сообщения */}
              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3"
                onScroll={(e) => {
                  const element = e.currentTarget;

                  shouldAutoScrollRef.current =
                    element.scrollHeight -
                    element.scrollTop -
                    element.clientHeight < 100;
                }}
              >
                {loading ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Загрузка сообщений...
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">
                      {messageSearch.trim()
                        ? 'Сообщения не найдены'
                        : 'Начните диалог'}
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isMe = msg.sender_id === user.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${
                          isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isMe
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-md shadow-md'
                              : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
                          }`}
                        >
                          {msg.text && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}

                          {msg.attachment && (
                            <div
                              className={`mt-1 p-2 rounded-lg ${
                                isMe ? 'bg-white/20' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg flex-shrink-0">
                                  {getFileIcon(msg.attachment.name)}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate">
                                    {msg.attachment.name}
                                  </p>

                                  <p
                                    className={`text-xs ${
                                      isMe
                                        ? 'text-indigo-100'
                                        : 'text-gray-500'
                                    }`}
                                  >
                                    {formatFileSize(msg.attachment.size)}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownload(msg.attachment!)
                                  }
                                  className="p-1 hover:opacity-70"
                                  title="Скачать файл"
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                </button>
                              </div>

                              {isAudioFile(msg.attachment.name) && (
                                <AudioAttachment file={msg.attachment} />
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3 mt-1">
                            <p
                              className={`text-xs ${
                                isMe ? 'text-indigo-100' : 'text-gray-500'
                              }`}
                            >
                              {formatMSKDateTime(msg.timestamp)}
                              {isMe && msg.read ? ' · Прочитано' : ''}
                            </p>

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg)}
                                className="text-indigo-100 hover:text-red-200 transition"
                                title="Удалить сообщение"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h14"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Форма отправки */}
              <form
                onSubmit={handleSend}
                className="p-4 border-t border-gray-200"
              >
                {attachment && (
                  <div className="mb-2 p-2 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {getFileIcon(attachment.name)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 text-sm truncate">
                          {attachment.name}
                        </p>

                        <p className="text-gray-500 text-xs">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="text-gray-400 hover:text-red-500 transition"
                        title="Удалить вложение"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {attachmentPreviewUrl && (
                      <audio
                        controls
                        preload="metadata"
                        src={attachmentPreviewUrl}
                        className="w-full mt-2"
                      >
                        Ваш браузер не поддерживает воспроизведение аудио.
                      </audio>
                    )}
                  </div>
                )}

                {isRecording && (
                  <div className="mb-2 text-red-600 text-sm font-medium">
                    <span className="animate-pulse">●</span>
                    {' '}Идёт запись: {Math.floor(recordingTime / 60)}:
                    {String(recordingTime % 60).padStart(2, '0')}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileAttach}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isRecording || sending}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-600 hover:text-indigo-600 transition rounded-lg hover:bg-gray-50 disabled:opacity-40"
                    title="Прикрепить файл"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    disabled={sending || (!isRecording && !!attachment)}
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 transition rounded-lg ${
                      isRecording
                        ? 'text-red-600 bg-red-50'
                        : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
                    } disabled:opacity-40`}
                    title={
                      isRecording
                        ? 'Остановить запись'
                        : 'Записать голосовое сообщение'
                    }
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v1a7 7 0 01-14 0v-1m7 8v4m-4 0h8"
                      />
                    </svg>
                  </button>

                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1 min-w-0 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Введите сообщение..."
                    disabled={isRecording}
                  />

                  <button
                    type="submit"
                    disabled={
                      sending ||
                      isRecording ||
                      (!messageText.trim() && !attachment)
                    }
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition shadow-md disabled:opacity-50"
                  >
                    {sending ? (
                      <span className="text-sm">...</span>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
