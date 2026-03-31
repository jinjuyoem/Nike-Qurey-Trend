import axios from 'axios';

export default async function handler(req, res) {
  // 프론트엔드에서 넘어온 경로 (예: /v1/datalab/search)를 타겟 URL로 변환
  const targetPath = req.url.replace('/api/naver-datalab', '');
  const url = `https://openapi.naver.com${targetPath}`;

  try {
    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      headers: {
        'X-Naver-Client-Id': process.env.VITE_NAVER_CLIENT_ID || process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.VITE_NAVER_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET,
        'Content-Type': 'application/json'
      }
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('DataLab Proxy Error:', error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
}
