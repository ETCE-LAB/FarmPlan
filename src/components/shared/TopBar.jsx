import { User, Search, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './TopBar.css';

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  // Get the current language, default to 'en' if loading
  const currentLang = i18n.resolvedLanguage || 'en';

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-toggle-wrapper">
      <Globe size={16} className="text-muted" />
      <div className="language-toggle-pill">
        <button 
          onClick={() => changeLanguage('en')}
          className={`toggle-btn ${currentLang === 'en' ? 'active' : ''}`}
        >
          EN
        </button>
        <button 
          onClick={() => changeLanguage('de')}
          className={`toggle-btn ${currentLang === 'de' ? 'active' : ''}`}
        >
          DE
        </button>
      </div>
    </div>
  );
}

// Global header with search and active-user summary.
function TopBar() {
  // Bring in the translation function for the TopBar text
  const { t } = useTranslation();

  return (
    <header className="top-bar">
      <div className="search-box">
        <Search size={16} className="search-box-icon" />
        {/* We use t() here so the placeholder changes languages! */}
        <input 
          type="text" 
          placeholder={t('topbar.search', 'Quick search: field id, crop, note...')} 
        />
      </div>

      <div className="top-bar-profile" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        
        {/* Our new modern switcher */}
        <LanguageSwitcher />

        <div className="profile-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="profile-name">Markus Müllermann</div>
            {/* Translating the role */}
            <div className="profile-org">{t('topbar.role', 'Farmer')}</div>
          </div>
          <div className="profile-avatar">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;