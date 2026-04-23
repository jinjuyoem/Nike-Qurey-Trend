import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, Activity, BarChart2, HelpCircle, Plus, Trash2, Edit3, Check, X, Lock, Layers,
  Search, Star, Zap, Globe, PieChart, Briefcase, ShoppingBag, Tag, Award, Flame, Target, Package
} from 'lucide-react';
import TrendDashboard from './components/TrendDashboard';
import ExplanationPage from './components/ExplanationPage';
import './App.css';

// ── Nike Swoosh Logo ─────────────────────────────────────────
const NikeSwoosh = () => (
  <img
    src="/nike-logo.svg"
    alt="Nike"
    style={{ height: 28, width: 'auto' }}
  />
);

// ── 선택 가능한 아이콘 팔레트 ────────────────────────────────
const AVAILABLE_ICONS = [
  { name: 'BarChart2', Comp: BarChart2 },
  { name: 'Activity', Comp: Activity },
  { name: 'Layers', Comp: Layers },
  { name: 'TrendingUp', Comp: TrendingUp },
  { name: 'Search', Comp: Search },
  { name: 'Star', Comp: Star },
  { name: 'Zap', Comp: Zap },
  { name: 'Globe', Comp: Globe },
  { name: 'PieChart', Comp: PieChart },
  { name: 'Briefcase', Comp: Briefcase },
  { name: 'ShoppingBag', Comp: ShoppingBag },
  { name: 'Tag', Comp: Tag },
  { name: 'Award', Comp: Award },
  { name: 'Flame', Comp: Flame },
  { name: 'Target', Comp: Target },
  { name: 'Package', Comp: Package },
];

function getIconComp(iconName) {
  return AVAILABLE_ICONS.find(i => i.name === iconName)?.Comp || Layers;
}

// ── 기본 그룹 데이터 ─────────────────────────────────────────
const BRAND_GROUPS = [
  { id: 'nike', name: 'Nike', keywords: ['나이키', 'nike'] },
  { id: 'adidas', name: 'Adidas', keywords: ['아디다스', 'adidas'] },
  { id: 'newbalance', name: 'New Balance', keywords: ['뉴발란스', 'newbalance'] }
];

const RUNNING_GROUPS = [
  { id: 'running_shoes', name: '나이키 러닝화', keywords: ['나이키러닝화', '나이키런닝화'] },
  { id: 'pegasus', name: '나이키 페가수스', keywords: ['나이키페가수스', '나이키페가수스러닝화'] },
];

const DEFAULT_GROUPS_MAP = {
  brand: BRAND_GROUPS,
  running: RUNNING_GROUPS,
};

// ── 기본 대시보드 정의 ────────────────────────────────────────
const DEFAULT_DASHBOARDS = [
  { id: 'brand', name: 'Brand Query Trend', locked: true, storageKey: 'nike_brand_custom_groups', groupLabel: '브랜드명', icon: 'BarChart2' },
  { id: 'running', name: '나이키 러닝 쿼리 트렌드', locked: false, storageKey: 'nike_running_custom_groups', groupLabel: '주제어', icon: 'Layers' },
];

const DASHBOARDS_STORAGE_KEY = 'nike_dashboards_list_v2';

function loadDashboards() {
  try {
    const saved = localStorage.getItem(DASHBOARDS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 구버전에 'category' 대시보드가 있으면 제거
        return parsed.filter(d => d.id !== 'category');
      }
    }
  } catch (e) { }
  return DEFAULT_DASHBOARDS;
}

function saveDashboards(list) {
  try { localStorage.setItem(DASHBOARDS_STORAGE_KEY, JSON.stringify(list)); }
  catch (e) { }
}

export default function App() {
  const [dashboards, setDashboards] = useState(loadDashboards);
  const [activeTab, setActiveTab] = useState(() => loadDashboards()[0]?.id || 'brand');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [iconPickerForId, setIconPickerForId] = useState(null);
  const editInputRef = useRef(null);
  const iconPickerRef = useRef(null);

  useEffect(() => { saveDashboards(dashboards); }, [dashboards]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // 아이콘 피커 외부 클릭 시 닫기
  useEffect(() => {
    if (!iconPickerForId) return;
    const handleClickOutside = (e) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target)) {
        setIconPickerForId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [iconPickerForId]);

  const startRename = (dash, e) => {
    e?.stopPropagation();
    setEditingId(dash.id);
    setEditingName(dash.name);
  };

  const confirmRename = (id, e) => {
    e?.stopPropagation();
    if (!editingName.trim()) { cancelRename(); return; }
    setDashboards(prev => prev.map(d => d.id === id ? { ...d, name: editingName.trim() } : d));
    setEditingId(null);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingName('');
  };

  const changeIcon = (dashId, iconName) => {
    setDashboards(prev => prev.map(d => d.id === dashId ? { ...d, icon: iconName } : d));
    setIconPickerForId(null);
  };

  const addDashboard = () => {
    const newId = `dash_${Date.now()}`;
    const newDash = { id: newId, name: '새 대시보드', locked: false, storageKey: `nike_custom_${newId}`, groupLabel: '주제어', icon: 'Layers' };
    setDashboards(prev => [...prev, newDash]);
    setActiveTab(newId);
    setTimeout(() => { setEditingId(newId); setEditingName('새 대시보드'); }, 80);
  };

  const deleteDashboard = (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('이 대시보드를 삭제하시겠습니까?')) return;
    setDashboards(prev => {
      const updated = prev.filter(d => d.id !== id);
      if (activeTab === id) setActiveTab(updated[0]?.id || 'brand');
      return updated;
    });
  };

  const activeDashboard = dashboards.find(d => d.id === activeTab);

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        {/* 로고 */}
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <NikeSwoosh />
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Nike</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Query Solution</div>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dashboards.map((dash) => {
              const Icon = getIconComp(dash.icon);
              const isActive = activeTab === dash.id;
              const isEditing = editingId === dash.id;

              return (
                <div key={dash.id} style={{ position: 'relative' }}>
                  <div
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => { if (!isEditing) setActiveTab(dash.id); }}
                    style={{ position: 'relative', paddingRight: !dash.locked ? 60 : 16 }}
                  >
                    {/* 아이콘 (비잠금은 클릭으로 피커 열기) */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!dash.locked) setIconPickerForId(prev => prev === dash.id ? null : dash.id);
                      }}
                      title={dash.locked ? '' : '아이콘 변경 (클릭)'}
                      style={{ cursor: dash.locked ? 'default' : 'pointer', borderRadius: 6, padding: 2, display: 'flex', transition: 'background 0.15s' }}
                    >
                      <Icon size={18} />
                    </div>

                    {/* 이름 (편집 중이면 인풋) */}
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
                        <input
                          ref={editInputRef}
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirmRename(dash.id); if (e.key === 'Escape') cancelRename(); }}
                          style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.12)', border: '1px solid var(--accent-primary)', borderRadius: 6, padding: '3px 8px', color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none' }}
                        />
                        <button onClick={(e) => confirmRename(dash.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80', padding: 2, display: 'flex' }}><Check size={13} /></button>
                        <button onClick={cancelRename} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 2, display: 'flex' }}><X size={13} /></button>
                      </div>
                    ) : (
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{dash.name}</span>
                    )}

                    {dash.locked && !isEditing && (
                      <Lock size={10} style={{ color: isActive ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                    )}

                    {!dash.locked && !isEditing && (
                      <div className="nav-item-actions" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => startRename(dash, e)} title="이름 변경" className="nav-action-btn" style={{ color: isActive ? 'rgba(0,0,0,0.6)' : 'var(--text-secondary)' }}>
                          <Edit3 size={11} />
                        </button>
                        <button onClick={(e) => deleteDashboard(dash.id, e)} title="삭제" className="nav-action-btn nav-delete-btn">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 아이콘 피커 팝업 */}
                  {iconPickerForId === dash.id && (
                    <div
                      ref={iconPickerRef}
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 300,
                        background: '#18181b', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 12, padding: 12,
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.7)', width: 172, marginTop: 4,
                      }}
                    >
                      <div style={{ gridColumn: '1/-1', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        아이콘 선택
                      </div>
                      {AVAILABLE_ICONS.map(({ name, Comp }) => (
                        <button
                          key={name}
                          onClick={() => changeIcon(dash.id, name)}
                          style={{
                            padding: 8,
                            background: dash.icon === name ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${dash.icon === name ? 'var(--accent-primary)' : 'transparent'}`,
                            borderRadius: 8, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: dash.icon === name ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <Comp size={15} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* + 대시보드 추가 버튼 */}
            <button onClick={addDashboard} className="nav-add-btn">
              <Plus size={14} />
              <span>대시보드 추가</span>
            </button>
          </div>

          {/* 추정 방식 안내 (하단) */}
          <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div
              className={`nav-item ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')}
            >
              <HelpCircle size={18} />
              <span style={{ fontSize: 13 }}>데이터 추정 방식 안내</span>
            </div>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        {activeTab !== 'guide' && activeDashboard && (
          <TrendDashboard
            key={activeDashboard.id}
            title={activeDashboard.name}
            subtitle={activeDashboard.id === 'brand' ? 'Nike 쿼리 트렌드를 경쟁사 쿼리 트렌드와 비교합니다.' : ''}
            groups={DEFAULT_GROUPS_MAP[activeDashboard.id] || []}
            colors={{}}
            showKeywords={true}
            editable={true}
            storageKey={activeDashboard.storageKey}
            showSummaryCards={true}
            groupLabel={activeDashboard.groupLabel || '주제어'}
          />
        )}

        {activeTab === 'guide' && <ExplanationPage />}

        <footer style={{ marginTop: 'auto', paddingTop: 40, paddingBottom: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, borderTop: '1px solid var(--border-color)', width: '100%' }}>
          <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} jinjuyeomcj. All rights reserved.</p>
          <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: 12 }}>Data Source: NAVER Datalab Search API, Search AD API</p>
        </footer>
      </main>
    </div>
  );
}
