import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer

} from 'recharts';
import { 
  Calendar, Download, Info, TrendingUp, TrendingDown, Minus, 
  ChevronRight, ExternalLink, RefreshCw, Edit3, Trash2, Check, Plus
} from 'lucide-react';
import { format, subDays, subWeeks, subMonths, subYears, isBefore, isAfter, startOfWeek, addDays, isValid, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import axios from 'axios';
import { fetchKeywordAdVolumes } from '../api/searchAd';

export default function TrendDashboard({ 
  title, 
  subtitle, 
  groups, 
  colors,
  showKeywords = true,
  editable = false,
  storageKey = null,
  showSummaryCards = false
}) {
  const [activeGroups, setActiveGroups] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    }
    return groups || [];
  });

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeUnit, setTimeUnit] = useState('date');
  const [compareMode, setCompareMode] = useState('none');
  const [customCompareRange, setCustomCompareRange] = useState({
    start: subDays(new Date(), 62),
    end: subDays(new Date(), 32)
  });
  
  const [customRange, setCustomRange] = useState({
    start: subDays(new Date(), 31),
    end: subDays(new Date(), 1) 
  });

  const [demoData, setDemoData] = useState(null);

  const [selectedBrands, setSelectedBrands] = useState({});
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [draftGroups, setDraftGroups] = useState([]);
  const [baseGroupId, setBaseGroupId] = useState(() => (groups && groups[0]) ? groups[0].id : null);

  useEffect(() => {
    const today = new Date();
    let end = subDays(today, 1);
    let start;

    if (timeUnit === 'date') {
      start = subDays(end, 30);
    } else if (timeUnit === 'week') {
      // 주간 기준: 오늘로부터 가장 가까운 '지난주 토요일'을 종료일로 설정 (꽉 찬 7일 보장)
      end = subDays(startOfWeek(today), 1);
      // 8주치 (종료일 다음날로부터 8주 전 일요일 시작)
      start = subWeeks(addDays(end, 1), 8);
    } else if (timeUnit === 'month') {
      start = subMonths(end, 12);
    }
    
    if (isValid(start) && isValid(end)) {
      setCustomRange({ start, end });
    }
  }, [timeUnit]);

  useEffect(() => {
    if (!activeGroups) return;
    const initialSelected = {};
    activeGroups.forEach(g => {
      if (g && g.id) initialSelected[g.id] = true;
    });
    setSelectedBrands(initialSelected);
  }, [activeGroups]);

  // 캐시 키 생성 (설정 정보 + 오늘 날짜 기준)
  // 설정이 바뀌거나 날짜가 지나면 캐시가 자동 갱신됨
  const cacheKeySuffix = useMemo(() => {
    const groupFingerprint = JSON.stringify(activeGroups.map(g => ({ id: g.id, keywords: g.keywords })));
    const today = format(new Date(), 'yyyy-MM-dd');
    return `${groupFingerprint}_${today}`;
  }, [activeGroups]);

  const fetchDatalab = async () => {
    if (!activeGroups || activeGroups.length === 0 || loading) return;
    
    // 1. 캐시 확인
    const cacheKey = `nike_datalab_cache_${cacheKeySuffix}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      console.log('[DEBUG] Loading Data from Cache:', cacheKey);
      setRawData(JSON.parse(cachedData));
      return;
    }

    setLoading(true);
    try {
      const filteredGroups = activeGroups.filter(g => g && g.name && g.keywords);
      const allKeywords = filteredGroups.flatMap(g => g.keywords || []);
      
      const yesterday = subDays(new Date(), 1);
      const threeYearsAgo = subYears(yesterday, 3);

      const requestBody = {
        startDate: format(threeYearsAgo, 'yyyy-MM-dd'),
        endDate: format(yesterday, 'yyyy-MM-dd'),
        timeUnit: 'date',
        groupName: filteredGroups.map(g => g.name),
        keywordGroups: filteredGroups.map(g => ({
          groupName: g.name,
          keywords: g.keywords
        }))
      };

      const res = await axios.post('/api/naver-datalab/v1/datalab/search', requestBody);
      const results = res.data.results || [];

      if (results.length > 0) {
        const volumeMap = await fetchKeywordAdVolumes(allKeywords);
        const groupMultipliers = {};
        
        results.forEach((resGroup, index) => {
          const groupInfo = filteredGroups[index];
          if (!groupInfo) return;

          let groupAdVolumeSum = 0;
          (groupInfo.keywords || []).forEach(kw => {
            if (!kw) return;
            const cleanKw = kw.toLowerCase().trim();
            const matchedKey = Object.keys(volumeMap).find(k => (k || '').toLowerCase().trim() === cleanKw);
            groupAdVolumeSum += volumeMap[matchedKey || cleanKw] || 0;
          });

          const last30Days = (resGroup.data || []).slice(-30);
          const ratioSum30 = last30Days.reduce((acc, curr) => acc + (curr.ratio || 0), 0);

          let multiplier = 1;
          if (ratioSum30 > 0) {
            multiplier = groupAdVolumeSum / ratioSum30;
          } else {
            const allRatioSum = (resGroup.data || []).reduce((acc, curr) => acc + (curr.ratio || 0), 0);
            if (allRatioSum > 0) {
              multiplier = (groupAdVolumeSum * ((resGroup.data || []).length / 30)) / allRatioSum;
            } else if (groupAdVolumeSum > 0) {
              multiplier = groupAdVolumeSum / 0.1;
            }
          }
          groupMultipliers[groupInfo.id] = multiplier;
        });

        const periods = (results[0].data || []).map(d => d.period);
        const formattedData = periods.map(period => {
          const row = { period, dateObj: startOfDay(new Date(period)).getTime() }; // store as timestamp for cache stability
          results.forEach((resGroup, index) => {
            const groupInfo = filteredGroups[index];
            if (!groupInfo) return;
            const dataPoint = (resGroup.data || []).find(d => d.period === period);
            const ratio = dataPoint ? dataPoint.ratio : 0;
            row[groupInfo.id] = ratio * (groupMultipliers[groupInfo.id] || 0);
          });
          return row;
        });

        let processedData = formattedData;
        
        // 날짜 객체 처리 (JSON 저장 시 timestamp로 변환되므로 다시 객체화 로직 필요하나 로직 상단에서 set 시에 map 처리)
        // 캐시 저장
        try {
          localStorage.setItem(cacheKey, JSON.stringify(processedData));
          // 불필요한 옛 캐시 삭제 (선택 사항)
        } catch(e) { console.warn('Cache limit exceeded', e); }

        setRawData(processedData.map(d => ({ ...d, dateObj: new Date(d.dateObj) })));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDemographics = async () => {
    if (!activeGroups || activeGroups.length === 0 || !baseGroupId) return;

    // 캐시 확인
    const demoCacheKey = `nike_demo_cache_${baseGroupId}_${cacheKeySuffix}`;
    const cachedDemo = localStorage.getItem(demoCacheKey);
    if (cachedDemo) {
      console.log('[DEBUG] Loading Demo from Cache:', demoCacheKey);
      setDemoData(JSON.parse(cachedDemo));
      return;
    }

    try {
      const baseGroup = activeGroups.find(g => g.id === baseGroupId);
      if (!baseGroup) return;

      const stableDay = subDays(new Date(), 3);
      const oneMonthAgo = subMonths(stableDay, 1);
      const catId = '50000788'; 

      const [genderRes, ageRes] = await Promise.all([
        axios.post('/api/naver-datalab/v1/datalab/shopping/category/keyword/gender', {
          startDate: format(oneMonthAgo, 'yyyy-MM-dd'),
          endDate: format(stableDay, 'yyyy-MM-dd'),
          timeUnit: 'month',
          category: catId,
          keyword: baseGroup.name
        }),
        axios.post('/api/naver-datalab/v1/datalab/shopping/category/keyword/age', {
          startDate: format(oneMonthAgo, 'yyyy-MM-dd'),
          endDate: format(stableDay, 'yyyy-MM-dd'),
          timeUnit: 'month',
          category: catId,
          keyword: baseGroup.name
        })
      ]);
      
      const gData = genderRes.data.results[0]?.data || [];
      const aData = ageRes.data.results[0]?.data || [];
      
      let male = 0, female = 0;
      if (gData.length > 0) {
          const latestGItems = gData.filter(d => d.period === gData[gData.length-1].period);
          latestGItems.forEach(item => {
              if (item.group === 'm') male = item.ratio;
              if (item.group === 'f') female = item.ratio;
          });
      }

      const ages = { '10s': 0, '20s': 0, '30s': 0, '40s': 0, '50s+': 0 };
      if (aData.length > 0) {
        const latestA = aData.filter(d => d.period === aData[aData.length-1].period);
        latestA.forEach(item => {
          if (['1', '2'].includes(item.group)) ages['10s'] += item.ratio;
          else if (['3', '4'].includes(item.group)) ages['20s'] += item.ratio;
          else if (['5', '6'].includes(item.group)) ages['30s'] += item.ratio;
          else if (['7', '8'].includes(item.group)) ages['40s'] += item.ratio;
          else if (['9', '10', '11'].includes(item.group)) ages['50s+'] += item.ratio;
        });
      }

      const finalDemo = { gender: { male, female }, ages };
      localStorage.setItem(demoCacheKey, JSON.stringify(finalDemo));
      setDemoData(finalDemo);
    } catch (err) {
      console.error('[DEBUG] Demo Fetch Error:', err.response?.data || err.message);
      setDemoData({ gender: { male: 0, female: 0 }, ages: { '10s': 0, '20s': 0, '30s': 0, '40s': 0, '50s+': 0 } });
    }
  };

  useEffect(() => {
    // 1. Raw Data (Trend)
    fetchDatalab();
  }, [cacheKeySuffix]);

  useEffect(() => {
    // 2. Demographics
    fetchDemographics();
  }, [cacheKeySuffix, baseGroupId]);

  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    
    // JSON 복원 시 dateObj가 timestamp(ms)일 수 있으므로 처리
    const processedRawData = rawData.map(d => ({
      ...d,
      dateObj: d.dateObj instanceof Date ? d.dateObj : new Date(d.dateObj)
    }));

    const filtered = processedRawData.filter(d => {
      const dt = d.dateObj.getTime();
      return dt >= startOfDay(customRange.start).getTime() && dt <= endOfDay(customRange.end).getTime();
    });
    if (compareMode === 'none') return filtered;

    return filtered.map((prDetail) => {
      const diffTime = Math.abs(startOfDay(customRange.end).getTime() - startOfDay(customRange.start).getTime());
      let shifted;
      if (compareMode === 'yoy') shifted = subYears(prDetail.dateObj, 1);
      else if (compareMode === 'custom') {
        const offset = prDetail.dateObj.getTime() - startOfDay(customRange.start).getTime();
        const testShifted = new Date(startOfDay(customCompareRange.start).getTime() + offset);
        if (testShifted.getTime() > endOfDay(customCompareRange.end).getTime()) {
          shifted = new Date(0); // Will not map to any active data
        } else {
          shifted = testShifted;
        }
      }
      else shifted = new Date(prDetail.dateObj.getTime() - diffTime);

      const comp = rawData.find(d => 
        format(d.dateObj, 'yyyy-MM-dd') === format(shifted, 'yyyy-MM-dd') || 
        (timeUnit === 'month' && format(d.dateObj, 'yyyy-MM') === format(shifted, 'yyyy-MM'))
      );

      const merged = { ...prDetail, comparePeriodStr: format(shifted, timeUnit === 'date' ? 'yy.MM.dd' : (timeUnit === 'week' ? 'yy.MM.dd(주)' : 'yy.MM(월)')) };
      activeGroups.forEach(g => { if(g && g.id) merged[`${g.id}_compare`] = comp ? comp[g.id] : null; });
      return merged;
    });
  }, [rawData, customRange, compareMode, activeGroups, timeUnit, customCompareRange]);


  const summaryMetrics = useMemo(() => {
    if (!chartData || chartData.length < 1) return null;
    
    const isCustom = timeUnit === 'custom';
    const latest = chartData[chartData.length - 1];
    const prev = chartData.length > 1 ? chartData[chartData.length - 2] : null;

    let latestPeriodStr = '';
    if (isCustom) {
      latestPeriodStr = `기준: ${format(customRange.start, "yy.MM.dd")} ~ ${format(customRange.end, "yy.MM.dd")}`;
    } else if (timeUnit === 'date') {
      latestPeriodStr = `기준: ${format(latest.dateObj, "yy년 M월 d일")}`;
    } else if (timeUnit === 'week') {
      latestPeriodStr = `기준: ${format(latest.dateObj, "yy년 M월 d일")} 주차`;
    } else {
      latestPeriodStr = `기준: ${format(latest.dateObj, "yy년 M월")}`;
    }

    const timeLabel = isCustom ? '기간 합산' : (timeUnit === 'date' ? '전일 대비' : (timeUnit === 'week' ? '전주 대비' : '전월 대비'));

    const baseGroup = activeGroups.find(g => g && g.id === baseGroupId && selectedBrands[g.id])
      || activeGroups.find(g => g && selectedBrands[g.id])
      || activeGroups[0];

    const sums = {};
    const compSums = {};
    if (isCustom) {
      activeGroups.forEach(g => {
        if (!g) return;
        sums[g.id] = chartData.reduce((acc, curr) => acc + (curr[g.id] || 0), 0);
        compSums[g.id] = chartData.reduce((acc, curr) => acc + (curr[`${g.id}_compare`] || 0), 0);
      });
    }

    const baseVal = isCustom 
      ? (baseGroup ? sums[baseGroup.id] : 0)
      : (baseGroup ? (latest[baseGroup.id] || 0) : 0);

    return activeGroups.map((g, idx) => {
      if (!g || !selectedBrands[g.id]) return null;
      
      const lVal = isCustom ? sums[g.id] : (latest[g.id] || 0);
      const pVal = isCustom 
        ? (compareMode !== 'none' ? compSums[g.id] : 0) 
        : (prev ? (prev[g.id] || 0) : 0);

      let diff = null;
      let isPos = false, isNeg = false;
      const shouldShowDiff = !(isCustom && compareMode === 'none');

      if (shouldShowDiff) {
        if (pVal !== 0) {
          const p = ((lVal - pVal) / pVal) * 100;
          isPos = p > 0; isNeg = p < 0;
          diff = `${isPos ? '+' : ''}${p.toFixed(1)}%`;
        } else if (lVal > 0) {
          isPos = true; diff = '+100.0%';
        } else {
          diff = '0.0%';
        }
      }

      const isBase = baseGroup && g.id === baseGroup.id;
      let vsBase = null;
      if (!isBase && baseVal > 0) {
        const ratio = ((lVal - baseVal) / baseVal) * 100;
        vsBase = (ratio >= 0 ? '+' : '') + ratio.toFixed(1) + '%';
      }

      return { 
        id: g.id, isBase, name: g.name, colorIdx: idx, 
        latestVal: Math.round(lVal).toLocaleString(), 
        changeStr: diff, isPositive: isPos, isNegative: isNeg, 
        vsBase, vsBasePositive: !isBase && baseVal > 0 ? lVal >= baseVal : false, 
        timeLabel: shouldShowDiff ? timeLabel : null, 
        latestPeriodStr 
      };
    }).filter(Boolean);
  }, [chartData, activeGroups, timeUnit, selectedBrands, baseGroupId, customRange, compareMode]);

  const autoInsights = useMemo(() => {
    if (!summaryMetrics || !demoData) return null;
    const base = summaryMetrics.find(m => m.isBase);
    if (!base) return null;

    const insights = [];
    
    // 1. Growth Insight
    if (base.isPositive) {
      insights.push(`현재 ${base.name}은(는) 전 기간 대비 ${base.changeStr} 상승하며 강력한 성장세를 보이고 있습니다.`);
    } else {
      insights.push(`${base.name}의 검색 지수가 소폭 조정 중이나 브랜드 영향력은 여전히 견고합니다.`);
    }

    // 2. Gender Insight
    const { male, female } = demoData.gender;
    const total = male + female;
    const mPct = total > 0 ? Math.round((male / total) * 100) : 50;
    const fPct = 100 - mPct;
    insights.push(`성별 비중은 ${mPct > fPct ? '남성' : '여성'}(${Math.max(mPct, fPct)}%) 중심의 소비층이 두드러지게 나타납니다.`);

    // 3. Age Insight
    const sortedAges = Object.entries(demoData.ages).sort((a,b) => b[1] - a[1]);
    const topAge = sortedAges[0];
    insights.push(`${topAge[0]} 연령대에서 가장 높은 브랜드 선호도를 기록하고 있습니다.`);

    return insights;
  }, [summaryMetrics, demoData]);


  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));
      const dateObj = payload[0]?.payload?.dateObj || new Date(label);
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      let day = (timeUnit === 'date' && isValid(dateObj)) ? ` (${weekdays[dateObj.getDay()]})` : '';
      return (
        <div className="custom-tooltip" style={{ backgroundColor: 'rgba(15, 15, 15, 0.95)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.6)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>기준: {(payload[0]?.payload?.period || label) + day}</p>
          {compareMode !== 'none' && payload[0]?.payload?.comparePeriodStr && (
             <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>비교: {payload[0]?.payload?.comparePeriodStr}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map((entry, idx) => {
              const isComp = entry.dataKey.endsWith('_compare');
              const g = activeGroups.find(x => x && x.id === (isComp ? entry.dataKey.replace('_compare', '') : entry.dataKey));
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, fontSize: 12 }}>
                  <span style={{ color: entry.color, opacity: isComp ? 0.7 : 1 }}>{g?.name || entry.name} {isComp ? '(비교)' : compareMode !== 'none' ? '(기준)' : ''}</span>
                  <span style={{ fontWeight: 700 }}>{entry.value ? Math.round(entry.value).toLocaleString() : '0'}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // 5개이상에서도 중복없는 고유 팔레트
  const PALETTE = ['#ffffff', '#a78bfa', '#38bdf8', '#4ade80', '#fb923c', '#f472b6', '#facc15', '#34d399'];
  const getGroupColor = (idx) => PALETTE[idx % PALETTE.length];

  const handleEditStart = () => {
    setDraftGroups(activeGroups.map(g => ({ ...g, keywordsString: (g.keywords || []).join(', ') })));
    setIsEditingGroups(true);
  };

  const addDraftGroup = () => {
    if (draftGroups.length >= 5) return;
    const newId = 'brand_' + Date.now();
    setDraftGroups(prev => [...prev, { id: newId, name: '', keywordsString: '' }]);
  };

  const removeDraftGroup = (idx) => {
    setDraftGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const saveCustomGroups = () => {
    const valid = draftGroups
      .map(g => ({
        id: g.name ? g.name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '_') : g.id,
        name: (g.name || '').trim(),
        keywords: (g.keywordsString || '').split(',').map(s => s.trim()).filter(Boolean)
      }))
      .filter(g => g.name && g.keywords.length > 0);
    if (valid.length === 0) { alert('브랜드명과 키워드를 최소 1개 이상 입력해 주세요.'); return; }
    setActiveGroups(valid);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(valid));
    setIsEditingGroups(false);
  };

  const handleDownload = () => {
    if (!chartData || chartData.length === 0) return;

    // Header row
    const headers = ['Period'];
    activeGroups.forEach(g => {
      if (g) {
        headers.push(g.name);
        if (compareMode !== 'none') headers.push(`${g.name}(Compare)`);
      }
    });

    // Data rows
    const rows = chartData.map(d => {
      const row = [d.period];
      activeGroups.forEach(g => {
        if (g) {
          row.push(d[g.id] || 0);
          if (compareMode !== 'none') row.push(d[`${g.id}_compare`] || 0);
        }
      });
      return row.join(',');
    });

    // 8. CSV 파일 생성 및 저장
    const csvContent = headers.join(',') + '\r\n' + rows.join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 다운로드 처리 (최신 브라우저 호환)
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nike_trend_data_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    
    // 문서에 붙여야 Safari 등에서 작동함
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // 정리
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 200);
  };


  return (
    <div className="dashboard-view">
      <header className="header" style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, position: 'relative' }}>
        <div className="header-titles">
          <h1 style={{ fontSize: 34, fontWeight: 850, marginBottom: 8, letterSpacing: '-0.03em', background: 'linear-gradient(90deg, #fff 0%, #aaa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500, maxWidth: 600 }}>{subtitle}</p>
        </div>
        
        <div className="header-controls" style={{ display: 'flex', gap: 16, alignItems: 'center', width: '100%', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24 }}>
          <div className="time-filters" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)' }}>
            {['date', 'week', 'month', 'custom'].map(unit => (
              <button key={unit} className={`btn btn-sm ${timeUnit === unit ? 'active' : ''}`} onClick={() => setTimeUnit(unit)} style={{ padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, backgroundColor: timeUnit === unit ? 'var(--accent-primary)' : 'transparent', color: timeUnit === unit ? 'var(--bg-dark)' : 'var(--text-secondary)', border: 'none', transition: 'all 0.2s' }}>
                {unit === 'date' ? '일간' : unit === 'week' ? '주간' : unit === 'month' ? '월간' : '지정'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>기준 기간:</span>
            <div className="date-picker-group" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 18px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <Calendar size={15} color="var(--accent-primary)" />
              <input type="date" value={isValid(customRange.start) ? format(customRange.start, 'yyyy-MM-dd') : ''} onChange={(e) => setCustomRange(p => ({...p, start: new Date(e.target.value)}))} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>~</span>
              <input type="date" value={isValid(customRange.end) ? format(customRange.end, 'yyyy-MM-dd') : ''} onChange={(e) => {
                const picked = new Date(e.target.value);
                const yesterday = subDays(new Date(), 1);
                setCustomRange(p => ({...p, end: picked > yesterday ? yesterday : picked}));
              }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
            </div>
          </div>

          <div className="divider" style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

          <div className="compare-select" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>비교 대상 기간:</span>
            <select className="styled-select" value={compareMode} onChange={(e) => setCompareMode(e.target.value)} style={{ padding: '10px 40px 10px 16px', fontSize: 13, fontWeight: 700, borderRadius: 12, minWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="none">없음</option>
              <option value="prev_period">이전 기간</option>
              <option value="yoy">전년 동기</option>
              <option value="custom">직접 지정</option>
            </select>
            {compareMode === 'custom' && (
              <div className="date-picker-group" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 18px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <Calendar size={15} color="var(--text-secondary)" />
                <input type="date" value={isValid(customCompareRange.start) ? format(customCompareRange.start, 'yyyy-MM-dd') : ''} onChange={(e) => setCustomCompareRange(p => ({...p, start: new Date(e.target.value)}))} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>~</span>
                <input type="date" value={isValid(customCompareRange.end) ? format(customCompareRange.end, 'yyyy-MM-dd') : ''} onChange={(e) => {
                  const picked = new Date(e.target.value);
                  const yesterday = subDays(new Date(), 1);
                  setCustomCompareRange(p => ({...p, end: picked > yesterday ? yesterday : picked}));
                }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 요약 카드 위젯 */}
      {showSummaryCards && summaryMetrics && summaryMetrics.length > 0 && (
        <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 36 }}>
          {summaryMetrics.map((metric) => (
            <div key={metric.id} className="summary-card glass-card" style={{ 
              padding: 24, 
              background: 'rgba(255,255,255,0.02)',
              borderTop: `4px solid ${PALETTE[metric.colorIdx % PALETTE.length]}`,
              borderRadius: 12,
              display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: PALETTE[metric.colorIdx % PALETTE.length] }} />
                  {metric.name}
                  {metric.isBase && <span style={{ fontSize: 10, background: PALETTE[metric.colorIdx % PALETTE.length], color: '#000', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>기준</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
                <div style={{ fontSize: 26, fontWeight: 850, color: '#fff', letterSpacing: '-0.02em' }}>{metric.latestVal}</div>
                {metric.changeStr && (
                  <div style={{ fontSize: 13, fontWeight: 800, color: metric.isPositive ? '#4ade80' : metric.isNegative ? '#f87171' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {metric.isPositive ? <TrendingUp size={16} strokeWidth={3} /> : metric.isNegative ? <TrendingDown size={16} strokeWidth={3} /> : <Minus size={16} strokeWidth={3} />}
                    {metric.changeStr}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 4, fontWeight: 500 }}>
                {metric.latestPeriodStr} {metric.timeLabel ? `· ${metric.timeLabel}` : ''}
              </div>
              
              {!metric.isBase && metric.vsBase && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>기준 브랜드 대비</span>
                    <span style={{ fontWeight: 700, color: metric.vsBasePositive ? '#4ade80' : '#f87171' }}>{metric.vsBase}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 인구통계 분석 섹션 (정교한 렌더링 및 태그 구조 수정) */}
      <div className="insight-section glass-card" style={{ marginBottom: 36, padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderLeft: '4px solid #03c75a', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!demoData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
            <div className="loader-sm" style={{ width: 16, height: 16, border: '2px solid rgba(3,199,90,0.1)', borderTop: '2px solid #03c75a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            인구통계 데이터를 불러오는 중...
          </div>
        ) : (demoData.gender.male === 0 && demoData.gender.female === 0) ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>📊 분석 데이터를 표시할 수 없습니다</div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, margin: 0 }}>해당 브랜드의 최근 검색량이 적거나 API 접근이 제한적입니다.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Activity size={18} color="#03c75a" />
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Brand Demographics <small style={{ fontWeight: 500, fontSize: 11, opacity: 0.5, marginLeft: 8 }}>기준 브랜드 검색자 분석</small></h4>
            </div>
            
            <div style={{ display: 'flex', gap: 60, flexWrap: 'wrap' }}>
              {/* 성별 비중 */}
              <div style={{ flex: '1', minWidth: 240 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <span>성별 비중 (Gender)</span>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>최근 30일 기준</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.05)', display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((demoData.gender.male / (demoData.gender.male + demoData.gender.female || 1)) * 100)}%`, background: '#38bdf8', transition: 'width 1s' }} />
                    <div style={{ flex: 1, background: '#f472b6', transition: 'width 1s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, fontWeight: 700 }}>
                  <span style={{ color: '#38bdf8' }}>남성 {Math.round((demoData.gender.male / (demoData.gender.male + demoData.gender.female || 1)) * 100)}%</span>
                  <span style={{ color: '#f472b6' }}>여성 {Math.round((demoData.gender.female / (demoData.gender.male + demoData.gender.female || 1)) * 100)}%</span>
                </div>
              </div>

              {/* 연령별 분포 */}
              <div style={{ flex: '1.5', minWidth: 300 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16 }}>연령별 관심도 (Age Groups)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px 20px' }}>
                  {Object.entries(demoData.ages).map(([age, ratio]) => {
                    const max = Math.max(...Object.values(demoData.ages));
                    const pct = max > 0 ? (ratio / max) * 100 : 0;
                    return (
                      <div key={age} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{age}</span>
                          <span style={{ color: '#fff', opacity: 0.8 }}>{Math.round(ratio)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#03c75a', opacity: 0.8, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 카테고리별 검색어 매핑 설정 */}
      {showKeywords && (
        <div className="keyword-info-box glass-card" style={{ marginBottom: 36, padding: 24, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Info size={22} color="var(--accent-primary)" />
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {isEditingGroups ? '카테고리별 검색어 매핑 편집' : '카테고리별 검색어 매핑 설정'}
              </h4>
            </div>
            {editable && !isEditingGroups && (
              <button className="btn btn-sm" onClick={handleEditStart} style={{ padding: '6px 16px', display:'flex', alignItems:'center', gap:6 }}>
                <Edit3 size={14} /> 매핑 편집
              </button>
            )}
          </div>

          {isEditingGroups ? (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
                브랜드명과 검색 키워드를 직접 설정할 수 있습니다. 키워드는 <strong style={{color:'var(--text-primary)'}}>쉼표(,)</strong>로 구분하여 입력하세요. (최대 5개 브랜드)
              </p>

              {/* 컬럼 헤더 */}
              <div style={{ display: 'flex', gap: 12, padding: '0 58px 8px 42px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span style={{ width: 180, flexShrink: 0 }}>브랜드명</span>
                <span style={{ flex: 1 }}>검색 키워드 (쉼표 구분)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {draftGroups.map((g, idx) => (
                  <div key={g.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* 색상 점 */}
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: getGroupColor(idx), flexShrink: 0 }} />

                    {/* 브랜드명 입력 */}
                    <input
                      type="text"
                      value={g.name || ''}
                      onChange={(e) => setDraftGroups(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))}
                      placeholder="브랜드명"
                      style={{
                        width: 170,
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: 8,
                        padding: '9px 12px',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />

                    {/* 키워드 입력 */}
                    <input
                      type="text"
                      value={g.keywordsString || ''}
                      onChange={(e) => setDraftGroups(prev => prev.map((d, i) => i === idx ? { ...d, keywordsString: e.target.value } : d))}
                      placeholder="예: 나이키, nike, 나이키 운동화"
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: 8,
                        padding: '9px 12px',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />

                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => removeDraftGroup(idx)}
                      title="삭제"
                      style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* 브랜드 추가 버튼 */}
              {draftGroups.length < 5 && (
                <button
                  onClick={addDraftGroup}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.25)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                >
                  <Plus size={14} /> 브랜드 추가 ({draftGroups.length}/5)
                </button>
              )}

              {/* 저장 / 취소 */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsEditingGroups(false)}
                  style={{ padding: '9px 22px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  onClick={saveCustomGroups}
                  style={{ padding: '9px 22px', borderRadius: 10, background: 'var(--accent-primary)', border: 'none', color: 'var(--bg-dark)', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Check size={14} /> 저장하기
                </button>
              </div>
            </div>
          ) : (
            /* 보기 모드 + 기준 선택 */
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, opacity: 0.75 }}>
                기준 브랜드를 선택하세요.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {activeGroups.map((g, idx) => g && (
                  <label
                    key={g.id || idx}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      padding: '9px 16px', borderRadius: 12,
                      border: `1.5px solid ${g.id === baseGroupId ? PALETTE[idx % PALETTE.length] : 'rgba(255,255,255,0.1)'}`,
                      background: g.id === baseGroupId ? `rgba(${parseInt(PALETTE[idx % PALETTE.length].slice(1,3),16)},${parseInt(PALETTE[idx % PALETTE.length].slice(3,5),16)},${parseInt(PALETTE[idx % PALETTE.length].slice(5,7),16)},0.1)` : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="radio"
                      name="baseGroup"
                      checked={g.id === baseGroupId}
                      onChange={() => setBaseGroupId(g.id)}
                      style={{ accentColor: PALETTE[idx % PALETTE.length], width: 14, height: 14 }}
                    />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: PALETTE[idx % PALETTE.length] }} />
                    <strong style={{ color: g.id === baseGroupId ? PALETTE[idx % PALETTE.length] : 'var(--text-secondary)', fontSize: 13 }}>{g.name}</strong>
                    {g.id === baseGroupId && <span style={{ fontSize: 10, background: PALETTE[idx % PALETTE.length], color: '#000', padding: '1px 7px', borderRadius: 6, fontWeight: 900 }}>기준</span>}
                    <span style={{ color: 'rgba(255,255,255,0.35)', margin: '0 1px' }}>│</span>
                    <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 12 }}>{(g.keywords || []).join(', ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="chart-container glass-card" style={{ padding: '36px 44px' }}>
        <div className="chart-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                쿼리 트렌드 
                <small style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, opacity: 0.6 }}>(단위: 검색수)</small>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 900, 
                  color: '#03c75a', 
                  border: '1px solid rgba(3,199,90,0.3)', 
                  padding: '2px 10px', 
                  borderRadius: 6, 
                  textTransform: 'uppercase',
                  opacity: 0.9,
                  letterSpacing: '0.05em',
                  background: 'rgba(3,199,90,0.05)'
                }}>Powered by NAVER Search Data</span>
              </h3>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* 기준 기간 표시 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>기준 기간:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', opacity: 0.9 }}>
                    {format(customRange.start, timeUnit === 'month' ? 'yyyy.MM' : 'yyyy.MM.dd')} ~ {format(customRange.end, timeUnit === 'month' ? 'yyyy.MM.dd' : 'yyyy.MM.dd')}
                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{differenceInDays(customRange.end, customRange.start) + 1}days</span>
                  </span>
                </div>

                {/* 비교 대상 기간 표시 */}
                {compareMode !== 'none' && (() => {
                  const end = customRange.end;
                  const start = customRange.start;
                  const diffMs = Math.abs(endOfDay(end).getTime() - startOfDay(start).getTime());
                  let compStart, compEnd;
                  if (compareMode === 'yoy') {
                    compStart = subYears(start, 1);
                    compEnd = subYears(end, 1);
                  } else if (compareMode === 'custom') {
                    compStart = customCompareRange.start;
                    compEnd = customCompareRange.end;
                  } else {
                    compEnd = new Date(startOfDay(start).getTime() - 1);
                    compStart = new Date(compEnd.getTime() - diffMs);
                  }
                  const fmt = timeUnit === 'month' ? 'yyyy.MM' : 'yyyy.MM.dd';
                  const compDays = differenceInDays(compEnd, compStart) + 1;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>비교 기간:</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', opacity: 0.85 }}>
                        {format(compStart, fmt)} ~ {format(compEnd, fmt)}
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent-primary)', opacity: 0.7, fontWeight: 500 }}>{compDays}days</span>
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5, fontStyle: 'italic' }}>(점선 표시)</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 브랜드 토글 & 데이터 다운로드 (우측 정렬) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>
              {loading && <div className="loader" style={{ marginRight: 8 }} />}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {activeGroups.map((g, idx) => g && (
                  <button
                    key={g.id}
                    onClick={() => setSelectedBrands(p => ({...p, [g.id]: !p[g.id]}))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '5px 12px', borderRadius: 20,
                      border: `1.5px solid ${selectedBrands[g.id] ? PALETTE[idx % PALETTE.length] : 'rgba(255,255,255,0.15)'}`,
                      background: selectedBrands[g.id] ? `rgba(${parseInt(PALETTE[idx%PALETTE.length].slice(1,3),16)},${parseInt(PALETTE[idx%PALETTE.length].slice(3,5),16)},${parseInt(PALETTE[idx%PALETTE.length].slice(5,7),16)},0.12)` : 'rgba(255,255,255,0.04)',
                      color: selectedBrands[g.id] ? PALETTE[idx % PALETTE.length] : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
                      opacity: selectedBrands[g.id] ? 1 : 0.5,
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: PALETTE[idx % PALETTE.length], opacity: selectedBrands[g.id] ? 1 : 0.4 }} />
                    {g.name}
                  </button>
                ))}
              </div>

              {/* 데이터 다운 버튼 (더 작고 맨 우측 배치) */}
              <button 
                onClick={handleDownload}
                disabled={loading || !chartData || chartData.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s',
                  opacity: (loading || !chartData || chartData.length === 0) ? 0.3 : 1,
                  pointerEvents: (loading || !chartData || chartData.length === 0) ? 'none' : 'auto',
                  marginLeft: 8
                }}
              >
                <Download size={14} />
                데이터 다운
              </button>
            </div>
          </div>
        </div>
        <div style={{ width: '100%', height: 440 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }} dy={14} tickFormatter={(val) => typeof val === 'string' ? val.split('-').slice(1).join('/') : val} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }} tickFormatter={(val) => val >= 1000 ? (val/1000).toFixed(0) + 'k' : val} />
              <Tooltip content={<CustomTooltip />} />
              {/* 메인 라인 */}
              {activeGroups.map((g, idx) => g && selectedBrands[g.id] && (
                <Line
                  key={g.id}
                  type="monotone"
                  dataKey={g.id}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={g.id === baseGroupId ? 5 : 1.5}
                  dot={false}
                  activeDot={{ r: g.id === baseGroupId ? 7 : 4, fill: PALETTE[idx % PALETTE.length] }}
                  opacity={g.id === baseGroupId ? 1 : 0.7}
                  animationDuration={1200}
                />
              ))}
              {/* 비교 기간 점선 라인 */}
              {compareMode !== 'none' && activeGroups.map((g, idx) => g && selectedBrands[g.id] && (
                <Line
                  key={`${g.id}_compare`}
                  type="monotone"
                  dataKey={`${g.id}_compare`}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={g.id === baseGroupId ? 3.5 : 1}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: g.id === baseGroupId ? 5 : 3, fill: PALETTE[idx % PALETTE.length] }}
                  opacity={g.id === baseGroupId ? 0.6 : 0.4}
                  animationDuration={1200}
                  legendType="none"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
