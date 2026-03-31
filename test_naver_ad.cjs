const axios = require('axios');
const crypto = require('crypto-js');

const LICENSE_KEY = '01000000000c0941d2c71e0667d5da49ea25352b60d9bf313e683d709ecaecfaaec9cccf9c';
const SECRET_KEY = 'AQAAAAAMCUHSxx4GZ9XaSeolNStg8RgYtE150z1Is9UQ2+q0dw==';
const CUSTOMER_ID = '3462476';

const test = async () => {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const uri = '/keywordstool';
    const message = timestamp + "." + method + "." + uri;
    const signature = crypto.enc.Base64.stringify(crypto.HmacSHA256(message, SECRET_KEY));

    try {
        const response = await axios.get(`https://api.naver.com${uri}?hintKeywords=나이키,아디다스&showDetail=1`, {
            headers: {
                'X-Timestamp': timestamp,
                'X-API-KEY': LICENSE_KEY,
                'X-Signature': signature,
                'X-Customer': CUSTOMER_ID 
            }
        });
        if (response.data.keywordList && response.data.keywordList.length > 0) {
            console.log("Sample:", response.data.keywordList.slice(0, 2));
        }
    } catch (e) {
        console.log("Error:", e.response ? e.response.data : e.message);
    }
};

test();
