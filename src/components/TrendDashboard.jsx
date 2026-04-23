import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer

} from 'recharts';
import { 
  Calendar, Download, Info, TrendingUp, TrendingDown, Minus, 
  ChevronRight, ExternalLink, RefreshCw, Edit3, Trash2, Check, Plus,
  Activity
} from 'lucide-react';
import { format, subDays, subWeeks, subMonths, subYears, isBefore, isAfter, startOfWeek, startOfMonth, addDays, isValid, startOfDay, endOfDay, differenceInDays } from 'date-fns';
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
  showSummaryCards = false,
  groupLabel = '브랜드명'
}) {
  const [activeGroups, setActiveGroups] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    }
    return groups || [];
  });

  const [rawData, setRawData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
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

  const [selectedBrands, setSelectedBrands]   = useState({});
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [draftGroups, setDraftGroups]         = useState([]);
  const [baseGroupId, setBaseGroupId]         = useState(() => (groups && groups[0]) ? groups[0].id : null);

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
      // 월간 기준: 꽉 찬 전월을 기준으로 하기 위해 당월 1일의 전날(전달 말일)을 종료일로 설정
      end = subDays(startOfMonth(today), 1);
      // 12개월치
      start = subMonths(addDays(end, 1), 12);
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
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // 하위 호환성 유지 (데이터만 저장된 경우와 스토리지 구조가 바뀐 경우 대응)
        if (parsed.data && parsed.lastUpdated) {
          console.log('[DEBUG] Loading Data from Cache with Timestamp:', cacheKey);
          setRawData(parsed.data.map(d => ({ ...d, dateObj: d.dateObj ? new Date(d.dateObj) : new Date() })));
          setLastUpdated(new Date(parsed.lastUpdated));
        } else {
          console.log('[DEBUG] Loading Legacy Data from Cache:', cacheKey);
          const data = Array.isArray(parsed) ? parsed : [];
          setRawData(data.map(d => ({ ...d, dateObj: d.dateObj ? new Date(d.dateObj) : new Date() })));
          setLastUpdated(null);
        }
        return;
      } catch (e) {
        console.error('Cache Parse Error:', e);
      }
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
          const ratioSum30 = last30Days.length > 0 ? last30Days.reduce((acc, curr) => acc + (curr ? (curr.ratio || 0) : 0), 0) : 0;

          let multiplier = 1;
          if (ratioSum30 > 0) {
            multiplier = groupAdVolumeSum / ratioSum30;
          } else {
            const allRatioData = resGroup.data || [];
            const allRatioSum = allRatioData.reduce((acc, curr) => acc + (curr ? (curr.ratio || 0) : 0), 0);
            if (allRatioSum > 0) {
              multiplier = (groupAdVolumeSum * (allRatioData.length / 30)) / allRatioSum;
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
        const now = new Date();
        
        // 캐시 저장
        try {
          const cachePayload = {
            data: processedData,
            lastUpdated: now.toISOString()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
        } catch(e) { console.warn('Cache limit exceeded', e); }

        setRawData(processedData.map(d => ({ ...d, dateObj: d.dateObj ? new Date(d.dateObj) : new Date() })));
        setLastUpdated(now);
      }
    } catch (err) {
      console.error('[ERROR] Datalab Fetch failed:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Raw Data (Trend)
    fetchDatalab();
  }, [cacheKeySuffix]);

  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    
    // 1. 기초 가공 (날짜 객체화)
    const processedRawData = rawData.map(d => ({
      ...d,
      dateObj: d.dateObj instanceof Date ? d.dateObj : new Date(d.dateObj)
    }));

    // 2. 집계 처리 (주간/월간인 경우)
    let displayData = processedRawData;
    if (timeUnit === 'week' || timeUnit === 'month') {
      const groupsMap = {};
      processedRawData.forEach(d => {
        let key;
        if (timeUnit === 'week') {
          key = format(startOfWeek(d.dateObj, { weekStartsOn: 0 }), 'yyyy-MM-dd'); // 일요일 시작(0)
        } else {
          key = format(startOfMonth(d.dateObj), 'yyyy-MM-dd');
        }
        
        if (!groupsMap[key]) {
          groupsMap[key] = { 
            period: key, 
            dateObj: new Date(key),
            _count: 0 
          };
          activeGroups.forEach(g => { if(g && g.id) groupsMap[key][g.id] = 0; });
        }
        
        groupsMap[key]._count += 1;
        activeGroups.forEach(g => { 
          if(g && g.id && d[g.id] !== undefined) groupsMap[key][g.id] += (d[g.id] || 0); 
        });
      });
      
      displayData = Object.values(groupsMap).sort((a,b) => a.dateObj.getTime() - b.dateObj.getTime());
    }

    // 3. 필터링 (선택된 기간)
    const filtered = displayData.filter(d => {
      const dt = d.dateObj.getTime();
      return dt >= startOfDay(customRange.start).getTime() && dt <= endOfDay(customRange.end).getTime();
    });

    if (compareMode === 'none') {
      return filtered.map(d => ({
        ...d,
        period: timeUnit === 'week' ? `${format(d.dateObj, 'yy.MM.dd')}(주)` : 
                timeUnit === 'month' ? format(d.dateObj, 'yy.MM') : d.period
      }));
    }

    // 4. 비교 데이터 매칭
    return filtered.map((prDetail) => {
      const diffTime = Math.abs(startOfDay(customRange.end).getTime() - startOfDay(customRange.start).getTime());
      let shifted;
      if (compareMode === 'yoy') shifted = subYears(prDetail.dateObj, 1);
      else if (compareMode === 'custom') {
        const offset = prDetail.dateObj.getTime() - startOfDay(customRange.start).getTime();
        shifted = new Date(startOfDay(customCompareRange.start).getTime() + offset);
      }
      else shifted = new Date(prDetail.dateObj.getTime() - diffTime);

      // 비교 대상 찾기 (집계된 데이터 전체 범위에서 찾음)
      const comp = displayData.find(d => {
        if (timeUnit === 'date') return format(d.dateObj, 'yyyy-MM-dd') === format(shifted, 'yyyy-MM-dd');
        if (timeUnit === 'week') return format(startOfWeek(d.dateObj, { weekStartsOn: 0 }), 'yyyy-MM-dd') === format(startOfWeek(shifted, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        if (timeUnit === 'month') return format(d.dateObj, 'yyyy-MM') === format(shifted, 'yyyy-MM');
        return false;
      });

      const periodLabel = timeUnit === 'week' ? `${format(prDetail.dateObj, 'yy.MM.dd')}(주)` : 
                          timeUnit === 'month' ? format(prDetail.dateObj, 'yy.MM') : prDetail.period;

      const merged = { 
        ...prDetail, 
        period: periodLabel,
        comparePeriodStr: (shifted && isValid(shifted)) ? format(shifted, timeUnit === 'date' ? 'yy.MM.dd' : (timeUnit === 'week' ? 'yy.MM.dd(주)' : 'yy.MM(월)')) : 'N/A' 
      };
      
      activeGroups.forEach(g => { 
        if(g && g.id) merged[`${g.id}_compare`] = comp ? comp[g.id] : null; 
      });
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
    if (!summaryMetrics) return null;
    const base = summaryMetrics.find(m => m.isBase);
    if (!base) return null;

    const insights = [];
    
    // 1. Growth Insight
    if (base.isPositive) {
      insights.push(`현재 ${base.name}은(는) 전 기간 대비 ${base.changeStr} 상승하며 강력한 성장세를 보이고 있습니다.`);
    } else {
      insights.push(`${base.name}의 검색 지수가 소폭 조정 중이나 브랜드 영향력은 여전히 견고합니다.`);
    }

    return insights;
  }, [summaryMetrics]);


  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // 현재 데이터의 인덱스를 찾아 이전 데이터와 비교할 수 있게 함
      const currentPeriod = payload[0]?.payload?.period;
      const currentIndex = chartData.findIndex(d => d.period === currentPeriod);
      const prevItem = currentIndex > 0 ? chartData[currentIndex - 1] : null;

      const dateObj = payload[0]?.payload?.dateObj || new Date(label);
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      let day = (timeUnit === 'date' && isValid(dateObj)) ? ` (${weekdays[dateObj.getDay()]})` : '';
      
      const brandIds = activeGroups.filter(g => g && selectedBrands[g.id]).map(g => g.id);

      return (
        <div className="custom-tooltip" style={{ backgroundColor: 'rgba(15, 15, 15, 0.95)', border: '1px solid var(--border-color)', padding: '14px 18px', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.6)', minWidth: 220 }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>기준: {(payload[0]?.payload?.period || label) + day}</p>
          
          {compareMode !== 'none' ? (
            payload[0]?.payload?.comparePeriodStr && (
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>비교: {payload[0]?.payload?.comparePeriodStr}</p>
            )
          ) : (
            prevItem && (
              <p style={{ margin: '0 0 12px 0', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, fontStyle: 'italic', opacity: 0.7 }}>
                * 이전 {timeUnit === 'date' ? '일' : timeUnit === 'week' ? '주' : '월'} 대비 증감률 표시
              </p>
            )
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {brandIds.map((brandId) => {
              const g = activeGroups.find(x => x && x.id === brandId);
              if (!g) return null;
              
              const colorIdx = activeGroups.indexOf(g);
              const entryColor = PALETTE[colorIdx % PALETTE.length];
              
              const refItem = payload.find(p => p.dataKey === brandId);
              const refVal = refItem?.value || 0;
              
              let compVal = 0;
              let isAutoCompare = false;

              if (compareMode !== 'none') {
                const compItem = payload.find(p => p.dataKey === `${brandId}_compare`);
                compVal = compItem?.value || 0;
              } else if (prevItem) {
                compVal = prevItem[brandId] || 0;
                isAutoCompare = true;
              }
              
              let pctNode = null;
              if (compVal > 0) {
                const pct = ((refVal - compVal) / compVal) * 100;
                const isPos = pct > 0;
                const isNeg = pct < 0;
                pctNode = (
                  <span style={{ fontSize: 11, fontWeight: 800, color: isPos ? '#4ade80' : isNeg ? '#f87171' : 'var(--text-secondary)', background: isPos ? 'rgba(74, 222, 128, 0.15)' : isNeg ? 'rgba(248, 113, 113, 0.15)' : 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', minWidth: 48, justifyContent: 'center' }}>
                    {isPos ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                );
              } else if (refVal > 0 && (compareMode !== 'none' || isAutoCompare)) {
                pctNode = <span style={{ fontSize: 11, fontWeight: 800, color: '#4ade80', background: 'rgba(74, 222, 128, 0.15)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', minWidth: 48, justifyContent: 'center' }}>+100.0%</span>;
              }

              return (
                <div key={brandId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: entryColor }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{g.name}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                      {compareMode !== 'none' && (
                        <span style={{ textDecoration: 'line-through', opacity: 0.4, fontSize: 10, fontWeight: 400 }}>{Math.round(compVal).toLocaleString()}</span>
                      )}
                      <span style={{ color: '#fff' }}>{Math.round(refVal).toLocaleString()}</span>
                    </div>
                    {pctNode}
                  </div>
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
        // 키워드 내 띄어쓰기 자동 제거 (나이키 러닝화 → 나이키러닝화)
        keywords: (g.keywordsString || '').split(',').map(s => s.trim().replace(/\s+/g, '')).filter(Boolean)
      }))
      .filter(g => g.name && g.keywords.length > 0);
    if (valid.length === 0) { alert(`${groupLabel}과 키워드를 최소 1개 이상 입력해 주세요.`); return; }
    setActiveGroups(valid);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(valid));
    setIsEditingGroups(false);
  };

  const handleGoogleTrends = () => {
    // 활성화된(선택된) 그룹들의 대표 키워드만 추출 (구글 트렌드는 한 번에 최대 5개 키워드까지 비교 가능)
    const keywords = activeGroups
      .filter(g => g && selectedBrands[g.id])
      .map(g => (g.keywords && g.keywords.length > 0) ? g.keywords[0] : g.name)
      .slice(0, 5)
      .join(',');

    if (!keywords) {
      alert('비교할 키워드를 1개 이상 선택해주세요.');
      return;
    }
    
    const startStr = format(customRange.start, 'yyyy-MM-dd');
    const endStr = format(customRange.end, 'yyyy-MM-dd');
    
    const url = `https://trends.google.com/trends/explore?date=${startStr}%20${endStr}&geo=KR&q=${keywords}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {subtitle && <p style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>{subtitle}</p>}
            {lastUpdated && (
              <span style={{ 
                fontSize: 11, 
                color: 'var(--accent-primary)', 
                background: 'rgba(56, 189, 248, 0.08)', 
                padding: '4px 10px', 
                borderRadius: 6, 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                border: '1px solid rgba(56, 189, 248, 0.2)'
              }}>
                <RefreshCw size={10} />
                업데이트: {format(lastUpdated, 'yyyy.MM.dd HH:mm:ss')}
              </span>
            )}
          </div>
        </div>
        
        <div className="header-controls" style={{ display: 'flex', gap: 16, alignItems: 'center', width: '100%', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="time-filters" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              {['date', 'week', 'month', 'custom'].map(unit => (
                <button key={unit} className={`btn btn-sm ${timeUnit === unit ? 'active' : ''}`} onClick={() => setTimeUnit(unit)} style={{ padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, backgroundColor: timeUnit === unit ? 'var(--accent-primary)' : 'transparent', color: timeUnit === unit ? 'var(--bg-dark)' : 'var(--text-secondary)', border: 'none', transition: 'all 0.2s' }}>
                  {unit === 'date' ? '일간' : unit === 'week' ? '주간' : unit === 'month' ? '월간' : '지정'}
                </button>
              ))}
            </div>
            {timeUnit === 'week' && (
              <div style={{ fontSize: 11, color: 'var(--accent-primary)', opacity: 0.8, fontWeight: 600, paddingLeft: 4 }}>
                * 주간의 기준은 나이키의 기준인 일~토로 산정합니다
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>기준 기간:</span>
            <div className="date-picker-group" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 18px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <Calendar size={15} color="var(--accent-primary)" />
              <input type="date" value={isValid(customRange.start) ? format(customRange.start, 'yyyy-MM-dd') : ''} onChange={(e) => setCustomRange(p => ({...p, start: new Date(e.target.value)}))} style={{ colorScheme: 'dark', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>~</span>
              <input type="date" value={isValid(customRange.end) ? format(customRange.end, 'yyyy-MM-dd') : ''} onChange={(e) => {
                const picked = new Date(e.target.value);
                const yesterday = subDays(new Date(), 1);
                setCustomRange(p => ({...p, end: picked > yesterday ? yesterday : picked}));
              }} style={{ colorScheme: 'dark', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
            </div>
          </div>

          <div className="divider" style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

          <div className="compare-select" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>비교 대상 기간:</span>
            <select className="styled-select" value={compareMode} onChange={(e) => setCompareMode(e.target.value)} style={{ padding: '10px 40px 10px 16px', fontSize: 13, fontWeight: 700, borderRadius: 12, minWidth: 140, backgroundColor: '#1a1a1a', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="none" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>없음</option>
              <option value="prev_period" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>이전 기간</option>
              <option value="yoy" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>전년 동기</option>
              <option value="custom" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>직접 지정</option>
            </select>
            {compareMode === 'custom' && (
              <div className="date-picker-group" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 18px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <Calendar size={15} color="var(--text-secondary)" />
                <input type="date" value={isValid(customCompareRange.start) ? format(customCompareRange.start, 'yyyy-MM-dd') : ''} onChange={(e) => setCustomCompareRange(p => ({...p, start: new Date(e.target.value)}))} style={{ colorScheme: 'dark', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>~</span>
                <input type="date" value={isValid(customCompareRange.end) ? format(customCompareRange.end, 'yyyy-MM-dd') : ''} onChange={(e) => {
                  const picked = new Date(e.target.value);
                  const yesterday = subDays(new Date(), 1);
                  setCustomCompareRange(p => ({...p, end: picked > yesterday ? yesterday : picked}));
                }} style={{ colorScheme: 'dark', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none' }} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 카테고리별 검색어 매핑 설정 (상단 배치) */}
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
                {groupLabel}과 검색 키워드를 직접 설정할 수 있습니다. 키워드는 <strong style={{color:'var(--text-primary)'}}>쉼표(,)</strong>로 구분하여 입력하세요. (최대 5개)
              </p>

              <div style={{ display: 'flex', gap: 12, padding: '0 58px 8px 42px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span style={{ width: 180, flexShrink: 0 }}>{groupLabel}</span>
                <span style={{ flex: 1 }}>검색 키워드 (쉼표 구분)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {draftGroups.map((g, idx) => (
                  <div key={g.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: getGroupColor(idx), flexShrink: 0 }} />
                    <input
                      type="text"
                      value={g.name || ''}
                      onChange={(e) => setDraftGroups(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))}
                      placeholder={groupLabel}
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

              {draftGroups.length < 5 && (
                <button
                  onClick={addDraftGroup}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.25)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                >
                  <Plus size={14} /> {groupLabel} 추가 ({draftGroups.length}/5)
                </button>
              )}

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
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, opacity: 0.75 }}>
                기준 {groupLabel}을(를) 선택하세요.
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

      {/* 요약 카드 위젯 (크래시 방지 가드 추가) */}
      {showSummaryCards && summaryMetrics && Array.isArray(summaryMetrics) && summaryMetrics.length > 0 && (
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
      

      <div className="chart-container glass-card" style={{ padding: '36px 44px', marginBottom: 36 }}>
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
                    {format(customRange.start, timeUnit === 'month' ? 'yyyy.MM' : 'yyyy.MM.dd')} ~ {format(customRange.end, timeUnit === 'month' ? 'yyyy.MM' : 'yyyy.MM.dd')}
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

            {/* 브랜드 토글 & 데이터 다운로드 (우측 정렬 및 다운로드 끝으로 밀기) */}
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

              {/* 구글 트렌드 연동 버튼 */}
              <button 
                onClick={handleGoogleTrends}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.2s',
                  marginLeft: 'auto'
                }}
              >
                <ExternalLink size={14} />
                구글 트렌드 함께 보기
              </button>

              {/* 데이터 다운 버튼 (맨 우측 끝 배치) */}
              <button 
                onClick={handleDownload}
                disabled={loading || !chartData || chartData.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.2s',
                  opacity: (loading || !chartData || chartData.length === 0) ? 0.3 : 1,
                  pointerEvents: (loading || !chartData || chartData.length === 0) ? 'none' : 'auto',
                  marginLeft: 'auto'
                }}
              >
                <Download size={14} />
                데이터 다운
              </button>
            </div>
          </div>
        </div>
        <div style={{ width: '100%', height: 440, minHeight: 440, position: 'relative' }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }} dy={14} tickFormatter={(val) => typeof val === 'string' ? val.split('-').slice(1).join('/') : val} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }} tickFormatter={(val) => val >= 1000 ? (val/1000).toFixed(0) + 'k' : val} />
              <Tooltip content={<CustomTooltip />} />
              {activeGroups.map((g, idx) => g && selectedBrands[g.id] && (
                <Line key={g.id} type="monotone" dataKey={g.id} stroke={PALETTE[idx % PALETTE.length]} strokeWidth={g.id === baseGroupId ? 5 : 1.5} dot={false} activeDot={{ r: g.id === baseGroupId ? 7 : 4, fill: PALETTE[idx % PALETTE.length] }} opacity={g.id === baseGroupId ? 1 : 0.7} animationDuration={1200} />
              ))}
              {compareMode !== 'none' && activeGroups.map((g, idx) => g && selectedBrands[g.id] && (
                <Line key={`${g.id}_compare`} type="monotone" dataKey={`${g.id}_compare`} stroke={PALETTE[idx % PALETTE.length]} strokeWidth={g.id === baseGroupId ? 3.5 : 1} strokeDasharray="5 4" dot={false} activeDot={{ r: g.id === baseGroupId ? 5 : 3, fill: PALETTE[idx % PALETTE.length] }} opacity={g.id === baseGroupId ? 0.6 : 0.4} animationDuration={1200} legendType="none" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 인구통계 분석 섹션 (임시 블라인드 처리) */}
      <div className="insight-section glass-card" style={{ marginBottom: 36, padding: '32px 32px', background: 'rgba(255,255,255,0.02)', borderLeft: '4px solid #facc15', minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
        <div style={{ fontSize: 24 }}>🚧 🛠️ 🚧</div>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>인구통계(성별/연령) 분석 서비스 준비중</h4>
      </div>
    </div>
  );
}
