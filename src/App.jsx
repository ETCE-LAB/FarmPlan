import { useMemo, useState, useEffect, useCallback } from 'react';
import './App.css';
import Sidebar from './components/shared/Sidebar';
import TopBar from './components/shared/TopBar';
import StatsRow from './components/tabs/overview/StatsRow';
import SoilLookupPanel from './components/tabs/overview/SoilLookupPanel';
import YieldChartPanel from './components/tabs/planning/YieldChartPanel';
import FarmCreationPanel from './components/tabs/planning/FarmCreationPanel';
import FarmEditPanel from './components/tabs/editing/FarmEditPanel';
import ThemeConfigurationPanel from './components/tabs/settings/ThemeConfigurationPanel';
import PlantsPanel from './components/tabs/planning/PlantsPanel';
import FieldInventoryPanel from './components/tabs/inventory/FieldInventoryPanel'; 
import { useTranslation } from 'react-i18next';

import { getTreelineRecords, importTreelineCsv, getFarms, createFarm, updateFarmById, deleteFarmById } from './utils/dashboardApi';
import { DASHBOARD_TABS, DEFAULT_TAB_ID, getDashboardTab } from './config/dashboardTabs';
import { buildThemeVariables, DARK_THEME_DEFAULTS, LIGHT_THEME_DEFAULTS } from './utils/themeVariables';

function App() {
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState(DEFAULT_TAB_ID);
  const [farms, setFarms] = useState([]);
  const [theme, setTheme] = useState(LIGHT_THEME_DEFAULTS);
  const [tableData, setTableData] = useState({ records: [], options: { categories: [], strata: [], hardinessZones: [] }, pagination: { page: 1, limit: 10, total: 0 } });

  const [tableFilters, setTableFilters] = useState({ search: '', category: 'all', strata: 'all', hardiness: 'all', page: 1, limit: 10 });

  const [isTableLoading, setIsTableLoading] = useState(false);

  const themeVariables = useMemo(() => buildThemeVariables(theme), [theme]);
  const currentTab = getDashboardTab(activeTab);

  const loadFarms = useCallback(async () => {
    try {
      const payload = await getFarms();
      setFarms(payload.farms || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const loadTableData = useCallback(async (filters) => {
    setIsTableLoading(true);
    try {
      const payload = await getTreelineRecords(filters);
      setTableData(prev => ({ 
        ...prev, 
        records: payload.records || [], 
        options: payload.options || { categories: [], strata: [], hardinessZones: [] },
        pagination: payload.pagination 
      }));
    } catch (e) { console.error(e); }
    finally { setIsTableLoading(false); }
  }, []);

  const handleForceReload = async () => {
    setIsTableLoading(true);
    try {
      await importTreelineCsv(); 
      await loadTableData(tableFilters); 
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsTableLoading(false); 
    }
  };

  useEffect(() => { loadTableData(tableFilters); }, [tableFilters, loadTableData]);

  const handleCreateFarm = async (newFarm) => {
    const { id: _id, ...data } = newFarm;
    const payload = await createFarm({ ...data, fields: [], template: null });
    const created = payload.farm;
    if (created) {
      setFarms((prev) => [created, ...prev]);
      return created.id;
    }
    return null;
  };

  const handleUpdateFarm = async (updatedFarm) => {
    const { id, ...data } = updatedFarm;
    const payload = await updateFarmById(id, data);
    const saved = payload.farm;
    if (saved) {
      setFarms((prev) => prev.map((farm) => (farm.id === saved.id ? saved : farm)));
    }
  };

  const handleDeleteFarm = async (id) => {
    await deleteFarmById(id);
    setFarms((prev) => prev.filter((farm) => farm.id !== id));
  };

  const meta = {
    title: t(currentTab.titleKey, currentTab.defaultTitle),
    subtitle: t(currentTab.subtitleKey, currentTab.defaultSubtitle),
  };

  return (
    <div key={i18n.language} className={`layout theme-${theme.mode}`} style={themeVariables}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} tabs={DASHBOARD_TABS} />
      
      <main className="main-panel">
        <TopBar />
        
        <div className="dashboard-container">
          <div className="page-header">
            <h2>{meta.title}</h2>
            <p className="page-subtitle"><span>●</span> {meta.subtitle}</p>
          </div>

          {activeTab === 'overview' && (
            <div className="overview-section">
              <StatsRow farms={farms} />
              <div className="content-grid">
                <FieldInventoryPanel farms={farms} />
                <div className="panel-column">
                  <SoilLookupPanel farms={farms} />
                  <YieldChartPanel farms={farms} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'farm-create' && (
            <FarmCreationPanel
              onCreateFarm={handleCreateFarm}
              farms={farms}
              onUpdateFarm={handleUpdateFarm}
            />
          )}

          {activeTab === 'farm-edit' && (
            <FarmEditPanel farms={farms} onUpdateFarm={handleUpdateFarm} onDeleteFarm={handleDeleteFarm} />
          )}

          {activeTab === 'plants' && (
            <PlantsPanel
              rows={tableData.records}
              filters={tableFilters}
              options={tableData.options}
              pagination={tableData.pagination}
              onSearch={(val) => setTableFilters(prev => ({ ...prev, search: val, page: 1 }))}
              onCategoryChange={(val) => setTableFilters(prev => ({ ...prev, category: val, page: 1 }))}
              onStrataChange={(val) => setTableFilters(prev => ({ ...prev, strata: val, page: 1 }))}
              onHardinessChange={(val) => setTableFilters(prev => ({ ...prev, hardiness: val, page: 1 }))} 
              onLimitChange={(val) => setTableFilters(prev => ({ ...prev, limit: val, page: 1 }))}
              onPageChange={(val) => setTableFilters(prev => ({ ...prev, page: val }))}
              onReload={handleForceReload} 
              isLoading={isTableLoading}
            />
          )}

          {activeTab === 'configuration' && (
            <ThemeConfigurationPanel 
              theme={theme} 
              onModeChange={() => setTheme(DARK_THEME_DEFAULTS)}
              onResetTheme={() => setTheme(LIGHT_THEME_DEFAULTS)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;