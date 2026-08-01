const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const crypto = require('crypto');

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

function logServer(type, message, details = "") {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const detailStr = details ? ` | ${JSON.stringify(details)}` : '';
    console.log(`[${timestamp}] [${type.padEnd(18)}] ${message}${detailStr}`);
}

const wss = new WebSocket.Server({ server });

const users = new Map();
const userLastSeen = new Map();
const callHistory = [];
const globalChatMessages = [];

function broadcastUserList() {
    const userList = Array.from(users.values()).map(u => ({
        username: u.username,
        isOnline: true,
        activeChatTarget: u.activeChatTarget || null
    }));

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

function addCallRecord(caller, receiver, status, isAudioOnly = false, duration = "00:00") {
    const record = {
        id: Date.now(),
        caller,
        receiver,
        status,
        isAudioOnly,
        duration,
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

wss.on('connection', (ws, req) => {
    ws.socketId = crypto.randomBytes(4).toString('hex');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    ws.isBusy = false;
    ws.activeChatTarget = null;

    logServer("SOCKET_CONNECTED", `Yeni cihaz bağlandı. Socket ID: ${ws.socketId}`, { ip: clientIp });

    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        switch (data.type) {
            case "LOGIN": {
                const rawUsername = data.payload.username.trim();
                const lowerUsername = rawUsername.toLowerCase();

                if (users.has(lowerUsername)) {
                    logServer("LOGIN_FAILED", `Çakışan kullanıcı adı: "${rawUsername}"`, { socketId: ws.socketId });
                    ws.send(JSON.stringify({
                        type: "LOGIN_RESULT",
                        success: false,
                        message: `"${rawUsername}" adında biri zaten oturum açmış!`
                    }));
                    return;
                }

                ws.username = rawUsername;
                ws.userKey = lowerUsername;
                ws.isBusy = false;

                users.set(lowerUsername, ws);
                logServer("USER_LOGIN", `Giriş yapıldı: "${rawUsername}"`, { socketId: ws.socketId, totalOnline: users.size });

                ws.send(JSON.stringify({ type: "LOGIN_RESULT", success: true, username: rawUsername }));

                const updatedSenders = new Set();
                globalChatMessages.forEach(msg => {
                    if (msg.receiver.toLowerCase() === lowerUsername && msg.status === 'SENT') {
                        msg.status = 'DELIVERED';
                        updatedSenders.add(msg.sender.toLowerCase());
                    }
                });

                updatedSenders.forEach(senderKey => {
                    const senderWs = findUser(senderKey);
                    if (senderWs && senderWs.readyState === WebSocket.OPEN) {
                        senderWs.send(JSON.stringify({
                            type: "MESSAGES_DELIVERED_NOTIFICATION",
                            payload: { toUser: rawUsername }
                        }));
                    }
                });

                broadcastUserList();
                sendCallHistory(ws);
                break;
            }

            case "CALL_REQUEST": {
                const targetName = data.payload.target;
                const isAudioOnly = data.payload.isAudioOnly || false;
                const targetWs = findUser(targetName);

                if (!targetWs) {
                    addCallRecord(ws.username, targetName, "MISSED", isAudioOnly, "00:00");
                    ws.send(JSON.stringify({ type: "ERROR", message: "Kullanıcı çevrimdışı." }));
                    break;
                }
                if (targetWs === ws) {
                    ws.send(JSON.stringify({ type: "ERROR", message: "Kendinizi arayamazsınız!" }));
                    break;
                }
                if (targetWs.isBusy) {
                    addCallRecord(ws.username, targetName, "REJECTED", isAudioOnly, "00:00");
                    ws.send(JSON.stringify({ type: "ERROR", message: `"${targetWs.username}" şu anda meşgul.` }));
                    break;
                }

                ws.isBusy = true;
                targetWs.isBusy = true;
                ws.otherName = targetWs.username;
                targetWs.otherName = ws.username;
                ws.isAudioOnlyCall = isAudioOnly;
                targetWs.isAudioOnlyCall = isAudioOnly;
                ws.callStartTime = null;

                targetWs.send(JSON.stringify({
                    type: "INCOMING_CALL",
                    payload: { caller: ws.username, isAudioOnly: isAudioOnly }
                }));
                break;
            }

            case "CALL_ACCEPT": {
                const callerWs = findUser(data.payload.target);
                if (callerWs) {
                    const startTime = Date.now();
                    callerWs.callStartTime = startTime;
                    ws.callStartTime = startTime;
                    callerWs.send(JSON.stringify({ type: "CALL_ACCEPTED", payload: { sender: ws.username } }));
                }
                break;
            }

            case "CALL_REJECT": {
                addCallRecord(data.payload.target, ws.username, "REJECTED", ws.isAudioOnlyCall || false, "00:00");
                const rWs = findUser(data.payload.target);
                ws.isBusy = false;
                if (rWs) {
                    rWs.isBusy = false;
                    rWs.send(JSON.stringify({ type: "CALL_REJECT" }));
                }
                break;
            }

            case "OFFER":
            case "ANSWER":
            case "ICE_CANDIDATE":
            case "MEDIA_STATE_CHANGE": {
                const relWs = findUser(data.payload.target);
                if (relWs) {
                    data.payload.sender = ws.username;
                    relWs.send(JSON.stringify(data));
                }
                break;
            }

            case "LEAVE": {
                handleUserLeave(ws, "COMPLETED");
                break;
            }

            case "SEND_MESSAGE": {
                const { target, text } = data.payload;
                const targetWs = findUser(target);

                let initialStatus = 'SENT';
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    initialStatus = (targetWs.activeChatTarget === ws.username.toLowerCase()) ? 'READ' : 'DELIVERED';
                }

                const messageData = {
                    id: Date.now() + Math.random().toString(36).substring(2, 5),
                    sender: ws.username,
                    receiver: target,
                    text: text,
                    timestamp: Date.now(),
                    status: initialStatus
                };

                globalChatMessages.push(messageData);
                if (globalChatMessages.length > 1000) globalChatMessages.shift();

                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({ type: "RECEIVE_MESSAGE", payload: messageData }));
                }

                ws.send(JSON.stringify({ type: "MESSAGE_SENT_ACK", payload: messageData }));
                break;
            }

            case "OPEN_CHAT": {
                const targetLower = (data.payload.target || "").toLowerCase();
                ws.activeChatTarget = targetLower;

                let updated = false;
                globalChatMessages.forEach(msg => {
                    if (msg.sender.toLowerCase() === targetLower && msg.receiver.toLowerCase() === ws.userKey && msg.status !== 'READ') {
                        msg.status = 'READ';
                        updated = true;
                    }
                });

                const senderWs = findUser(data.payload.target);
                if (senderWs && senderWs.readyState === WebSocket.OPEN) {
                    senderWs.send(JSON.stringify({
                        type: "MESSAGES_READ_NOTIFICATION",
                        payload: { byUser: ws.username }
                    }));
                }
                break;
            }

            case "CLOSE_CHAT": {
                ws.activeChatTarget = null;
                break;
            }

            case "GET_CHAT_HISTORY": {
                const peerName = (data.payload.target || "").toLowerCase();
                const history = globalChatMessages.filter(m =>
                    (m.sender.toLowerCase() === ws.userKey && m.receiver.toLowerCase() === peerName) ||
                    (m.sender.toLowerCase() === peerName && m.receiver.toLowerCase() === ws.userKey)
                );

                const peerWs = findUser(peerName);
                const lastSeenTime = userLastSeen.get(peerName) || null;

                ws.send(JSON.stringify({
                    type: "CHAT_HISTORY_RESPONSE",
                    payload: {
                        target: data.payload.target,
                        history: history,
                        isOnline: !!peerWs,
                        lastSeen: lastSeenTime
                    }
                }));
                break;
            }

            case "GET_ALL_RECENT_CHATS": {
                const myKey = ws.userKey;
                const summaryMap = new Map();

                globalChatMessages.forEach(msg => {
                    const sKey = msg.sender.toLowerCase();
                    const rKey = msg.receiver.toLowerCase();

                    if (sKey === myKey || rKey === myKey) {
                        const otherPerson = sKey === myKey ? msg.receiver : msg.sender;
                        const otherKey = otherPerson.toLowerCase();

                        if (!summaryMap.has(otherKey)) {
                            summaryMap.set(otherKey, { username: otherPerson, lastMsg: msg, unreadCount: 0 });
                        } else {
                            const existing = summaryMap.get(otherKey);
                            if (msg.timestamp > existing.lastMsg.timestamp) {
                                existing.lastMsg = msg;
                            }
                        }

                        if (rKey === myKey && msg.status !== 'READ') {
                            const existing = summaryMap.get(otherKey);
                            existing.unreadCount++;
                        }
                    }
                });

                ws.send(JSON.stringify({
                    type: "RECENT_CHATS_RESPONSE",
                    payload: Array.from(summaryMap.values())
                }));
                break;
            }
        }
    });

    ws.on('close', () => {
        if (ws.userKey) {
            userLastSeen.set(ws.userKey, Date.now());
            logServer("USER_LOGOUT", `Ayrıldı: "${ws.username}"`, { socketId: ws.socketId });
            handleUserLeave(ws, "COMPLETED");
            users.delete(ws.userKey);
            broadcastUserList();
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

        addCallRecord(ws.username, ws.otherName, status, ws.isAudioOnlyCall || false, durationStr);

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
    console.log("\n=======================================================");
    console.log(" WHATSAPP SOHBET VE WEBRTC SUNUCUSU (PORT: 8000) ");
    console.log("=======================================================\n");
});