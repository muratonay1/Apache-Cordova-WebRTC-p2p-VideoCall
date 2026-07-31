const STATES = {
    LOGGED_OUT: 'LOGGED_OUT',
    IDLE: 'IDLE',
    IN_CALL: 'IN_CALL'
};

function formatTimeAgo(timestamp) {
    if (!timestamp) return "";
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return "az önce";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}dk`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}saat`;
    return "Dün";
}

class SoundEffects {
    constructor() { this.ctx = null; this.interval = null; }
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    playDialTone() {
        this.init(); this.stop();
        this.interval = setInterval(() => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(440, this.ctx.currentTime); gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + 1.2);
        }, 3000);
    }
    playRingtone() {
        this.init(); this.stop();
        this.interval = setInterval(() => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(880, this.ctx.currentTime); gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + 0.4);
        }, 1500);
    }
    stop() { if (this.interval) { clearInterval(this.interval); this.interval = null; } }
}

class UIManager {
    constructor() {
        this.screens = {
            login: document.getElementById('loginScreen'),
            dial: document.getElementById('dialScreen'),
            chat: document.getElementById('chatScreen'),
            incoming: document.getElementById('incomingCallModal'),
            video: document.getElementById('videoScreen')
        };
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.callerNameDisplay = document.getElementById('callerNameDisplay');
        this.callTypeDisplay = document.getElementById('callTypeDisplay');
        this.myUsernameDisplay = document.getElementById('myUsernameDisplay');

        this.onlineUsersList = document.getElementById('onlineUsersList');
        this.recentChatsList = document.getElementById('recentChatsList');
        this.historyList = document.getElementById('historyList');
        this.onlineCountBadge = document.getElementById('onlineCountBadge');
        this.callTimerBadge = document.getElementById('callTimerBadge');

        this.chatMessageArea = document.getElementById('chatMessageArea');
        this.chatHeaderTitle = document.getElementById('chatHeaderTitle');
        this.chatHeaderStatus = document.getElementById('chatHeaderStatus');

        this.localCamOffOverlay = document.getElementById('localCameraOffOverlay');
        this.remoteCamOffOverlay = document.getElementById('remoteCameraOffOverlay');
        this.remoteCamOffText = document.getElementById('remoteCamOffText');

        this.isSwapped = false;
        this.pipWrapper = document.getElementById('pipVideoWrapper');
        this.mainWrapper = document.getElementById('mainVideoWrapper');

        this.timerInterval = null;
        this.secondsElapsed = 0;
    }

    switchState(state) {
        Object.values(this.screens).forEach(screen => {
            if (screen) { screen.classList.add('d-none'); screen.classList.remove('d-flex'); }
        });

        switch (state) {
            case STATES.LOGGED_OUT: this.screens.login.classList.remove('d-none'); break;
            case STATES.IDLE: this.screens.dial.classList.remove('d-none'); this.screens.dial.classList.add('d-flex'); break;
            case STATES.IN_CALL: this.screens.video.classList.remove('d-none'); break;
        }
    }

    openChatScreen(targetUsername) {
        this.chatHeaderTitle.innerText = targetUsername;
        this.screens.chat.classList.remove('d-none');
    }

    closeChatScreen() {
        this.screens.chat.classList.add('d-none');
    }

    swapVideos() {
        this.isSwapped = !this.isSwapped;
        if (this.isSwapped) {
            this.mainWrapper.appendChild(this.localVideo);
            this.mainWrapper.appendChild(this.localCamOffOverlay);
            this.pipWrapper.appendChild(this.remoteVideo);
            this.pipWrapper.appendChild(this.remoteCamOffOverlay);
            this.localVideo.className = "main-video";
            this.remoteVideo.className = "pip-video";
        } else {
            this.mainWrapper.appendChild(this.remoteVideo);
            this.mainWrapper.appendChild(this.remoteCamOffOverlay);
            this.pipWrapper.appendChild(this.localVideo);
            this.pipWrapper.appendChild(this.localCamOffOverlay);
            this.remoteVideo.className = "main-video";
            this.localVideo.className = "pip-video";
        }
    }

    startCallTimer() {
        this.stopCallTimer();
        this.secondsElapsed = 0;
        this.callTimerBadge.innerText = "00:00";
        this.timerInterval = setInterval(() => {
            this.secondsElapsed++;
            const mins = Math.floor(this.secondsElapsed / 60).toString().padStart(2, '0');
            const secs = (this.secondsElapsed % 60).toString().padStart(2, '0');
            this.callTimerBadge.innerText = `${mins}:${secs}`;
        }, 1000);
    }

    stopCallTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    renderRecentChats(chats, onOpenChat) {
        if (!this.recentChatsList) return;
        this.recentChatsList.innerHTML = '';

        if (!chats || chats.length === 0) {
            this.recentChatsList.innerHTML = '<div class="text-muted small text-center py-4">Henüz bir sohbet yok.</div>';
            return;
        }

        chats.forEach(chat => {
            const timeAgo = formatTimeAgo(chat.lastMsg.timestamp);
            const badgeHtml = chat.unreadCount > 0
                ? `<span class="badge-unread">${chat.unreadCount}</span>`
                : '';

            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.innerHTML = `
                <div class="user-avatar">
                    <i class="fa-solid fa-user"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="fw-bold text-white">${chat.username}</div>
                        <div style="font-size: 0.7rem;" class="text-muted">${timeAgo}</div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                        <div class="text-muted small text-truncate" style="max-width: 200px;">${chat.lastMsg.text}</div>
                        ${badgeHtml}
                    </div>
                </div>
            `;
            item.addEventListener('click', () => onOpenChat(chat.username));
            this.recentChatsList.appendChild(item);
        });
    }

    renderOnlineUsers(users, currentUsername, onOpenChat) {
        if (!this.onlineUsersList) return;
        this.onlineUsersList.innerHTML = '';
        const otherUsers = users.filter(u => u.username !== currentUsername);

        if (this.onlineCountBadge) this.onlineCountBadge.innerText = otherUsers.length;

        if (otherUsers.length === 0) {
            this.onlineUsersList.innerHTML = '<div class="text-muted small text-center py-4">Çevrimiçi başkası yok.</div>';
            return;
        }

        otherUsers.forEach(u => {
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.innerHTML = `
                <div class="user-avatar">
                    <i class="fa-solid fa-user"></i>
                    <div class="online-indicator"></div>
                </div>
                <div class="flex-grow-1">
                    <div class="fw-bold text-white">${u.username}</div>
                    <div class="text-success small">Çevrimiçi</div>
                </div>
            `;
            item.addEventListener('click', () => onOpenChat(u.username));
            this.onlineUsersList.appendChild(item);
        });
    }

    renderHistory(history, currentUsername) {
        if (!this.historyList) return;
        this.historyList.innerHTML = '';

        if (!history || history.length === 0) {
            this.historyList.innerHTML = '<div class="text-muted small text-center py-4">Arama geçmişi yok.</div>';
            return;
        }

        history.forEach(item => {
            const isOutgoing = item.caller === currentUsername;
            const otherPerson = isOutgoing ? item.receiver : item.caller;

            let directionIcon = isOutgoing
                ? '<i class="fa-solid fa-arrow-up-right text-info me-2"></i>'
                : '<i class="fa-solid fa-arrow-down-left text-success me-2"></i>';

            const div = document.createElement('div');
            div.className = 'chat-list-item';
            div.innerHTML = `
                <div class="user-avatar"><i class="fa-solid fa-user"></i></div>
                <div class="flex-grow-1">
                    <div class="fw-bold text-white d-flex align-items-center">${directionIcon} ${otherPerson}</div>
                    <div class="text-muted small">${item.timestamp} • ${item.duration}</div>
                </div>
            `;
            this.historyList.appendChild(div);
        });
    }

    // SOHBET MESAJLARINI TİK DURUMUYLA BİRLİKTE EKRANA BASAR
    renderChatHistory(history, currentUsername) {
        this.chatMessageArea.innerHTML = '';
        history.forEach(msg => this.appendMessage(msg, currentUsername));
        this.scrollToBottom();
    }

    appendMessage(msg, currentUsername) {
        const isOutgoing = msg.sender === currentUsername;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        let tickHtml = '';
        if (isOutgoing) {
            if (msg.status === 'SENT') tickHtml = '<i class="fa-solid fa-check ms-1"></i>';
            else if (msg.status === 'DELIVERED') tickHtml = '<i class="fa-solid fa-check-double ms-1"></i>';
            else if (msg.status === 'READ') tickHtml = '<i class="fa-solid fa-check-double ms-1 tick-blue"></i>';
        }

        const div = document.createElement('div');
        div.className = `msg-bubble ${isOutgoing ? 'msg-outgoing' : 'msg-incoming'}`;
        div.innerHTML = `
            <div>${msg.text}</div>
            <div class="msg-meta">${timeStr} ${tickHtml}</div>
        `;
        this.chatMessageArea.appendChild(div);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatMessageArea.scrollTop = this.chatMessageArea.scrollHeight;
    }

    showIncomingCall(callerName, isAudioOnly = false) {
        this.callerNameDisplay.innerText = callerName;
        this.callTypeDisplay.innerText = isAudioOnly ? "Sesli Arama Geliyor..." : "Görüntülü Arama Geliyor...";
        this.screens.incoming.classList.remove('d-none');
        this.screens.incoming.classList.add('d-flex');
    }

    hideIncomingCall() {
        this.screens.incoming.classList.add('d-none');
        this.screens.incoming.classList.remove('d-flex');
    }

    setLocalCameraState(enabled) {
        if (enabled) this.localCamOffOverlay.classList.add('d-none');
        else this.localCamOffOverlay.classList.remove('d-none');
    }

    setRemoteCameraState(enabled, username) {
        if (enabled) this.remoteCamOffOverlay.classList.add('d-none');
        else {
            this.remoteCamOffText.innerText = `${username} Kamerasını Kapattı`;
            this.remoteCamOffOverlay.classList.remove('d-none');
            this.remoteCamOffOverlay.classList.add('d-flex');
        }
    }
}

class WebRTCManager {
    constructor(signalingManager, uiManager) {
        this.sig = signalingManager; this.ui = uiManager;
        this.peerConnection = null; this.localStream = null; this.iceCandidateQueue = [];
        this.currentFacingMode = "user";
        this.config = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        };
    }

    async startLocalStream(enableVideo = true, facingMode = "user") {
        this.currentFacingMode = facingMode;
        try {
            if (!this.localStream) {
                const constraints = {
                    audio: true,
                    video: enableVideo ? { facingMode: this.currentFacingMode } : false
                };
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            this.ui.localVideo.srcObject = this.localStream;
            this.ui.setLocalCameraState(enableVideo);

            if (this.peerConnection) {
                this.localStream.getTracks().forEach(track => {
                    const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === track.kind);
                    if (sender) sender.replaceTrack(track);
                    else this.peerConnection.addTrack(track, this.localStream);
                });
            }
        } catch (error) {
            alert("Mikrofon/Kamera izni gereklidir!");
        }
    }

    async switchCamera() {
        if (!this.localStream) return;
        const currentVideoTrack = this.localStream.getVideoTracks()[0];
        if (!currentVideoTrack) return;

        try {
            this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";
            const newVideoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.currentFacingMode }
            });
            const newVideoTrack = newVideoStream.getVideoTracks()[0];

            currentVideoTrack.stop();
            this.localStream.removeTrack(currentVideoTrack);
            this.localStream.addTrack(newVideoTrack);
            this.ui.localVideo.srcObject = this.localStream;

            if (this.peerConnection) {
                const videoSender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (videoSender) await videoSender.replaceTrack(newVideoTrack);
            }
        } catch (err) { console.error(err); }
    }

    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }

    createPeerConnection(targetUser) {
        if (this.peerConnection) this.peerConnection.close();
        this.peerConnection = new RTCPeerConnection(this.config);
        this.iceCandidateQueue = [];

        this.peerConnection.ontrack = async (event) => {
            if (event.streams && event.streams[0]) {
                this.ui.remoteVideo.srcObject = event.streams[0];
                try { await this.ui.remoteVideo.play(); } catch (err) { }
            }
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sig.send("ICE_CANDIDATE", { target: targetUser, candidate: event.candidate });
            }
        };

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
    }

    async makeOffer(targetUser) {
        this.createPeerConnection(targetUser);
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.sig.send("OFFER", { target: targetUser, offer: offer });
        } catch (error) { console.error(error); }
    }

    async handleOffer(offer, targetUser) {
        this.createPeerConnection(targetUser);
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            await this.processIceQueue();
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.sig.send("ANSWER", { target: targetUser, answer: answer });
        } catch (error) { console.error(error); }
    }

    async handleAnswer(answer) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                await this.processIceQueue();
            }
        } catch (error) { console.error(error); }
    }

    handleCandidate(candidate) {
        if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
        } else {
            this.iceCandidateQueue.push(candidate);
        }
    }

    async processIceQueue() {
        while (this.iceCandidateQueue.length > 0) {
            const candidate = this.iceCandidateQueue.shift();
            try { await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { }
        }
    }

    toggleAudio() {
        if (this.localStream) {
            const track = this.localStream.getAudioTracks()[0];
            if (track) { track.enabled = !track.enabled; return track.enabled; }
        }
        return false;
    }

    async toggleVideo() {
        if (!this.localStream) return false;
        let videoTrack = this.localStream.getVideoTracks()[0];

        if (!videoTrack) {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: this.currentFacingMode }
                });
                videoTrack = videoStream.getVideoTracks()[0];
                this.localStream.addTrack(videoTrack);
                this.ui.localVideo.srcObject = this.localStream;
                this.ui.setLocalCameraState(true);

                if (this.peerConnection) {
                    this.peerConnection.addTrack(videoTrack, this.localStream);
                    const offer = await this.peerConnection.createOffer();
                    await this.peerConnection.setLocalDescription(offer);
                    this.sig.send("OFFER", { target: this.sig.connectedUser, offer: offer });
                }
                return true;
            } catch (err) { return false; }
        }

        videoTrack.enabled = !videoTrack.enabled;
        this.ui.setLocalCameraState(videoTrack.enabled);
        return videoTrack.enabled;
    }

    closeConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.ui.remoteVideo.srcObject = null;
    }
}

const App = {
    username: null,
    connectedUser: null,
    activeChatTarget: null,
    ws: null,
    ui: new UIManager(),
    rtc: null,
    sounds: new SoundEffects(),
    isAudioOnlyCall: false,

    init: function () {
        const isCordova = !!window.cordova;
        if (isCordova) {
            document.addEventListener('deviceready', this.startApp.bind(this), false);
        } else {
            document.addEventListener('DOMContentLoaded', this.startApp.bind(this), false);
        }
    },

    startApp: function () {
        this.rtc = new WebRTCManager(this, this.ui);
        this.connectWebSocket();
        this.bindEvents();
    },

    connectWebSocket: function () {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const wsUrl = window.location.href.includes('ngrok')
            ? `${protocol}//${host}`
            : `${protocol}//${host}:8000`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = async (msg) => {
            const data = JSON.parse(msg.data);
            switch (data.type) {
                case "LOGIN_RESULT":
                    if (data.success) {
                        this.username = data.username;
                        this.ui.myUsernameDisplay.innerText = this.username;
                        this.ui.switchState(STATES.IDLE);
                        this.refreshRecentChats();
                    } else { alert(data.message); }
                    break;

                case "USER_LIST":
                    this.ui.renderOnlineUsers(data.payload.users, this.username, (target) => this.openChat(target));
                    break;

                case "RECENT_CHATS_RESPONSE":
                    this.ui.renderRecentChats(data.payload, (target) => this.openChat(target));
                    break;

                case "CALL_HISTORY":
                    this.ui.renderHistory(data.payload.history, this.username);
                    break;

                case "INCOMING_CALL":
                    this.connectedUser = data.payload.caller;
                    this.isAudioOnlyCall = data.payload.isAudioOnly;
                    this.sounds.playRingtone();
                    this.ui.showIncomingCall(this.connectedUser, this.isAudioOnlyCall);
                    break;

                case "CALL_ACCEPTED":
                    this.sounds.stop();
                    await this.rtc.startLocalStream(!this.isAudioOnlyCall);
                    this.ui.switchState(STATES.IN_CALL);
                    this.ui.startCallTimer();
                    this.rtc.makeOffer(this.connectedUser);
                    break;

                case "OFFER":
                    this.sounds.stop();
                    this.ui.startCallTimer();
                    this.connectedUser = data.payload.sender;
                    this.rtc.handleOffer(data.payload.offer, data.payload.sender);
                    break;

                case "ANSWER":
                    this.sounds.stop();
                    this.rtc.handleAnswer(data.payload.answer);
                    break;

                case "ICE_CANDIDATE":
                    this.rtc.handleCandidate(data.payload.candidate);
                    break;

                case "MEDIA_STATE_CHANGE":
                    if (data.payload.mediaType === 'video') {
                        this.ui.setRemoteCameraState(data.payload.enabled, data.payload.sender);
                    }
                    break;

                case "LEAVE":
                case "CALL_REJECT":
                    this.sounds.stop();
                    this.endCall();
                    break;

                case "ERROR":
                    this.sounds.stop();
                    alert(data.message);
                    this.connectedUser = null;
                    break;

                // MESAJLAŞMA VE TİK GÜNCELLEMELERİ
                case "RECEIVE_MESSAGE":
                    if (this.activeChatTarget && this.activeChatTarget.toLowerCase() === data.payload.sender.toLowerCase()) {
                        this.ui.appendMessage(data.payload, this.username);
                        this.send("OPEN_CHAT", { target: this.activeChatTarget });
                    }
                    this.refreshRecentChats();
                    break;

                case "MESSAGE_SENT_ACK":
                    if (this.activeChatTarget && this.activeChatTarget.toLowerCase() === data.payload.receiver.toLowerCase()) {
                        this.ui.appendMessage(data.payload, this.username);
                    }
                    this.refreshRecentChats();
                    break;

                case "CHAT_HISTORY_RESPONSE":
                    this.ui.renderChatHistory(data.payload.history, this.username);
                    this.ui.chatHeaderStatus.innerText = data.payload.isOnline
                        ? "Çevrimiçi"
                        : (data.payload.lastSeen ? `Son görülme: ${formatTimeAgo(data.payload.lastSeen)}` : "Çevrimdışı");
                    break;

                case "MESSAGES_READ_NOTIFICATION":
                    if (this.activeChatTarget) {
                        this.send("GET_CHAT_HISTORY", { target: this.activeChatTarget });
                    }
                    break;
            }
        };
    },

    send: function (type, payload = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    },

    refreshRecentChats: function () {
        this.send("GET_ALL_RECENT_CHATS");
    },

    openChat: function (targetUser) {
        this.activeChatTarget = targetUser;
        this.ui.openChatScreen(targetUser);
        this.send("OPEN_CHAT", { target: targetUser });
        this.send("GET_CHAT_HISTORY", { target: targetUser });
    },

    closeChat: function () {
        this.send("CLOSE_CHAT");
        this.activeChatTarget = null;
        this.ui.closeChatScreen();
        this.refreshRecentChats();
    },

    sendMessage: function () {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (text.length > 0 && this.activeChatTarget) {
            this.send("SEND_MESSAGE", { target: this.activeChatTarget, text: text });
            input.value = '';
        }
    },

    startCallProcess(targetUser, isAudioOnly = false) {
        if (!targetUser) return;
        this.connectedUser = targetUser;
        this.isAudioOnlyCall = isAudioOnly;
        this.sounds.playDialTone();
        this.send("CALL_REQUEST", { target: targetUser, isAudioOnly: isAudioOnly });
    },

    bindEvents: function () {
        document.getElementById('loginBtn').addEventListener('click', () => {
            const user = document.getElementById('usernameInput').value.trim();
            if (user.length > 0) this.send("LOGIN", { username: user });
        });

        // CHAT ARAYÜZ ETKİLEŞİMLERİ
        document.getElementById('sendMsgBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        document.getElementById('backFromChatBtn').addEventListener('click', () => this.closeChat());

        // CHAT ÜSTÜNDEKİ ARAMA BUTONLARI
        document.getElementById('headerCallVideoBtn').addEventListener('click', () => {
            this.startCallProcess(this.activeChatTarget, false);
        });

        document.getElementById('headerCallAudioBtn').addEventListener('click', () => {
            this.startCallProcess(this.activeChatTarget, true);
        });

        // TABS GEÇİŞLERİ
        document.getElementById('tab-chats').addEventListener('click', (e) => {
            this.setActiveTab('tab-chats', 'view-chats');
            this.refreshRecentChats();
        });
        document.getElementById('tab-calls').addEventListener('click', (e) => {
            this.setActiveTab('tab-calls', 'view-calls');
        });
        document.getElementById('tab-contacts').addEventListener('click', (e) => {
            this.setActiveTab('tab-contacts', 'view-contacts');
        });

        // WEBRTC VE DİĞER BUTONLAR
        document.getElementById('acceptBtn').addEventListener('click', async () => {
            this.sounds.stop();
            this.ui.hideIncomingCall();
            await this.rtc.startLocalStream(!this.isAudioOnlyCall);
            this.ui.switchState(STATES.IN_CALL);
            this.send("CALL_ACCEPT", { target: this.connectedUser });
        });

        document.getElementById('rejectBtn').addEventListener('click', () => {
            this.sounds.stop();
            this.ui.hideIncomingCall();
            this.send("CALL_REJECT", { target: this.connectedUser });
            this.connectedUser = null;
        });

        document.getElementById('hangUpBtn').addEventListener('click', () => {
            this.sounds.stop();
            this.send("LEAVE");
            this.endCall();
        });

        document.getElementById('pipVideoWrapper').addEventListener('click', () => this.ui.swapVideos());
        document.getElementById('switchCamBtn').addEventListener('click', () => this.rtc.switchCamera());

        document.getElementById('toggleMicBtn').addEventListener('click', (e) => {
            const isEnabled = this.rtc.toggleAudio();
            e.currentTarget.querySelector('i').className = isEnabled ? 'fa-solid fa-microphone' : 'fa-solid fa-microphone-slash';
            this.send("MEDIA_STATE_CHANGE", { target: this.connectedUser, mediaType: 'audio', enabled: isEnabled });
        });

        document.getElementById('toggleCamBtn').addEventListener('click', async (e) => {
            const isEnabled = await this.rtc.toggleVideo();
            e.currentTarget.querySelector('i').className = isEnabled ? 'fa-solid fa-video' : 'fa-solid fa-video-slash';
            this.send("MEDIA_STATE_CHANGE", { target: this.connectedUser, mediaType: 'video', enabled: isEnabled });
        });

        document.getElementById('logoutBtn').addEventListener('click', () => location.reload());
    },

    setActiveTab: function (tabId, viewId) {
        document.querySelectorAll('.wa-tab-item').forEach(el => el.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');

        document.getElementById('view-chats').classList.add('d-none');
        document.getElementById('view-calls').classList.add('d-none');
        document.getElementById('view-contacts').classList.add('d-none');

        document.getElementById(viewId).classList.remove('d-none');
    },

    endCall: function () {
        this.sounds.stop();
        this.ui.stopCallTimer();
        this.rtc.closeConnection();
        this.rtc.stopLocalStream();
        this.connectedUser = null;
        this.ui.switchState(STATES.IDLE);
    }
};

App.init();