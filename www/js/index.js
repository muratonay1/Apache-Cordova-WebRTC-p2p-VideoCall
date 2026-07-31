const STATES = {
    LOGGED_OUT: 'LOGGED_OUT',
    IDLE: 'IDLE',
    IN_CALL: 'IN_CALL'
};

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
            incoming: document.getElementById('incomingCallModal'),
            video: document.getElementById('videoScreen')
        };
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.callerNameDisplay = document.getElementById('callerNameDisplay');
        this.callTypeDisplay = document.getElementById('callTypeDisplay');
        this.myUsernameDisplay = document.getElementById('myUsernameDisplay');
        this.onlineUsersList = document.getElementById('onlineUsersList');
        this.historyList = document.getElementById('historyList');
        this.onlineCountBadge = document.getElementById('onlineCountBadge');
        this.callTimerBadge = document.getElementById('callTimerBadge');

        this.localCamOffOverlay = document.getElementById('localCameraOffOverlay');
        this.remoteCamOffOverlay = document.getElementById('remoteCameraOffOverlay');
        this.remoteMicBadge = document.getElementById('remoteMicMutedBadge');
        this.remoteCamOffText = document.getElementById('remoteCamOffText');

        // Swap (Ekran Değiştirme) Mantığı
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

    // EKRANLARI YER DEĞİŞTİRME (PIP TO MAIN SWAP)
    swapVideos() {
        this.isSwapped = !this.isSwapped;

        if (this.isSwapped) {
            // Kendi görüntümüz büyükte, karşı taraf küçükte
            this.mainWrapper.appendChild(this.localVideo);
            this.mainWrapper.appendChild(this.localCamOffOverlay);

            this.pipWrapper.appendChild(this.remoteVideo);
            this.pipWrapper.appendChild(this.remoteCamOffOverlay);

            this.localVideo.className = "main-video";
            this.remoteVideo.className = "pip-video";
        } else {
            // Varsayılan: Karşı taraf büyükte, kendi görüntümüz küçükte
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

    renderOnlineUsers(users, currentUsername, onVideoCall, onAudioCall) {
        if (!this.onlineUsersList) return;
        this.onlineUsersList.innerHTML = '';
        const otherUsers = users.filter(u => u !== currentUsername);

        if (this.onlineCountBadge) this.onlineCountBadge.innerText = otherUsers.length;

        if (otherUsers.length === 0) {
            this.onlineUsersList.innerHTML = '<div class="text-white opacity-70 small text-center py-3 fw-bold">Çevrimiçi kullanıcı yok.</div>';
            return;
        }

        otherUsers.forEach(user => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span class="small fw-bold text-white"><i class="fa-solid fa-circle-user me-2 text-info"></i>${user}</span>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-neon rounded-circle call-video-btn" data-username="${user}" style="width:34px; height:34px; padding:0;" title="Görüntülü Ara">
                        <i class="fa-solid fa-video"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info rounded-circle call-audio-btn" data-username="${user}" style="width:34px; height:34px; padding:0;" title="Sesli Ara">
                        <i class="fa-solid fa-phone"></i>
                    </button>
                </div>
            `;
            this.onlineUsersList.appendChild(item);
        });

        document.querySelectorAll('.call-video-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                onVideoCall(e.currentTarget.getAttribute('data-username'));
            });
        });

        document.querySelectorAll('.call-audio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                onAudioCall(e.currentTarget.getAttribute('data-username'));
            });
        });
    }

    renderHistory(history, currentUsername) {
        if (!this.historyList) return;
        this.historyList.innerHTML = '';

        if (!history || history.length === 0) {
            this.historyList.innerHTML = '<div class="text-white opacity-70 small text-center py-3 fw-bold">Geçmiş kayıt bulunamadı.</div>';
            return;
        }

        history.forEach(item => {
            const isOutgoing = item.caller === currentUsername;
            const otherPerson = isOutgoing ? item.receiver : item.caller;

            let directionIcon = isOutgoing
                ? '<i class="fa-solid fa-arrow-up-right-from-square text-info me-2 fs-6"></i>'
                : '<i class="fa-solid fa-arrow-down-left-same-line text-success me-2 fs-6"></i>';

            let statusBadge = '<span class="badge bg-success text-white px-2 py-1">TAMAMLANDI</span>';
            if (item.status === 'REJECTED') statusBadge = '<span class="badge bg-danger text-white px-2 py-1">REDDEDİLDİ</span>';
            else if (item.status === 'MISSED') statusBadge = '<span class="badge bg-warning text-dark px-2 py-1">CEVAPSIZ</span>';

            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="d-flex align-items-center">
                    ${directionIcon}
                    <div>
                        <div class="fw-bold text-white fs-6">${otherPerson}</div>
                        <div class="text-muted small">${item.timestamp} • ${item.duration}</div>
                    </div>
                </div>
                <div>${statusBadge}</div>
            `;
            this.historyList.appendChild(div);
        });
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

    setRemoteMicState(enabled) {
        if (enabled) this.remoteMicBadge.classList.add('d-none');
        else this.remoteMicBadge.classList.remove('d-none');
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

    // MEDYA AKIŞINI BAŞLATMA / GÜNCELLEME
    async startLocalStream(enableVideo = true, facingMode = "user") {
        this.currentFacingMode = facingMode;
        try {
            // Eğer sesli aramaydıysa veya ilk açılışsa genel stream al
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
                // Ses ve video track'lerini PeerConnection'a eşle
                this.localStream.getTracks().forEach(track => {
                    const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === track.kind);
                    if (sender) {
                        sender.replaceTrack(track);
                    } else {
                        this.peerConnection.addTrack(track, this.localStream);
                    }
                });
            }
        } catch (error) {
            console.error("Medya erişim hatası:", error);
            alert("Mikrofon/Kamera izni gereklidir!");
        }
    }

    // KESİN ÇÖZÜM: SESİ HİÇ BOZMADAN SADECE KAMERAYI ÇEVİRME
    async switchCamera() {
        if (!this.localStream) return;

        const currentVideoTrack = this.localStream.getVideoTracks()[0];
        if (!currentVideoTrack) return; // Kamera kapalıysa çevirme yapma

        try {
            // Yönü tersine çevir
            this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";

            // SADECE yeni video akışı iste (Ses akışına ve mikrofon iznine HİÇ DOKUNMA)
            const newVideoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.currentFacingMode }
            });

            const newVideoTrack = newVideoStream.getVideoTracks()[0];

            // 1. Eski video track'ini durdur ve localStream'den çıkar
            currentVideoTrack.stop();
            this.localStream.removeTrack(currentVideoTrack);

            // 2. Yeni video track'ini localStream'e ekle
            this.localStream.addTrack(newVideoTrack);
            this.ui.localVideo.srcObject = this.localStream;

            // 3. WebRTC PeerConnection üzerindeki video göndericisini (sender) dikişsiz değiştir
            if (this.peerConnection) {
                const videoSender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(newVideoTrack);
                }
            }

            console.log("Kamera pürüzsüzce çevrildi, ses akışı korundu!");
        } catch (err) {
            console.error("Kamera çevirme hatası:", err);
        }
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

    // DINAMIK KAMERA AC/KAPAT (SESLİ ARAMADAYKEN BASTIĞINDA KAMERAYI DA DAHIL EDER VE RE-NEGOTIATE EDER)
    async toggleVideo() {
        if (!this.localStream) return false;

        let videoTrack = this.localStream.getVideoTracks()[0];

        // EĞER İLK BAŞTA SESLİ ARAMA YAPILDISA VE VİDEO TRACK HİÇ YOKSA:
        if (!videoTrack) {
            try {
                // 1. Kamera yayınını al
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: this.currentFacingMode }
                });
                videoTrack = videoStream.getVideoTracks()[0];
                this.localStream.addTrack(videoTrack);

                // 2. Kendi ekranında kamerayı göster
                this.ui.localVideo.srcObject = this.localStream;
                this.ui.setLocalCameraState(true);

                // 3. WebRTC PeerConnection'a yeni kanalı ekle
                if (this.peerConnection) {
                    this.peerConnection.addTrack(videoTrack, this.localStream);

                    // KARŞI TARAFA YENİ OFFER GÖNDER (RE-NEGOTIATION)
                    const offer = await this.peerConnection.createOffer();
                    await this.peerConnection.setLocalDescription(offer);
                    this.sig.send("OFFER", { target: this.sig.connectedUser, offer: offer });
                }
                return true;
            } catch (err) {
                console.error("Kamera açma hatası:", err);
                alert("Kamera izni veya desteği alınamadı!");
                return false;
            }
        }

        // EĞER VİDEO TRACK ZATEN VARSA (AÇ/KAPAT YAPILIYORSA):
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
                    } else { alert(data.message); }
                    break;

                case "USER_LIST":
                    this.ui.renderOnlineUsers(data.payload.users, this.username,
                        (targetUser) => this.startCallProcess(targetUser, false),
                        (targetUser) => this.startCallProcess(targetUser, true)
                    );
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

                // ARAMA KABUL EDİLDİĞİNDE KAMERA VE WEBRTC İLK DEFA BURADA BAŞLAR
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
                    } else if (data.payload.mediaType === 'audio') {
                        this.ui.setRemoteMicState(data.payload.enabled);
                    }
                    break;

                case "LEAVE":
                case "CALL_REJECT":
                    this.sounds.stop();
                    this.endCall();
                    break;

                // SUNUCUDAN MEŞGUL VEYA HATA MESAJI GELİRSE
                case "ERROR":
                    this.sounds.stop();
                    alert(data.message); // "Kullanıcı meşgul" uyarısı gösterilir
                    this.connectedUser = null;
                    // Kameraya hiç dokunulmaz, bulunulan ekranda kalınır!
                    break;
            }
        };
    },

    send: function (type, payload = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    },

    // ARAMA SÜRECİNİ BAŞLATMA (ARTIK KAMERAYI HEMEN AÇMIYOR!)
    startCallProcess(targetUser, isAudioOnly = false) {
        if (!targetUser) return;
        this.connectedUser = targetUser;
        this.isAudioOnlyCall = isAudioOnly;

        // Bip sesini çal ama ekranı değiştirmeyip kamerayı AÇMA!
        this.sounds.playDialTone();

        // Doğrudan sunucuya istek at, izin bekle
        this.send("CALL_REQUEST", { target: targetUser, isAudioOnly: isAudioOnly });
    },

    bindEvents: function () {
        document.getElementById('loginBtn').addEventListener('click', () => {
            const user = document.getElementById('usernameInput').value.trim();
            if (user.length > 0) this.send("LOGIN", { username: user });
        });

        // GÖRÜNTÜLÜ ARA
        document.getElementById('callVideoBtn').addEventListener('click', () => {
            const target = document.getElementById('callToUsernameInput').value.trim();
            this.startCallProcess(target, false);
        });

        // SESLİ ARA
        document.getElementById('callAudioBtn').addEventListener('click', () => {
            const target = document.getElementById('callToUsernameInput').value.trim();
            this.startCallProcess(target, true);
        });

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

        // EKRANLARI YER DEĞİŞTİRME TIKLAMA OLAYLARI (PIP & MAIN CLICK)
        document.getElementById('pipVideoWrapper').addEventListener('click', () => {
            this.ui.swapVideos();
        });

        document.getElementById('switchCamBtn').addEventListener('click', async () => {
            await this.rtc.switchCamera();
        });

        document.getElementById('toggleMicBtn').addEventListener('click', (e) => {
            const isEnabled = this.rtc.toggleAudio();
            const btn = e.currentTarget;
            btn.querySelector('i').className = isEnabled ? 'fa-solid fa-microphone fa-lg' : 'fa-solid fa-microphone-slash fa-lg';
            btn.style.background = isEnabled ? 'rgba(255, 255, 255, 0.12)' : 'var(--pink-neon)';
            this.send("MEDIA_STATE_CHANGE", { target: this.connectedUser, mediaType: 'audio', enabled: isEnabled });
        });

        // DINAMIK KAMERA BUTONU (SESLİ ARAMADAYKEN BASTIGINDA KAMERANI ACIP GONDERIR)
        // DINAMIK KAMERA BUTONU DİNLEYİCİSİ
        document.getElementById('toggleCamBtn').addEventListener('click', async (e) => {
            const isEnabled = await this.rtc.toggleVideo();
            const btn = e.currentTarget;
            btn.querySelector('i').className = isEnabled ? 'fa-solid fa-video fa-lg' : 'fa-solid fa-video-slash fa-lg';
            btn.style.background = isEnabled ? 'rgba(255, 255, 255, 0.12)' : 'var(--pink-neon)';

            // Karşı tarafa kameranın açıldığını/kapandığını duyur
            this.send("MEDIA_STATE_CHANGE", {
                target: this.connectedUser,
                mediaType: 'video',
                enabled: isEnabled
            });
        });

        document.getElementById('tab-online').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('tab-online').classList.add('active');
            document.getElementById('tab-history').classList.remove('active');
            document.getElementById('view-online').classList.remove('d-none');
            document.getElementById('view-online').classList.add('show', 'active');
            document.getElementById('view-history').classList.add('d-none');
        });

        document.getElementById('tab-history').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('tab-history').classList.add('active');
            document.getElementById('tab-online').classList.remove('active');
            document.getElementById('view-history').classList.remove('d-none');
            document.getElementById('view-history').classList.add('show', 'active');
            document.getElementById('view-online').classList.add('d-none');
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            location.reload();
        });
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