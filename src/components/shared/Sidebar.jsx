import { LayoutDashboard, Map as MapIcon, ClipboardList, Edit, Settings, Sprout } from 'lucide-react';
import './Sidebar.css';
import { useTranslation } from 'react-i18next';

const TAB_ICONS = {
  overview: LayoutDashboard,
  'farm-create': MapIcon,
  'farm-edit': Edit,
  plants: Sprout,
  configuration: Settings,
};

function Sidebar({ activeTab, setActiveTab, tabs = [] }) {
  const { t } = useTranslation();

  const mainTabs = tabs.filter((tab) => tab.group === 'main');
  const bottomTabs = tabs.filter((tab) => tab.group === 'bottom');

  const renderTab = (tab) => {
    const Icon = TAB_ICONS[tab.id] || ClipboardList;

    return (
      <button
        type="button"
        key={tab.id}
        className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
        onClick={() => setActiveTab(tab.id)}
        aria-current={activeTab === tab.id ? 'page' : undefined}
      >
        <Icon size={18} /> {t(tab.labelKey, tab.defaultLabel)}
      </button>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1><Sprout size={24} /> {t('app_title', 'FarmPlan')}</h1>
      </div>

      <nav className="nav-links">
        {mainTabs.map(renderTab)}
      </nav>

      <div className="nav-bottom">
        {bottomTabs.map(renderTab)}
      </div>
    </aside>
  );
}

export default Sidebar;