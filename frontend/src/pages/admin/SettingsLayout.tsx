import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const tabs = [
  { to: '/settings/users', key: 'admin.users' },
  { to: '/settings/categories', key: 'admin.categories' },
  { to: '/settings/institutions', key: 'admin.institutions' },
  { to: '/settings/tags', key: 'admin.tags' },
  { to: '/settings/custom-fields', key: 'admin.customFields' },
  { to: '/settings/assets', key: 'admin.assets' },
  { to: '/settings/audit', key: 'admin.auditLog' },
];

export default function SettingsLayout() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{t('admin.settings')}</h1>
      <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200 pb-2">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `px-3 py-1.5 text-sm rounded-lg ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
