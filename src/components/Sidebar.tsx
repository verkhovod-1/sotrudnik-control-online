
import { User } from '../types';
import type { ReactNode } from 'react';

type Section =
  | 'tasks'
  | 'all-tasks'
  | 'documents'
  | 'chat'
  | 'calendar'
  | 'admin';

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  user: User;
  unreadMessages: number;
}

type IconName =
  | 'tasks'
  | 'team'
  | 'documents'
  | 'chat'
  | 'calendar'
  | 'settings';

function MenuIcon({ name }: { name: IconName }) {
  const gradientId = `icon-gradient-${name}`;
  const fillId = `icon-fill-${name}`;

  const paths: Record<IconName, ReactNode> = {
    tasks: (
      <>
        <rect
          x="5"
          y="4"
          width="14"
          height="17"
          rx="3"
          fill={`url(#${fillId})`}
          opacity=".2"
        />
        <path
          d="M9 4.5h6a1.5 1.5 0 011.5 1.5v1h-9V6A1.5 1.5 0 019 4.5z"
          fill={`url(#${fillId})`}
        />
        <path
          d="M8 11l1.5 1.5L12 10M14 12h2.5M8 16l1.5 1.5L12 15M14 17h2.5"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),

    team: (
      <>
        <circle cx="9" cy="8" r="3.2" fill={`url(#${fillId})`} />
        <circle
          cx="17"
          cy="9"
          r="2.5"
          fill={`url(#${fillId})`}
          opacity=".8"
        />
        <path
          d="M3.5 19c.3-3.5 2.2-5.5 5.5-5.5s5.2 2 5.5 5.5z"
          fill={`url(#${fillId})`}
        />
        <path
          d="M14 14c3.8-.8 6.2 1.1 6.5 4.5h-5"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),

    documents: (
      <>
        <path
          d="M4 8.5V6.8A2.8 2.8 0 016.8 4h4l2 2h4.4A2.8 2.8 0 0120 8.8v8.4a2.8 2.8 0 01-2.8 2.8H6.8A2.8 2.8 0 014 17.2z"
          fill={`url(#${fillId})`}
          opacity=".3"
        />
        <path
          d="M4 9h16l-1.5 8.5a2.5 2.5 0 01-2.5 2H7a2.5 2.5 0 01-2.5-2z"
          fill={`url(#${fillId})`}
        />
        <path
          d="M8 12.5h8M8 16h5"
          stroke="#fff"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity=".9"
        />
      </>
    ),

    chat: (
      <>
        <path
          d="M4 6.5A3.5 3.5 0 017.5 3h9A3.5 3.5 0 0120 6.5v5a3.5 3.5 0 01-3.5 3.5H11l-4.5 3v-3.2A3.5 3.5 0 014 11.5z"
          fill={`url(#${fillId})`}
        />
        <circle cx="9" cy="9" r="1.1" fill="#fff" />
        <circle cx="12" cy="9" r="1.1" fill="#fff" />
        <circle cx="15" cy="9" r="1.1" fill="#fff" />
        <path
          d="M8 19h8"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),

    calendar: (
      <>
        <rect
          x="4"
          y="5.5"
          width="16"
          height="15"
          rx="3"
          fill={`url(#${fillId})`}
          opacity=".25"
        />
        <rect
          x="4"
          y="7.5"
          width="16"
          height="13"
          rx="2.5"
          fill={`url(#${fillId})`}
        />
        <path
          d="M8 4v5M16 4v5M4.5 11h15"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M8 14h2M14 14h2M8 17h2M14 17h2"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity=".9"
        />
      </>
    ),

    settings: (
      <>
        <path
          d="M10 3.5h4l.7 2.2 1.8 1 2.2-.5 2 3.5-1.5 1.7v2l1.5 1.7-2 3.5-2.2-.5-1.8 1-.7 2.2h-4l-.7-2.2-1.8-1-2.2.5-2-3.5 1.5-1.7v-2L3.3 9.7l2-3.5 2.2.5 1.8-1z"
          fill={`url(#${fillId})`}
        />
        <circle
          cx="12"
          cy="12"
          r="3.2"
          fill="#172554"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.8"
        />
      </>
    ),
  };

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0 drop-shadow-sm"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset=".5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>

        <linearGradient
          id={fillId}
          x1="4"
          y1="3"
          x2="20"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset=".55" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      {paths[name]}
    </svg>
  );
}

export default function Sidebar({
  activeSection,
  onSectionChange,
  user,
  unreadMessages,
}: SidebarProps) {
  const menuItems: {
    id: Section;
    label: string;
    icon: IconName;
    show: boolean;
  }[] = [
    {
      id: 'tasks',
      label: 'Мои задачи',
      icon: 'tasks',
      show: true,
    },
    {
      id: 'all-tasks',
      label: 'Все задачи',
      icon: 'team',
      show: true,
    },
    {
      id: 'documents',
      label: 'Документы и файлы',
      icon: 'documents',
      show: true,
    },
    {
      id: 'chat',
      label: 'Чат',
      icon: 'chat',
      show: true,
    },
    {
      id: 'calendar',
      label: 'Календарь',
      icon: 'calendar',
      show: true,
    },
    {
      id: 'admin',
      label: 'Управление',
      icon: 'settings',
      show: user.role === 'director' || user.role === 'admin',
    },
  ];

  return (
    <aside className="w-64 bg-gray-100 border-r border-gray-200 flex flex-col flex-shrink-0 relative z-10">
      <div className="p-4 border-b border-gray-300">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="Логотип Синхрон"
            className="w-20 h-20 rounded-2xl object-contain flex-shrink-0"
          />
          <div>
            <h1 className="text-gray-800 font-bold text-lg">
              Синхрон
            </h1>
            <p className="text-gray-500 text-xs">CRM система</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) =>
          item.show ? (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                activeSection === item.id
                  ? 'bg-gradient-to-r from-indigo-100 via-blue-50 to-purple-100 text-indigo-800 border border-indigo-300 shadow-[0_0_14px_rgba(99,102,241,0.22)] scale-[1.02]'
                  : 'text-gray-600 hover:bg-gray-200/80 hover:shadow-sm hover:translate-x-0.5'
              }`}
            >
              <MenuIcon name={item.icon} />

              <span className="text-sm font-medium flex-1 text-left">
                {item.label}
              </span>

              {item.id === 'chat' && unreadMessages > 0 && (
                <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
          ) : null
        )}
      </nav>

      <div className="p-4 border-t border-gray-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {user.name.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-gray-800 text-sm font-medium truncate">
              {user.name.split(' ').slice(0, 2).join(' ')}
            </p>
            <p className="text-gray-500 text-xs truncate">
              {user.email}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
