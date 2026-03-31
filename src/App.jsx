import React, { useState } from 'react';
import { TrendingUp, Activity, BarChart2, HelpCircle } from 'lucide-react';
import TrendDashboard from './components/TrendDashboard';
import ExplanationPage from './components/ExplanationPage';
import './App.css';

// Brand Comparison (대시보드 1)
const BRAND_GROUPS = [
  { id: 'nike', name: 'Nike', keywords: ['나이키', 'nike'] },
  { id: 'adidas', name: 'Adidas', keywords: ['아디다스', 'adidas'] },
  { id: 'newbalance', name: 'New Balance', keywords: ['뉴발란스', 'newbalance'] }
];

const BRAND_COLORS = {
  nike: '#ffffff',
  adidas: '#a78bfa',
  newbalance: '#38bdf8'
};

// Category Comparison (대시보드 2)
const CATEGORY_GROUPS = [
  { id: 'brand', name: 'Brand Core', keywords: ['나이키', 'nike'] },
  { id: 'lifestyle', name: 'Lifestyle', keywords: ['에어포스', '조던', '덩크로우'] },
  { id: 'running', name: 'Running', keywords: ['인빈시블', '페가수스', '베이퍼플라이', '나이키 러닝화'] },
  { id: 'apparel', name: 'Apparel', keywords: ['나이키 후드', '나이키 바람막이', '맨투맨'] },
  { id: 'football', name: 'Football', keywords: ['나이키 축구화', '머큐리얼', '티엠포'] }
];

const CATEGORY_COLORS = {
  brand: '#fafafa',       // White
  lifestyle: '#38bdf8',   // Blue
  running: '#4ade80',     // Green
  apparel: '#f472b6',     // Pink
  football: '#fb923c'     // Orange
};

export default function App() {
  const [activeTab, setActiveTab] = useState('brand');

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <TrendingUp className="logo-icon" size={28} color="var(--text-primary)" />
          <span>Nike <span style={{color: 'var(--text-secondary)'}}>Trends</span></span>
        </div>
        
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'brand' ? 'active' : ''}`}
            onClick={() => setActiveTab('brand')}
          >
            <BarChart2 size={20} />
            <span>Brand Query Trend</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'category' ? 'active' : ''}`}
            onClick={() => setActiveTab('category')}
          >
            <Activity size={20} />
            <span>나이키 카테고리 기여도</span>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div 
              className={`nav-item ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')}
            >
              <HelpCircle size={20} />
              <span>데이터 추정 방식 안내</span>
            </div>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        {activeTab === 'brand' && (
          <TrendDashboard 
            title="Nike Query Trend Tracker"
            subtitle="Nike 쿼리트렌드를 경쟁사 쿼리 트렌드와 비교합니다."
            groups={BRAND_GROUPS}
            colors={BRAND_COLORS}
            showKeywords={true}
            editable={true}
            storageKey="nike_brand_custom_groups"
            showSummaryCards={true}
          />
        )}
        
        {activeTab === 'category' && (
          <TrendDashboard 
            title="Nike Query Trend Tracker"
            subtitle="나이키 내부의 주요 카테고리별(러닝화, 라이프스타일 등) 검색 트렌드 흐름 분석"
            groups={CATEGORY_GROUPS}
            colors={CATEGORY_COLORS}
            showKeywords={true}
            editable={true}
            storageKey="nike_category_custom_groups"
            showSummaryCards={true}
          />
        )}

        {activeTab === 'guide' && (
          <ExplanationPage />
        )}
        
        <footer style={{ marginTop: 'auto', paddingTop: 40, paddingBottom: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, borderTop: '1px solid var(--border-color)', width: '100%' }}>
          <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} jinjuyeomcj. All rights reserved.</p>
          <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: 12 }}>Data Source: NAVER Datalab Search API, Search AD API</p>
        </footer>
      </main>
    </div>
  );
}
