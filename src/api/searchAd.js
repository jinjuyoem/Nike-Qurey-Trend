import axios from 'axios';

/**
 * 키워드 배열을 받아서 네이버 검색광고 API를 통해 30일 누적 검색량을 가져옵니다.
 * 서버측 Proxy(/api/naver-searchad)를 거쳐 서명(Signature)을 생성하고 호출하도록 변경되었습니다.
 * 이제 프론트엔드 코드에는 어떠한 비밀키도 포함되지 않습니다.
 */
export const fetchKeywordAdVolumes = async (keywords) => {
  const uniqueKeywords = [...new Set(keywords)].filter(Boolean);
  if (uniqueKeywords.length === 0) return {};

  const volumeMap = {};
  
  // 5개씩 청크 분할
  for (let i = 0; i < uniqueKeywords.length; i += 5) {
    const chunk = uniqueKeywords.slice(i, i + 5);
    // 공백이 포함된 키워드는 네이버 검색광고 API에서 400 에러를 유발할 수 있으므로 공백 제거
    const hintKeywords = chunk.map(k => k.replace(/\s+/g, '')).join(',');
    const uri = '/keywordstool';
    
    try {
      // 서버측 프록시를 호출합니다. (서명 및 인증 헤더는 서버에서 추가됨)
      const response = await axios.get(`/api/naver-searchad${uri}?hintKeywords=${encodeURIComponent(hintKeywords)}&showDetail=1`);
      
      const list = response.data?.keywordList || [];
      list.forEach(item => {
        // "< 10" 처럼 떨어지는 경우를 위해 10으로 방어적 형변환
        let pc = String(item.monthlyPcQcCnt).replace(/<|[^0-9]/g, '');
        let mobile = String(item.monthlyMobileQcCnt).replace(/<|[^0-9]/g, '');
        
        pc = parseInt(pc, 10);
        mobile = parseInt(mobile, 10);
        
        if (isNaN(pc)) pc = 10;
        if (isNaN(mobile)) mobile = 10;
        
        volumeMap[item.relKeyword] = pc + mobile;
      });
    } catch (error) {
      console.error('검색광고 API 오류 (브라우저):', error.message);
    }
  }

  return volumeMap;
};
