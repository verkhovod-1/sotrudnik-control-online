import { useState, useEffect, type FormEvent } from 'react';
import { User, Document, DocumentCategory } from '../types';
import { formatMSKDateTime, findUserById } from '../store';
import { supabase } from '../lib/supabase';
import SearchBar from './SearchBar';
import FileUpload, { FileDisplay } from './FileUpload';
import { formatFileSize, getFileIcon } from '../utils/files';

interface DocumentsProps {
  user: User;
}

interface CloudDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  uploaded_by: string;
  uploaded_at: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  file_path: string | null;
}

const BUCKET = 'synchron-files';

const categories: {
  id: DocumentCategory;
  label: string;
  icon: string;
}[] = [
  { id: 'contracts', label: 'Договорная документация', icon: '📝' },
  { id: 'reference', label: 'Информационно-справочные документы', icon: '📋' },
  { id: 'local_acts', label: 'Локальные нормативные акты', icon: '📜' },
  { id: 'org_orders', label: 'Организационно-распорядительные документы', icon: '📢' },
  { id: 'payments', label: 'Платёжные документы', icon: '💰' },
  { id: 'other', label: 'Разное', icon: '📁' },
];

function mapCloudDocument(doc: CloudDocument): Document {
  return {
    id: doc.id,
    name: doc.name,
    category: doc.category,
    uploadedBy: doc.uploaded_by,
    uploadedAt: doc.uploaded_at,
    fileName: doc.file_name,
    fileSize: doc.file_size ?? undefined,
    fileType: doc.file_type ?? undefined,
    fileData: undefined,
  };
}

export default function Documents({ user }: DocumentsProps) {
  const [activeCategory, setActiveCategory] =
    useState<DocumentCategory>('contracts');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    setError('');

    const { data, error: loadError } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (loadError) {
      console.error('Ошибка загрузки документов:', loadError);
      setError('Не удалось загрузить документы. Попробуйте обновить раздел.');
      setLoading(false);
      return;
    }

    const loaded = (data || []).map((item) =>
      mapCloudDocument(item as CloudDocument)
    );

    setAllDocuments(loaded);
    setLoading(false);
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      setDocuments(
        allDocuments.filter(
          (doc) =>
            doc.name.toLowerCase().includes(query) ||
            doc.fileName.toLowerCase().includes(query)
        )
      );
    } else {
      setDocuments(
        allDocuments.filter((doc) => doc.category === activeCategory)
      );
    }
  }, [activeCategory, searchQuery, allDocuments]);

  const handleDelete = async (doc: Document) => {
    const confirmed = window.confirm(
      `Удалить документ «${doc.name}»? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    setError('');

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id);

    if (dbError) {
      console.error('Ошибка удаления записи:', dbError);
      setError('Не удалось удалить документ. Проверьте права доступа.');
      return;
    }

    const cloudDoc = allDocuments.find((item) => item.id === doc.id);

    if (cloudDoc) {
      const { error: storageError } = await supabase
        .storage
        .from(BUCKET)
        .remove([`${doc.uploadedBy}/${doc.id}-${doc.fileName}`]);

      if (storageError) {
        console.error('Ошибка удаления файла из Storage:', storageError);
        setError(
          'Запись удалена, но файл не удалось удалить из хранилища.'
        );
      }
    }

    await loadDocuments();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-72 flex-shrink-0">
          <div className="card-light rounded-xl p-3">
            <h3 className="text-gray-800 font-semibold mb-3 px-2">
              Категории документов
            </h3>

            <div className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition text-sm ${
                    activeCategory === cat.id
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="flex-1">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-xl font-bold text-gray-800">
              {searchQuery.trim()
                ? `Результаты поиска: "${searchQuery}"`
                : categories.find((c) => c.id === activeCategory)?.label}
            </h3>

            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition text-sm font-medium shadow-md flex-shrink-0"
            >
              + Добавить документ
            </button>
          </div>

          <div className="mb-4 max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск документов..."
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 card-light rounded-xl">
              <p className="text-gray-500">Загрузка документов...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 card-light rounded-xl">
              <p className="text-gray-500">
                Документов в этой категории пока нет
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const uploader = findUserById(doc.uploadedBy);
                const icon = getFileIcon(doc.fileName);
                const size = doc.fileSize
                  ? formatFileSize(doc.fileSize)
                  : '';

                return (
                  <div
                    key={doc.id}
                    className="card-light rounded-xl p-4 flex items-center gap-4 hover-lift"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-2xl flex-shrink-0">
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-medium truncate">
                        {doc.name}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-gray-500 text-xs">
                        <span>{uploader?.name || 'Сотрудник'}</span>
                        <span>•</span>
                        <span>{formatMSKDateTime(doc.uploadedAt)}</span>
                        {size && (
                          <>
                            <span>•</span>
                            <span>{size}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <CloudFileActions document={doc} />

                    {(doc.uploadedBy === user.id ||
                      user.role === 'director' ||
                      user.role === 'admin') && (
                      <button
                        onClick={() => void handleDelete(doc)}
                        className="text-gray-400 hover:text-red-500 transition p-1"
                        title="Удалить документ"
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadDocModal
          user={user}
          category={activeCategory}
          onClose={() => setShowUpload(false)}
          onUploaded={async () => {
            setShowUpload(false);
            await loadDocuments();
          }}
        />
      )}
    </div>
  );
}

function CloudFileActions({ document: doc }: { document: Document }) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState('');
  const [previewName, setPreviewName] = useState('');

  // Освобождаем временный URL при закрытии окна
  // или при открытии другого файла.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const getFileBlob = async (): Promise<Blob | null> => {
    const path = `${doc.uploadedBy}/${doc.id}-${doc.fileName}`;

    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .download(path);

    if (error || !data) {
      console.error('Ошибка скачивания файла:', error);
      window.alert('Не удалось получить файл из хранилища.');
      return null;
    }

    return data;
  };

  const handlePreview = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const blob = await getFileBlob();
      if (!blob) return;

      const url = URL.createObjectURL(blob);

      setPreviewType(blob.type || doc.fileType || '');
      setPreviewName(doc.fileName);
      setPreviewUrl(url);
    } finally {
      setBusy(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewUrl(null);
    setPreviewType('');
    setPreviewName('');
  };

  const handleDownload = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const blob = await getFileBlob();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');

      link.href = url;
      link.download = doc.fileName;

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    if (busy) return;

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      window.alert('Разрешите открытие всплывающих окон для печати.');
      return;
    }

    setBusy(true);

    try {
      const blob = await getFileBlob();

      if (!blob) {
        printWindow.close();
        return;
      }

      const url = URL.createObjectURL(blob);
      printWindow.location.href = url;

      printWindow.onload = () => {
        printWindow.print();
      };

      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } finally {
      setBusy(false);
    }
  };

  const isPdf =
    previewType === 'application/pdf' ||
    previewName.toLowerCase().endsWith('.pdf');

  const isImage = previewType.startsWith('image/');
  const isAudio = previewType.startsWith('audio/');
  const isVideo = previewType.startsWith('video/');
  const isText = previewType.startsWith('text/');

  return (
    <>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => void handlePreview()}
          disabled={busy}
          className="text-gray-400 hover:text-indigo-600 transition p-1 disabled:opacity-40"
          title="Открыть документ"
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
              d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
            />
            <circle cx="12" cy="12" r="3" strokeWidth={2} />
          </svg>
        </button>

        <button
          onClick={() => void handleDownload()}
          disabled={busy}
          className="text-gray-400 hover:text-indigo-600 transition p-1 disabled:opacity-40"
          title="Скачать"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>

        <button
          onClick={() => void handlePrint()}
          disabled={busy}
          className="text-gray-400 hover:text-green-600 transition p-1 disabled:opacity-40"
          title="Печать"
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
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H9v4zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
        </button>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
              <p className="font-semibold text-gray-800 truncate">
                {previewName}
              </p>

              <button
                onClick={handleClosePreview}
                className="text-gray-500 hover:text-red-600 text-2xl leading-none px-2"
                title="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto bg-gray-100 flex items-center justify-center p-3">
              {isImage ? (
                <img
                  src={previewUrl}
                  alt={previewName}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              ) : isPdf ? (
                <iframe
                  src={previewUrl}
                  title={previewName}
                  className="w-full h-[75vh] bg-white"
                />
              ) : isAudio ? (
                <audio
                  controls
                  src={previewUrl}
                  className="w-full max-w-xl"
                />
              ) : isVideo ? (
                <video
                  controls
                  src={previewUrl}
                  className="max-w-full max-h-[75vh]"
                />
              ) : isText ? (
                <iframe
                  src={previewUrl}
                  title={previewName}
                  className="w-full h-[75vh] bg-white"
                />
              ) : (
                <div className="text-center p-6">
                  <div className="text-5xl mb-4">📄</div>

                  <p className="text-gray-700 font-medium mb-2">
                    Предпросмотр этого формата не поддерживается
                  </p>

                  <p className="text-gray-500 text-sm mb-4">
                    Скачайте файл, чтобы открыть его на устройстве.
                  </p>

                  <button
                    onClick={() => void handleDownload()}
                    disabled={busy}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Скачать файл
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function UploadDocModal({
  user,
  category,
  onClose,
  onUploaded,
}: {
  user: User;
  category: DocumentCategory;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);

    if (!name) {
      setName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim() || !selectedFile || uploading) return;

    setUploading(true);
    setError('');

    let uploadedPath = '';

    try {
      const documentId = crypto.randomUUID();

      const safeFileName = selectedFile.name.replace(/[\\/]/g, '_');
      uploadedPath = `${user.id}/${documentId}-${safeFileName}`;

      const { error: uploadError } = await supabase
        .storage
        .from(BUCKET)
        .upload(uploadedPath, selectedFile, {
          upsert: false,
          contentType: selectedFile.type || 'application/octet-stream',
        });

      if (uploadError) {
        throw new Error(`Не удалось загрузить файл: ${uploadError.message}`);
      }

      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          name: name.trim(),
          category,
          uploaded_by: user.id,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          file_type: selectedFile.type || null,
          file_path: uploadedPath,
        });

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);
        uploadedPath = '';

        throw new Error(
          `Файл загружен, но запись не сохранена: ${insertError.message}`
        );
      }

      await onUploaded();
    } catch (err) {
      console.error('Ошибка добавления документа:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось добавить документ. Попробуйте ещё раз.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-light rounded-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Добавить документ
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Файл
            </label>

            <FileUpload onFileSelect={handleFileSelect} />

            {selectedFile && (
              <div className="mt-3">
                <FileDisplay
                  file={{
                    name: selectedFile.name,
                    size: selectedFile.size,
                  }}
                  onRemove={() => setSelectedFile(null)}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Название документа
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm break-words">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Отмена
            </button>

            <button
              type="submit"
              className="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition font-medium shadow-md disabled:opacity-50"
              disabled={!selectedFile || !name.trim() || uploading}
            >
              {uploading ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}