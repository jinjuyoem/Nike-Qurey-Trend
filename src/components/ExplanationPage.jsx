import React from 'react';
import { Database, TrendingUp, Calculator, ArrowRight, CheckCircle, Info, AlertTriangle, Zap } from 'lucide-react';

export default function ExplanationPage() {
  return (
    <div className="explanation-view">
      <header className="header" style={{ marginBottom: 16 }}>
        <div className="header-titles">
          <h1 style={{ fontSize: 32, fontWeight: 850, marginBottom: 8, letterSpacing: '-0.03em', background: 'linear-gradient(90deg, #fff 0%, #aaa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            데이터 추정 방식 안내
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500 }}>
            이 대시보드가 검색량 수치를 어떻게 산출하는지 안내합니다.
          </p>
        </div>
      </header>

      {/* ── 한 줄 요약 배너 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '20px 28px',
        background: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(74,222,128,0.06) 100%)',
        borderRadius: 16,
        border: '1px solid rgba(56,189,248,0.2)',
      }}>
        <Zap size={22} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.6 }}>
          <span style={{ color: '#4ade80' }}>네이버 검색광고 키워드 도구 기반 절대 수치</span>
          {' + '}
          <span style={{ color: 'var(--accent-primary)' }}>데이터랩의 상대 지수</span>
          를 조합하여&nbsp;
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 6 }}>역산한 추정치</span>
          입니다
        </p>
      </div>

      {/* ── 3단계 Flow ── */}
      <section className="logic-card-grid">
        <div className="logic-card glass-card">
          <div className="logic-step">STEP 1</div>
          <div className="logic-icon-wrapper"><TrendingUp size={30} /></div>
          <h3>데이터랩 — 상대 지수</h3>
          <p>
            네이버 데이터랩은 특정 기간 내 <strong>가장 많이 검색된 시점을 100</strong>으로 두고,
            나머지 시점의 검색량을 <strong>0~100 사이의 비율(상대 지수)</strong>로 제공합니다.
            <span style={{ marginTop: 8, display: 'block', opacity: 0.7, fontSize: 13 }}>
              "누가/언제 더 많이 검색되었나?" 를 파악합니다.
            </span>
          </p>
        </div>

        <div className="logic-card glass-card">
          <div className="logic-step">STEP 2</div>
          <div className="logic-icon-wrapper"><Database size={30} /></div>
          <h3>검색광고 도구 — 절대 수치</h3>
          <p>
            네이버 검색광고 API를 통해 해당 키워드의 <strong>최근 30일 실제 검색 횟수(절대량)</strong>를 가져옵니다.
            <span style={{ marginTop: 8, display: 'block', opacity: 0.7, fontSize: 13 }}>
              "정확히 몇 번 검색되었나?" 의 기준값이 됩니다.
            </span>
          </p>
        </div>

        <div className="logic-card glass-card">
          <div className="logic-step" style={{ background: 'var(--accent-primary)', color: 'var(--bg-dark)' }}>STEP 3</div>
          <div className="logic-icon-wrapper"><Calculator size={30} /></div>
          <h3>역산 — 일별 추정 검색수</h3>
          <p>
            절대 수치 ÷ 30일 상대 지수 합계로 <strong>환산 배수(Multiplier)</strong>를 산출한 뒤,
            각 날짜의 상대 지수에 곱해 <strong>일별 검색량을 역산</strong>합니다.
            <span style={{ marginTop: 8, display: 'block', opacity: 0.7, fontSize: 13 }}>
              주간·월간 단위는 이 일별 수치를 합산해 집계합니다.
            </span>
          </p>
        </div>
      </section>

      {/* ── 공식 시각화 ── */}
      <section className="formula-section">
        <h2 style={{ marginBottom: 8, fontSize: 22, fontWeight: 800 }}>🔢 산출 공식</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
          수학적 비례식을 통해 단순 트렌드를 넘어 실제 검색량을 추정합니다.
        </p>

        <div className="formula-box">
          <div className="formula-item">
            <span className="highlight-badge badge-ad">Search Ad</span>
            <div style={{ marginTop: 8, fontSize: 17, fontWeight: 700 }}>최근 30일 절대량</div>
          </div>
          <div className="formula-symbol">÷</div>
          <div className="formula-item">
            <span className="highlight-badge badge-datalab">DataLab</span>
            <div style={{ marginTop: 8, fontSize: 17, fontWeight: 700 }}>30일 상대 지수 합계</div>
          </div>
          <div className="formula-symbol">=</div>
          <div className="formula-item" style={{ borderColor: 'var(--accent-primary)', background: 'rgba(56,189,248,0.05)' }}>
            <span className="highlight-badge badge-final">Multiplier</span>
            <div style={{ marginTop: 8, fontSize: 17, fontWeight: 700, color: 'var(--accent-primary)' }}>환산 배수</div>
          </div>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 14, background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <ArrowRight size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong style={{ color: '#fff' }}>환산 배수(Multiplier)</strong>를 각 날짜의 상대 지수에 곱하면&nbsp;
            <strong style={{ color: 'var(--accent-primary)' }}>일별 추정 검색량</strong>이 완성됩니다.
            주간/월간 선택 시 해당 기간 내 일별 수치를 <strong style={{ color: '#fff' }}>합산</strong>해 집계합니다.
          </span>
        </div>
      </section>

      {/* ── 신뢰도 및 오차 안내 ── */}
      <section className="glass-card" style={{ padding: 32 }}>
        <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, fontSize: 18 }}>
          <CheckCircle size={20} color="var(--accent-primary)" />
          데이터 신뢰도 및 한계 안내
        </h3>

        {/* 상단 3칸 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28, marginBottom: 28 }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            <h4 style={{ color: '#fb923c', marginBottom: 10, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> 추정치임을 반드시 인지하세요
            </h4>
            본 대시보드의 모든 수치는 <strong style={{ color: '#fff' }}>실제 검색량의 직접 측정값이 아닌 역산 추정치</strong>입니다.
            검색광고 API의 '최근 30일 조회량'과 데이터랩의 '상대 지수'를 결합하는 방식으로 산출하며,
            두 API 간 데이터 수집 기준(봇 필터링, 중복 처리, 연령·지역 제외 범위 등)이 완전히 동일하지 않아
            <strong style={{ color: '#fff' }}> 실제 수치와 오차가 발생할 수 있습니다.</strong>
          </div>

          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            <h4 style={{ color: '#38bdf8', marginBottom: 10, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={14} /> 데이터 갱신 주기 및 시점
            </h4>
            데이터랩 API의 구조상 <strong style={{ color: '#fff' }}>당일 데이터는 제공되지 않으며</strong>, 항상 전일(Yesterday)까지의 실적을 기준으로 합니다.
            또한 대시보드 최초 로딩 시 데이터를 불러온 후 <strong style={{ color: '#fff' }}>당일 날짜 기준으로 캐싱</strong>되며, 자정 이후 재방문 시 자동으로 새 데이터를 요청합니다.
            검색어 그룹 설정 변경 시에도 캐시가 무효화되어 새로 요청합니다.
          </div>

          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            <h4 style={{ color: '#a78bfa', marginBottom: 10, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} /> 트렌드 방향성은 신뢰 가능
            </h4>
            절대 수치의 정밀도는 제한적이나, <strong style={{ color: '#fff' }}>키워드 간 상대적 비교</strong>와
            <strong style={{ color: '#fff' }}> 시계열 트렌드 방향성</strong>(상승/하락 추세, 계절성 패턴 등)은
            데이터랩의 상대 지수에 직접 기반하므로 의사결정 참고 지표로는 충분히 활용 가능합니다.
          </div>
        </div>

        {/* 데이터 출처: 그리드 하단 전폭 독립 영역 */}
        <div style={{
          padding: '20px 24px',
          background: 'rgba(74,222,128,0.04)',
          border: '1px solid rgba(74,222,128,0.15)',
          borderRadius: 12,
        }}>
          <h4 style={{ color: '#4ade80', marginBottom: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} /> 데이터 출처
          </h4>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 32px' }}>
              <span>• <strong style={{ color: '#fff' }}>네이버 데이터랩 검색어트렌드 API</strong> — 상대 지수 제공 (공식 OpenAPI)</span>
              <span>• <strong style={{ color: '#fff' }}>네이버 검색광고 키워드 도구 API</strong> — 키워드별 절대 검색량 제공 (공식 SearchAd API)</span>
            </div>
            <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.7, fontSize: 13 }}>
              두 API 모두 네이버 공식 제공 채널을 통해 수신되며, 별도 크롤링이나 비공식 수집 방법은 사용하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 문의 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 24px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: 12, border: '1px solid rgba(56, 189, 248, 0.12)' }}>
        <Info size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          데이터 수치에 대한 문의, 대시보드 이용 중 이상 현상 발생, 또는 추가 키워드 그룹 설정 지원이 필요하신 경우,
          <strong style={{ color: '#fff' }}> 전략광고1팀 염진주</strong>로 문의해 주시기 바랍니다.
          <br />
          <span style={{ opacity: 0.65, fontSize: 12 }}>※ 본 수치는 참고용 추정치이며, 공식 지표로 활용 시 발생하는 결과에 대해 제작자는 책임지지 않습니다.</span>
        </p>
      </div>
    </div>
  );
}
