import { useState } from 'react';
import { MapPin, CheckCircle2, RefreshCw, Rows3 } from 'lucide-react';
import { useTranslation } from 'react-i18next'; 
import './FieldInventoryPanel.css';

function FieldInventoryPanel({
  farms = [],       // From Firebase
  rows = [],        // From Treeline/CSV
  filters = { search: '', category: 'all', strata: 'all', limit: 10, page: 1 },
  options = { categories: [], strata: [] },
  pagination = { total: 0, page: 1, totalPages: 1 },
  onSearch,
  onCategoryChange,
  onPageChange,
  onReload,
  isLoading = false,
}) {
  const { t } = useTranslation(); 
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (onSearch) onSearch(searchInput.trim());
  };

  return (
    <section className="panel">
      {/* SECTION 1: LIVE FARM INVENTORY (FIREBASE) */}
      <div className="panel-header">
        <span>{t('overview.inventory.title', 'Farm Inventory')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--farm-green-main)' }}>
          <CheckCircle2 size={14} />
          {t('overview.inventory.live', 'Live Sync')}
        </div>
      </div>
      
      <table className="inventory-table">
        <thead>
          <tr>
            <th>{t('overview.inventory.sector_id', 'Farm ID')}</th>
            <th>{t('overview.inventory.field_name', 'Farm Name')}</th>
            <th>{t('overview.inventory.area', 'Area')}</th>
            <th>{t('overview.inventory.location', 'Location')}</th>
          </tr>
        </thead>
        <tbody>
          {farms.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                {t('overview.inventory.empty', 'No farms created yet.')}
              </td>
            </tr>
          ) : (
            farms.map((farm) => (
              <tr key={farm.id}>
                <td className="field-id">#{farm.id.substring(0, 5).toUpperCase()}</td>
                <td>
                  <strong>{farm.farmName}</strong>
                  <br />
                  <small className="crop-name">{farm.ownerName}</small>
                </td>
                <td>{Number(farm.areaHectares || 0).toFixed(2)} {t('ha', 'ha')}</td>
                <td className="last-update">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> 
                    {farm.location || t('N/A', 'N/A')}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <hr className="panel-divider" style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--panel-divider)' }} />

      {/* SECTION 2: TREELINE PLANT SEARCH (CSV/DATABASE) */}
      <div className="panel-header" style={{ paddingTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Rows3 size={16} />
          <span>{t('Treeline Inventory (CSV)', 'Treeline Inventory (CSV)')}</span>
        </div>
        <button className="refresh-btn" type="button" onClick={onReload} disabled={isLoading}>
          <RefreshCw size={10} className={isLoading ? 'spin' : ''} /> 
          {isLoading ? t(' Loading...', ' Loading...') : t(' Reload CSV', ' Reload CSV')}
        </button>
      </div>

      <div className="table-toolbar">
        <form className="search-wrap" onSubmit={handleSearchSubmit}>
          <input
            className="table-control"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('Search plants...', 'Search plants...')}
          />
        </form>

        <select className="table-control" value={filters.category} onChange={(e) => onCategoryChange(e.target.value)}>
          <option value="all">{t('All categories', 'All categories')}</option>
          {options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <table className="inventory-table">
        <thead>
          <tr>
            <th>{t('ID', 'ID')}</th>
            <th>{t('Plant', 'Plant')}</th>
            <th>{t('Category', 'Category')}</th>
            <th>{t('Strata', 'Strata')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((log) => (
              <tr key={log.id}>
                <td className="field-id">{log.id}</td>
                <td>{log.name}<br/><small className="crop-name">{log.crop}</small></td>
                <td>{log.category}</td>
                <td>{log.strata}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={4} className="last-update">{t('No plant data found.', 'No plant data found.')}</td></tr>
          )}
        </tbody>
      </table>
      
      {/* PAGINATION */}
      <div className="pagination-row">
        <div className="pagination-info">{t('Page', 'Page')} {pagination.page} {t('of', 'of')} {pagination.totalPages}</div>
        <div className="pagination-actions">
          <button className="pagination-btn" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1 || isLoading}>{t('Prev', 'Prev')}</button>
          <button className="pagination-btn" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || isLoading}>{t('Next', 'Next')}</button>
        </div>
      </div>
    </section>
  );
}

export default FieldInventoryPanel;