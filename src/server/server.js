const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const crypto = require('crypto'); // Unique ID üretimi için built-in kütüphane

// STATİK WEB SUNUCUSU
const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, '../../www', req.url === '/' ? 'index.html' : req.url);
    let extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpg'; break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end("Dosya bulunamadi");
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// LOG YARDIMCI FONKSİYONU (Zaman Damgalı ve Kategorili)
function logServer(type, message, details = "") {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const detailStr = details ? ` | ${JSON.stringify(details)}` : '';
    console.log(`[${timestamp}] [${type.padEnd(18)}] ${message}${detailStr}`);
}

// WEBSOCKET SUNUCUSU
const wss = new WebSocket.Server({ server });

const users = new Map();
const callHistory = [];

function broadcastUserList() {
    const userList = Array.from(users.values()).map(u => u.username);
    const message = JSON.stringify({ type: "USER_LIST", payload: { users: userList } });
    users.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
}

function sendCallHistory(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CALL_HISTORY", payload: { history: callHistory } }));
    }
}

function addCallRecord(caller, receiver, status, duration = "00:00") {
    const record = {
        id: Date.now(), caller, receiver, status, duration,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };
    callHistory.unshift(record);
    if (callHistory.length > 30) callHistory.pop();
    users.forEach((ws) => sendCallHistory(ws));
}

function findUser(username) {
    if (!username) return null;
    return users.get(username.trim().toLowerCase());
}

// WEBSOCKET BAĞLANTILARI
wss.on('connection', (ws, req) => {
    // 1. HER BAĞLANTIYA BENZERSİZ BİR SOCKET ID VE IP ATA
    ws.socketId = crypto.randomBytes(4).toString('hex');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    ws.isBusy = false;

    logServer("SOCKET_CONNECTED", `Yeni cihaz bağlandı. Socket ID: ${ws.socketId}`, { ip: clientIp });

    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        switch (data.type) {
            case "LOGIN":
                const rawUsername = data.payload.username.trim();
                const lowerUsername = rawUsername.toLowerCase();

                if (users.has(lowerUsername)) {
                    logServer("LOGIN_FAILED", `Çakışan kullanıcı adı denemesi: "${rawUsername}"`, { socketId: ws.socketId });
                    ws.send(JSON.stringify({
                        type: "LOGIN_RESULT",
                        success: false,
                        message: `"${rawUsername}" adında bir kullanıcı zaten oturum açmış!`
                    }));
                    return;
                }

                ws.username = rawUsername;
                ws.userKey = lowerUsername;
                ws.isBusy = false;

                users.set(lowerUsername, ws);

                // 2. KULLANICI GİRİŞ LOGU
                logServer("USER_LOGIN", `Kullanıcı giriş yaptı: "${rawUsername}"`, { socketId: ws.socketId, totalOnline: users.size });

                ws.send(JSON.stringify({ type: "LOGIN_RESULT", success: true, username: rawUsername }));
                broadcastUserList();
                sendCallHistory(ws);
                break;

            case "CALL_REQUEST":
                const targetName = data.payload.target;
                const isAudioOnly = data.payload.isAudioOnly || false;
                const targetWs = findUser(targetName);

                if (!targetWs) {
                    logServer("CALL_FAILED", `Arama başarısız: "${targetName}" çevrimdışı.`, { caller: ws.username });
                    ws.send(JSON.stringify({ type: "ERROR", message: "Kullanıcı çevrimdışı." }));
                    break;
                }

                if (targetWs === ws) {
                    ws.send(JSON.stringify({ type: "ERROR", message: "Kendinizi arayamazsınız!" }));
                    break;
                }

                if (targetWs.isBusy) {
                    logServer("CALL_BUSY", `Arama engellendi: "${targetWs.username}" meşgul.`, { caller: ws.username });
                    ws.send(JSON.stringify({
                        type: "ERROR",
                        message: `"${targetWs.username}" şu anda başka bir görüşmede (Meşgul).`
                    }));
                    break;
                }

                ws.isBusy = true;
                targetWs.isBusy = true;

                ws.otherName = targetWs.username;
                targetWs.otherName = ws.username;
                ws.callStartTime = null;

                // 3. ARAMA BAŞLATMA LOGU
                const callTypeStr = isAudioOnly ? "SESLİ" : "GÖRÜNTÜLÜ";
                logServer("CALL_REQUEST", `[${callTypeStr}] "${ws.username}" -> "${targetWs.username}" arıyor...`);

                targetWs.send(JSON.stringify({
                    type: "INCOMING_CALL",
                    payload: { caller: ws.username, isAudioOnly: isAudioOnly }
                }));
                break;

            case "CALL_ACCEPT":
                const callerWs = findUser(data.payload.target);
                if (callerWs) {
                    const startTime = Date.now();
                    callerWs.callStartTime = startTime;
                    ws.callStartTime = startTime;

                    // 4. ARAMA KABUL LOGU
                    logServer("CALL_ACCEPTED", `Arama kabul edildi: "${ws.username}" <-> "${callerWs.username}"`);

                    callerWs.send(JSON.stringify({ type: "CALL_ACCEPTED", payload: { sender: ws.username } }));
                }
                break;

            case "CALL_REJECT":
                logServer("CALL_REJECTED", `Arama reddedildi: "${ws.username}" ("${data.payload.target}" aramasını reddetti)`);
                addCallRecord(data.payload.target, ws.username, "REJECTED", "00:00");
                const rWs = findUser(data.payload.target);

                ws.isBusy = false;
                if (rWs) {
                    rWs.isBusy = false;
                    rWs.send(JSON.stringify({ type: "CALL_REJECT" }));
                }
                break;

            case "OFFER":
            case "ANSWER":
            case "ICE_CANDIDATE":
            case "MEDIA_STATE_CHANGE":
                const relWs = findUser(data.payload.target);
                if (relWs) {
                    data.payload.sender = ws.username;
                    relWs.send(JSON.stringify(data));
                }
                break;

            case "LEAVE":
                logServer("CALL_ENDED_USER", `Arama kullanıcı tarafından sonlandırıldı: "${ws.username}"`);
                handleUserLeave(ws, "COMPLETED");
                break;
        }
    });

    ws.on('close', () => {
        // 5. BAĞLANTI KOPMA VE ÇIKIŞ LOGU
        if (ws.userKey) {
            logServer("USER_LOGOUT", `Kullanıcı ayrıldı: "${ws.username}"`, { socketId: ws.socketId });
            handleUserLeave(ws, "COMPLETED");
            users.delete(ws.userKey);
            broadcastUserList();
        } else {
            logServer("SOCKET_DISCONNECTED", `Bağlantı koptu (Giriş yapılmamıştı). Socket ID: ${ws.socketId}`);
        }
    });
});

function handleUserLeave(ws, defaultStatus) {
    ws.isBusy = false;

    if (ws && ws.otherName) {
        const otherWs = findUser(ws.otherName);
        let durationStr = "00:00";
        let status = defaultStatus;

        if (ws.callStartTime) {
            const seconds = Math.floor((Date.now() - ws.callStartTime) / 1000);
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            durationStr = `${mins}:${secs}`;
            status = "COMPLETED";
        } else if (defaultStatus !== "REJECTED") {
            status = "MISSED";
        }

        // 6. GÖRÜŞME BİTİŞ LOGU
        logServer("CALL_FINISHED", `Görüşme Bitti: "${ws.username}" <-> "${ws.otherName}" | Süre: ${durationStr} | Durum: ${status}`);

        addCallRecord(ws.username, ws.otherName, status, durationStr);

        if (otherWs) {
            otherWs.isBusy = false;
            otherWs.send(JSON.stringify({ type: "LEAVE" }));
            otherWs.otherName = null;
            otherWs.callStartTime = null;
        }
        ws.otherName = null;
        ws.callStartTime = null;
    }
}

server.listen(8000, () => {
    console.log("\n=======================================================================");
    console.log(" SUNUCU BAŞLATILDI (PORT: 8000)");
    console.log(" Detaylı Loglama, Socket ID Atamaları ve Meşgul Durumları Aktif!");
    console.log("=======================================================================\n");
});