import axios from 'axios';
import crypto from 'crypto-js';

// 기본 정보 (브라우저 노출 가능)
const LICENSE_KEY = '01000000000c0941d2c71e0667d5da49ea25352b60d9bf313e683d709ecaecfaaec9cccf9c';
const CUSTOMER_ID = '3462476';

// 서버측 환경 변수 (브라우저 노출 불가)
const SECRET_KEY = process.env.VITE_NAVER_SEARCHAD_SECRET || process.env.NAVER_SEARCHAD_SECRET || 'AQAAAAAMCUHSxx4GZ9XaSeolNStg8RgYtE150z1Is9UQ2+q0dw==';

export default async function handler(req, res) {
  // 프론트엔드에서 넘어온 경로 (예: /keywordstool?hintKeywords=...)를 타겟 URL로 변환
  const targetRelativePath = req.url.replace('/api/naver-searchad', '');
  const url = `https://api.searchad.naver.com${targetRelativePath}`;
  
  // 시그니처 생성을 위한 URI (쿼리 스트링 제외)
  const uri = targetRelativePath.split('?')[0];
  const timestamp = Date.now().toString();
  const method = req.method.toUpperCase();
  
  const message = timestamp + "." + method + "." + uri;
  const signature = crypto.enc.Base64.stringify(crypto.HmacSHA256(message, SECRET_KEY));

  try {
    const response = await axios({
      method: method,
      url: url,
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': LICENSE_KEY,
        'X-Signature': signature,
        'X-Customer': CUSTOMER_ID,
        'Content-Type': 'application/json'
      }
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('SearchAd Proxy Error:', error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
}
