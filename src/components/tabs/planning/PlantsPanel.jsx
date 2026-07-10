// src/components/PlantsPanel.jsx  (FieldInventoryPanel)
import React, { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PlantImage from './PlantImage';
import '../inventory/FieldInventoryPanel.css';

function PlantsPanel({
  rows = [],
  filters = { search: '', category: 'all', strata: 'all', hardiness: 'all', limit: 10 },
  options = { categories: [], strata: [], hardinessZones: [] },
  pagination = { page: 1, totalPages: 1, total: 0, hasPrev: false, hasNext: false },
  onSearch,
  onCategoryChange,
  onStrataChange,
  onHardinessChange,
  onLimitChange,
  onPageChange,
  onReload,
  isLoading = false,
}) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const { t } = useTranslation();

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (onSearch) onSearch(searchInput.trim());
  };

  const toggleRow = (id) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <span>{t('Treeline Plants Explorer', 'Treeline Plants Explorer')}</span>
        <button className="refresh-btn" type="button" onClick={onReload} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} style={{ marginRight: '6px' }} />
          {isLoading ? t('Loading...', 'Loading...') : t('Reload CSV', 'Reload CSV')}
        </button>
      </div>

      <div className="table-toolbar">
        <form className="search-wrap" onSubmit={handleSearchSubmit}>
          <input className="table-control" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('Search species...', 'Search species...')} />
          <button className="search-btn" type="submit">{t('Search', 'Search')}</button>
        </form>

        <select className="table-control" value={filters.category}
          onChange={(e) => onCategoryChange && onCategoryChange(e.target.value)}>
          <option value="all">{t('All types', 'All types')}</option>
          {(options?.categories || []).map((c) => <option key={c} value={c}>{t(c, c)}</option>)}
        </select>

        <select className="table-control" value={filters.strata}
          onChange={(e) => onStrataChange && onStrataChange(e.target.value)}>
          <option value="all">{t('All strata', 'All strata')}</option>
          {(options?.strata || []).map((s) => <option key={s} value={s}>{t(s, s)}</option>)}
        </select>

        <select className="table-control" value={filters.hardiness || 'all'}
          onChange={(e) => onHardinessChange && onHardinessChange(e.target.value)}>
          <option value="all">{t('All zones', 'All zones')}</option>
          {(options?.hardinessZones || []).map((z) => (
            <option key={z} value={z}>{t('Zone', 'Zone')} {z}</option>
          ))}
        </select>

        <select className="table-control" value={String(filters.limit)}
          onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}>
          <option value="10">10 {t('rows', 'rows')}</option>
          <option value="20">20 {t('rows', 'rows')}</option>
          <option value="50">50 {t('rows', 'rows')}</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>{t('ID', 'ID')}</th>
            <th>{t('Plant Species', 'Plant Species')}</th>
            <th>{t('Type', 'Type')}</th>
            <th>{t('Strata', 'Strata')}</th>
            <th>{t('Hardiness', 'Hardiness')}</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((log) => (
            <React.Fragment key={log.id}>
              {/* ── Summary row ── */}
              <tr
                onClick={() => toggleRow(log.id)}
                style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                className={expandedRowId === log.id ? 'active-row' : ''}
              >
                <td>{expandedRowId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                <td className="field-id">{log.id}</td>
                <td>
                  <strong>{t(log.name, log.name)}</strong><br />
                  <small className="crop-name">{t(log.crop, log.crop)}</small>
                </td>
                <td>{t(log.category, log.category)}</td>
                <td>{t(log.strata, log.strata)}</td>
                <td>{t(log.hardiness, log.hardiness)}</td>
              </tr>

              {/* ── Expanded profile accordion ── */}
              {expandedRowId === log.id && (
                <tr style={{ backgroundColor: 'var(--panel-bg, #f8fafc)' }}>
                  <td colSpan={6} style={{ padding: '20px', borderBottom: '2px solid #e2e8f0' }}>

                    {/* Two-column layout: image left, details right */}
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                      {/* ── Plant photo with attribution ── */}
                      <PlantImage
                        sourceId={log.id}
                        size="panel"
                        alt={`${log.name} (${log.crop})`}
                      />

                      {/* ── Text details ── */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '1rem' }}>
                          {t('Plant Profile', 'Plant Profile')}
                        </h4>

                        <p style={{ margin: '6px 0', fontSize: '0.95rem' }}>
                          <strong>{t('Primary Purpose', 'Primary Purpose')}:</strong>{' '}
                          {t(
                            log.rawDetails?.purpose || log.rawDetails?.primary_use || 'Data not in CSV',
                            log.rawDetails?.purpose || log.rawDetails?.primary_use || 'Data not in CSV',
                          )}
                        </p>

                        <p style={{ margin: '6px 0', fontSize: '0.95rem' }}>
                          <strong>{t('Expected Calories', 'Expected Calories')}:</strong>{' '}
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {log.calories
                              ? log.calories.toLocaleString() + ` ${t('kcal/year', 'kcal/year')}`
                              : t('Data not in CSV', 'Data not in CSV')}
                          </span>
                        </p>

                        <details style={{ marginTop: '15px', fontSize: '0.8rem', color: '#64748b' }}>
                          <summary style={{ cursor: 'pointer' }}>
                            {t('View raw CSV record', 'View raw CSV record')}
                          </summary>
                          <pre style={{
                            backgroundColor: '#fff', padding: '10px', borderRadius: '4px',
                            overflowX: 'auto', marginTop: '10px',
                          }}>
                            {JSON.stringify(log.rawDetails, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>

                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}

          {(!rows || rows.length === 0) && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                {t('No plants found.', 'No plants found.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination-row">
        <div className="pagination-info">
          {pagination?.total > 0
            ? `${t('Showing page', 'Showing page')} ${pagination.page} ${t('of', 'of')} ${pagination.totalPages} (${pagination.total} ${t('records', 'records')})`
            : t('No records found for current filters', 'No records found for current filters')}
        </div>
        <div className="pagination-actions">
          <button className="pagination-btn" type="button"
            onClick={() => onPageChange && onPageChange(pagination.page - 1)}
            disabled={!pagination?.hasPrev || isLoading}>
            {t('Prev', 'Prev')}
          </button>
          <span className="page-count">{t('Page', 'Page')} {pagination?.page || 1}</span>
          <button className="pagination-btn" type="button"
            onClick={() => onPageChange && onPageChange(pagination.page + 1)}
            disabled={!pagination?.hasNext || isLoading}>
            {t('Next', 'Next')}
          </button>
        </div>
      </div>
    </section>
  );
}

export default PlantsPanel;