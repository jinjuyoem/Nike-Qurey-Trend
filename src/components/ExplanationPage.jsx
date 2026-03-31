import React from 'react';
import { Database, TrendingUp, Calculator, ArrowRight, CheckCircle, Info } from 'lucide-react';

export default function ExplanationPage() {
  return (
    <div className="explanation-view">
      <header className="header" style={{ marginBottom: 16 }}>
        <div className="header-titles">
          <h1>데이터 추정 방식 안내</h1>
          <p>나이키 트렌드 대시보드가 상대 지수를 어떻게 실제 검색량 수치로 변환하는지 명확하고 투명하게 안내합니다.</p>
        </div>
      </header>

      <section className="logic-card-grid">
        <div className="logic-card glass-card">
          <div className="logic-step">STEP 1</div>
          <div className="logic-icon-wrapper">
            <TrendingUp size={32} />
          </div>
          <h3>네이버 데이터랩 (상대 비중)</h3>
          <p>
            네이버 데이터랩은 특정 기간 내 <strong>가장 검색이 많았던 시점을 100</strong>으로 두고, 
            나머지 시점을 상대적인 비율(0~100)로 보여줍니다.<br/>
            질문: "누가 더 인기 있는가?"
          </p>
        </div>

        <div className="logic-card glass-card">
          <div className="logic-step">STEP 2</div>
          <div className="logic-icon-wrapper">
            <Database size={32} />
          </div>
          <h3>네이버 검색광고 (고정 수치)</h3>
          <p>
            네이버 검색광고 API를 통해 해당 키워드의 <strong>최근 30일 누적 절대 검색량</strong>을 가져옵니다.<br/>
            질문: "정확히 몇 번 검색했는가?"
          </p>
        </div>

        <div className="logic-card glass-card">
          <div className="logic-step" style={{ background: 'var(--accent-primary)', color: 'var(--bg-dark)' }}>FINAL STEP</div>
          <div className="logic-icon-wrapper">
            <Calculator size={32} />
          </div>
          <h3>하이드리브 역산 엔진</h3>
          <p>
            최근 30일간의 '상대 비중' 합계와 '진짜 검색횟수'를 매칭하여 <strong>배수(Multiplier)</strong>를 산출합니다.<br/>
            질문: "비중 1당 실제 검색량은 얼마인가?"
          </p>
        </div>
      </section>

      <section className="formula-section">
        <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 700 }}>🔍 수치 도출 공식</h2>
        <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 700 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
            본 대시보드는 아래의 수학적 비례식을 통해 단순히 "높다/낮다"를 넘어 "몇 회 검색되었다"를 추정합니다.
          </p>
        </div>
        
        <div className="formula-box">
          <div className="formula-item">
            <span className="highlight-badge badge-ad">Search Ad</span>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>최근 30일 절대량</div>
          </div>
          <div className="formula-symbol">÷</div>
          <div className="formula-item">
            <span className="highlight-badge badge-datalab">DataLab</span>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>최근 30일 비중 합계</div>
          </div>
          <div className="formula-symbol">=</div>
          <div className="formula-item" style={{ borderColor: 'var(--accent-primary)', background: 'rgba(255,255,255,0.05)' }}>
            <span className="highlight-badge badge-final">Multiplier</span>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)' }}>환산 배수 산출</div>
          </div>
        </div>

        <div style={{ marginTop: 40, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          <ArrowRight size={16} />
          <span>산출된 <strong>배수(Multiplier)</strong>를 일간/주간/월간 비중에 곱하여 <strong>실제 예상 검색량</strong>을 완성합니다.</span>
        </div>
      </section>

      <section className="glass-card" style={{ padding: 32 }}>
        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={20} color="var(--accent-primary)" />
          데이터의 신뢰성 및 안내
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 15 }}>상위 산정 방식 및 오차 안내</h4>
            본 대시보드의 수치는 검증된 상위 산정 방식을 통해 정확하게 계산되었으나, API 간의 시간차 및 네이버 내부 통계 기준(성별/연령 제외 등)에 따라 <strong>실제 수치와는 일부 차이가 발생할 수 있습니다.</strong>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 15 }}>데이터 출처</h4>
            네이버 데이터랩 API의 한계로 인해 데이터는 항상 <strong>전일(Yesterday)</strong>까지의 실적을 반영합니다. 검색광고 데이터는 네이버 검색광고 API 정식 채널을 통해 수신됩니다.
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: 12, border: '1px solid rgba(56, 189, 248, 0.1)' }}>
        <Info size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          데이터에 관한 문의나 대시보드 이용 중 문제가 발생할 경우, <strong>전략광고1팀 염진주</strong>로 문의해 주시기 바랍니다.
        </p>
      </div>
    </div>
  );
}
