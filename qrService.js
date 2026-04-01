const jwt = require('jsonwebtoken');
const fs = require('fs');
const zlib = require('zlib');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Official private key path
const privateKeyPath = '/home/bel/nginx_certs/certificates/private.key';

class QRService {
    async generateAadhaarQR() {
        try {
            if (!fs.existsSync(privateKeyPath)) {
                throw new Error("Private key missing at " + privateKeyPath);
            }
            const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
            
            // FIX: Set iat to 10 seconds ago to prevent "Token is from the future" error
            const now = Math.floor(Date.now() / 1000) - 10;
            const exp = now + 300; // 5 minutes validity

            // Generate clean UUID without dashes (safest for all mAadhaar versions)
            const transactionId = crypto.randomUUID().replace(/-/g, '');

            // FIX: Explicit 64-bit bitmap
            // Current selection: Name, Photo, DOB, Gender
            const sc64 = "0000000000000000000000000000000000000000000000000000000000110110";

            const payload = {
                "txn": transactionId,
                "i": "credential",
                "lang": "23",
                "sc": "0000000000000000000000000000000000000000000000000000000000110110",
                "pop": 1,
                "ch": "qr",
                "m": "1",
                "ac": "bel", 
                "sa": "00b1",
                "cb": "https://biometric.bel.in/getAadhaarData",
                "aud": "biometric.bel.in", 
                
                // FIX: Changed to Production URL for Play Store App
                "iss": "https://uidai.gov.in", 
                
                "exp": now + 300,
                "iat": now,
                "ht": "BEL VISITOR",
                "aid": "in.gov.uidai.samvaad",
                "asig": "",
                "jti": crypto.randomUUID()
            };

            // Sign the token with mandatory headers
            const token = jwt.sign(payload, privateKey, {
                algorithm: 'RS256',
                header: {
                    "alg": "RS256",
                    "typ": "JWT"
                }
            });

            console.log("----- DEBUG: TOKEN FOR JWT.IO -----");
            console.log(token);
            console.log("-----------------------------------");

            // Encoding Logic (Exact Python Match)
            let buffer = Buffer.from(token, 'latin1'); // ISO-8859-1
            let dataWithDelimiter = Buffer.concat([buffer, Buffer.from([255])]);
            const compressedData = zlib.gzipSync(dataWithDelimiter);

            const bigIntVal = BigInt('0x' + compressedData.toString('hex'));
            const qrCodeValue = bigIntVal.toString(10);

            const finalUrl = `https://maadhaar.com/getIntent?value=${qrCodeValue}`;

            const qrImageBase64 = await QRCode.toDataURL(finalUrl, {
                errorCorrectionLevel: 'H',
                margin: 4,
                scale: 10
            });

            console.log("✅ QR Successfully Generated. TxnID:", transactionId);

            return {
                qrCode: qrImageBase64,
                txnId: transactionId
            };

        } catch (error) {
            console.error("QR Error:", error.message);
            throw error;
        }
    }
}

module.exports = new QRService();
