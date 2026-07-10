import { useTranslation } from 'react-i18next';
import './ThemeConfigurationPanel.css';

const THEME_COLOR_FIELDS = [
  {
    key: 'primary',
    label: 'Accent Color',
    description: 'Used for active states, buttons, and highlights.',
  },
  {
    key: 'sidebar',
    label: 'Sidebar Base',
    description: 'Main color for the left navigation area.',
  },
  {
    key: 'background',
    label: 'Page Background',
    description: 'Color behind all cards and panels.',
  },
  {
    key: 'panel',
    label: 'Card Surface',
    description: 'Background for cards and content blocks.',
  },
];

function ThemeConfigurationPanel({ theme, onModeChange, onColorChange, onResetTheme }) {
  const { t } = useTranslation();

  return (
    <section className="theme-settings-wrap">
      <article className="panel">
        <div className="panel-header">
          <span>{t('Theme Controls (Prototype)')}</span>
        </div>

        <div className="theme-mode-row">
          <p>{t('Mode')}</p>
          <div className="theme-mode-actions">
            <button
              type="button"
              className={`mode-btn ${theme.mode === 'light' ? 'active' : ''}`}
              onClick={() => onModeChange('light')}
            >
              {t('Light')}
            </button>
            <button
              type="button"
              className={`mode-btn ${theme.mode === 'dark' ? 'active' : ''}`}
              onClick={() => onModeChange('dark')}
            >
              {t('Dark')}
            </button>
          </div>
        </div>

        <div className="theme-color-grid">
          {THEME_COLOR_FIELDS.map((field) => (
            <label key={field.key} className="theme-color-item" htmlFor={`theme-${field.key}`}>
              <span className="theme-color-label">{t(field.label)}</span>
              <span className="theme-color-description">{t(field.description)}</span>
              <div className="theme-color-input-row">
                <input
                  id={`theme-${field.key}`}
                  type="color"
                  value={theme[field.key]}
                  onChange={(event) => onColorChange(field.key, event.target.value)}
                />
                <code>{theme[field.key]}</code>
              </div>
            </label>
          ))}
        </div>

        <div className="theme-footer-actions">
          <button type="button" className="theme-reset-btn" onClick={onResetTheme}>
            {t('Reset this mode')}
          </button>
        </div>
      </article>
    </section>
  );
}

export default ThemeConfigurationPanel;