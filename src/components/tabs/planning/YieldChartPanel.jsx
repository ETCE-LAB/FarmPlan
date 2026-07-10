import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { useTranslation } from 'react-i18next';
import './style/YieldChartPanel.css';

/**
 * Compact trend chart. 
 * It can show either live Firebase 'farms' data 
 * OR the 'data' array from the Treeline API.
 */
function YieldChartPanel({ farms = [], data = [] }) {
  const { t } = useTranslation(); 

  // 1. Logic: If we have live farms, we use them. Otherwise, we fallback to the API data.
  const isUsingFirebase = farms.length > 0;

  const chartData = isUsingFirebase 
    ? farms.map((farm) => ({
        name: farm.farmName || t('Unnamed Farm'),
        value: Number(farm.areaHectares) || 0
      }))
    : data.map((item) => ({
        name: item.week || item.name || '?',
        value: item.value || 0
      }));

  return (
    <section className="panel">
      <div className="panel-header">
        {isUsingFirebase 
          ? t('overview.chart.title', 'Farm Area Comparison (ha)') 
          : t('Top Expected Calories By Plant')}
      </div>
      
      <div className="yield-chart-wrap" style={{ minHeight: '250px', width: '100%' }}>
        {chartData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '250px' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              {t('overview.chart.empty', 'No data to chart yet.')}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
              />
              
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              
              <Tooltip
                cursor={{ fill: 'var(--chart-cursor)' }}
                contentStyle={{
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                }}
                labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                formatter={(val) => [
                  isUsingFirebase ? `${val.toFixed(2)} ${t('ha')}` : val, 
                  isUsingFirebase ? t('overview.chart.area', 'Area') : t('Value')
                ]}
              />
              
              <Bar dataKey="value" fill="var(--farm-green-main)" radius={[2, 2, 0, 0]} barSize={35} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export default YieldChartPanel;