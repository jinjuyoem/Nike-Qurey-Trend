import axios from 'axios';

export default async function handler(req, res) {
  const clientId = process.env.VITE_NAVER_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.VITE_NAVER_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(401).json({
      error: 'Naver API keys are missing.',
      message: '다른 컴퓨터에서 실행하려면 .env 파일에 VITE_NAVER_CLIENT_ID와 VITE_NAVER_CLIENT_SECRET을 설정해야 합니다.'
    });
  }

  // 프론트엔드에서 넘어온 경로를 타겟 URL로 변환
  // Vercel 환경에서 req.url이 전체 URL일 수 있으므로 안전하게 처리
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const targetPath = urlObj.pathname.replace('/api/naver-datalab', '');
  const url = `https://openapi.naver.com${targetPath}${urlObj.search}`;

  try {
    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        'Content-Type': 'application/json'
      }
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('DataLab Proxy Error:', error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
}
