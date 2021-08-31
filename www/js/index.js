var app = {
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
        document.querySelector('#title').innerHTML = "Welcome the Chat"
    },
    onDeviceReady: function() {
        //bizim kullanici adimiz
        var name;
        var connectedUser;
        var conn = new WebSocket(process.env.WEB_SOCKET_URL);
        conn.onopen = function() {
            console.log("Connected to signaling server");
        };
        //signaling server baglantisindaki mesaj
        conn.onmessage = function(msg) {
            console.log("Got message", msg.data);
            try {
                var data = JSON.parse(msg.data);
            } catch (e) {
                console.log("Invalid JSOM");
                data = {};
            }
            switch (data.type) {
                case "login":
                    handleLogin(data.success);
                    break;
                case "offer":
                    handleOffer(data.offer, data.name);
                    break;
                case "answer":
                    handleAnswer(data.answer);
                    break;
                case "candidate":
                    handleCandidate(data.candidate);
                    break;
                case "leave":
                    handleLeave();
                    break;
                default:
                    break;
            }
        };
        conn.onerror = function(err) {
            console.log("Got error", err);
        };
        //signaling server a baglanti mesajlari gönderme 
        function send(message) {
            //baglandigimiz kullanicinin bilgilerini signaling server a gönderiyoruz. 
            if (connectedUser) {
                message.name = connectedUser;
            }
            conn.send(JSON.stringify(message));
        };
        //****** 
        //UI  blokları
        //******
        var loginPage = document.querySelector('#loginPage');
        var usernameInput = document.querySelector('#usernameInput');
        var loginBtn = document.querySelector('#loginBtn');
        var callPage = document.querySelector('#callPage');
        var InComingModal = document.querySelector('#InComingModal');
        var callToUsernameInput = document.querySelector('#callToUsernameInput');
        var callBtn = document.querySelector('#callBtn');
        var hangUpBtn = document.querySelector('#hangUpBtn');
        var StopCamera = document.querySelector('#StopCamera');
        var StartCamera = document.querySelector('#StartCamera');
        var localVideo = document.querySelector('#localVideo');
        var titleText = document.querySelector('#title');
        var BackToLoginPage = document.querySelector('#BackToLoginPage');
        var remoteVideo = document.querySelector('#remoteVideo');
        var yourConn;
        var width = window.screen.width * window.devicePixelRatio;
        var height = window.screen.height * window.devicePixelRatio;
        var stream;
        var ringtone;
        var configuration = {
            "iceServers": [{ "url": "stun:stun2.1.google.com:19302" }]
        };
        var kabulBtn = document.querySelector('#kabulBtn');
        var redBtn = document.querySelector('#redBtn');
        document.getElementById('CameraControlText').innerHTML = "Stop Camera";
        callPage.style.display = "none";
        InComingModal.style.display = "none";
        //login buton click eventi
        loginBtn.addEventListener("click", function(event) {
            name = usernameInput.value;
            //kullanici adi bos degilse
            if (name.length > 0) {
                send({
                    type: "login",
                    name: name
                });
                //browser a bizim kullanici adimizi title olarak ekleme 
                document.querySelector('#title').innerHTML = "" + name;
            }
        });
        // signalingState hatasi için PeerConnection baglantisini yeniden olusturma
        /**
         * Hangup ile leave edildiginde kullanicinin baglantisi halen iceConnectionState=="close" state'inde kalmaktadir.
         */
        function OpenRTCPeerConnection(configuration) {
            yourConn = new RTCPeerConnection(configuration);
            /**
             * signaingState=="closed" döndügünden biz video ve audio streamlerini yeniden baslatmak zorundayiz. Bu sebeple
             * video ve audio streamlerini yeniden tanimliyor ve baglantimiza aktariyoruz.
             */
            yourConn.addStream(stream);
            yourConn.onaddstream = function(e) {
                remoteVideo.srcObject = e.stream;
            };
            //icecandidate olusturuyoruz.
            yourConn.onicecandidate = function(event) {
                if (event.candidate) {
                    send({
                        type: "candidate",
                        candidate: event.candidate
                    });
                }
            };
        }
        BackToLoginPage.addEventListener('click', function() {
                send({
                    type: "GoToBack",
                    name: name
                });
                handleLeave();
                loginPage.style.display = "block";
                callPage.style.display = "none";
            })
            //Burada kendi kameramizi açiyoruz.
        async function OpenCamera(configuration) {
            OpenRTCPeerConnection();
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            console.log('Received local stream');
            localVideo.srcObject = stream;
            localVideo.setAttribute("style", "width:100px; height:100px; top:'" + 400 + "'px");
            remoteVideo.setAttribute("style", "width:350px; height:400px;");
            //Peer baglanti için nesneyi oluturuyoruz.
            //yourConn = new RTCPeerConnection(configuration);
            yourConn.addStream(stream);
            yourConn.onaddstream = function(e) {
                remoteVideo.srcObject = e.stream;
            };
            yourConn.onicecandidate = function(event) {
                if (event.candidate) {
                    send({
                        type: "candidate",
                        candidate: event.candidate
                    });
                }
            };
        }
        async function handleLogin(success) {
            if (success === false) {
                alert("Ooops...try a different username");
            } else {
                //incoming call modal visible kontrolü
                loginPage.style.display = "none";
                callPage.style.display = "block";
                //client kamera ve mikrofon kullanma
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                console.log('Received local stream');
                localVideo.srcObject = stream;
                localVideo.muted = true;
                localVideo.setAttribute("style", "width:100px; height:100px; top:'" + 400 + "'px");
                remoteVideo.setAttribute("style", "width:350px; height:400px;");
                //Peer baglanti için nesneyi oluturuyoruz.
                yourConn = new RTCPeerConnection(configuration);
                yourConn.addStream(stream);
                yourConn.onaddstream = function(e) {
                    remoteVideo.srcObject = e.stream;
                };
                //icecandidate olusturuyoruz.
                yourConn.onicecandidate = function(event) {
                    if (event.candidate) {
                        send({
                            type: "candidate",
                            candidate: event.candidate
                        });
                        console.log(event.candidate);
                    }
                };
            }
        };
        //call butonu click eventi
        callBtn.addEventListener("click", function() {
            var callToUsername = callToUsernameInput.value;
            if (callToUsername.length > 0) {

                connectedUser = callToUsername;
                if (yourConn.iceConnectionState == "closed") {
                    //PeerConnection nesnesi olusturuyoruz fakat signalingState ve iceConnectionState halen "closed" olarak kalmaktadir.
                    OpenRTCPeerConnection(configuration);
                    //alert("callBtn içindeki yourconn.iceconnectionstate=close içindesin");
                }
                //OpenRTCPeerConnection();
                // offer olusturuyoruz
                yourConn.createOffer(function(offer) {
                    send({
                        type: "offer",
                        offer: offer,
                        name: callToUsername,
                        calleName: name
                    });
                    //bizim olusturdugumuz offer
                    yourConn.setLocalDescription(offer);
                }, function(error) {
                    //alert(" callBtn içindeki Error when creating an offer\n(setLocalDescription) hatasi");
                });
            }
        });
        //Stop Camera
        StopCamera.addEventListener('click', function() {
                stream.getTracks().forEach(function(track) {
                    track.stop();
                });
            })
            //Play Camera 
        StartCamera.addEventListener('click', function() {
                OpenCamera(configuration); //Bu sadece bizim görüntümüzü bizde aiyor. Karsi tarafta açmiyor.
            })
            //when somebody sends us an offer 
        function handleOffer(offer, name) {
            try {
                connectedUser = name;
                //modal içindeki span'a arayan kisinin isminin yazilmasi
                document.getElementById('callerName').innerHTML = name + " kisisi seni ariyor.";
                //arama sayfasi kapatilir ve incomingcall sayfasi öne çikarilir.
                callPage.style.display = "none";
                InComingModal.style.display = "block";
                //Arama sirasinda beep sesi
                /*var stop = false;
                var inter = setInterval(function(){
                   if(!stop){
                      navigator.notification.beep(1);}
                   else clearInterval(inter);
                },1500);*/
                //beep sesi durdurma fonksiyonu
                function stopBeepNoise() { stop = true; }

                //eger icoming call sayfasinda kabul butonuna tiklanirsa cevap gönderilir.
                kabulBtn.addEventListener("click", function() {
                    //eger kabule basilirsa sayfa açilip kapanmalari yer degistir.
                    //cordova navigator.notification.beep(0);
                    callPage.style.display = "block";
                    InComingModal.style.display = "none";
                    /*stopBeepNoise();*/

                    if (yourConn.signalingState == "closed" || yourConn.iceConnectionState == "close") {
                        OpenRTCPeerConnection(configuration);
                        //alert("handleOffer fonksiyonu(kblEtBtn içindeki) 'closed' kontrolü içi");
                    }
                    //cevap buradan gönderiliyor.
                    yourConn.setRemoteDescription(new RTCSessionDescription(offer));
                    //create an answer to an offer 
                    yourConn.createAnswer(function(answer) {
                        yourConn.setLocalDescription(answer);
                        //UserAnswerFonk(answer);
                        send({
                            type: "answer",
                            answer: answer
                        });
                    }, function(error) {
                        console.log("handleoffer içindeki kabulEtBtn hatasi meydana geldi.");
                    });
                })
            } catch (error) {
                console.log("handleoffer hatasi meydana geldi");
            }
            //REDDET BUTONU
            redBtn.addEventListener("click", function() {
                try {
                    callPage.style.display = "block";
                    InComingModal.style.display = "none";
                    ringtone.stop();
                    if (yourConn.signalingState == "closed" || yourConn.iceConnectionState == "close") {
                        OpenRTCPeerConnection(configuration);
                        //alert("handleOffer fonksiyonu(kblEtBtn içindeki) 'closed' kontrolü içi");
                    }
                    //REDDET BUTONUNA BASINCA BAGLANTIYI REDDETMESI IÇIN SERVERE TALEP GÖNDERMESI 
                    yourConn.setRemoteDescription(new RTCSessionDescription(offer));
                    //offer istegine bir answer veriyoruz.
                    yourConn.createAnswer(function(answer) {
                        return yourConn.setLocalDescription(answer)
                            //UserAnswerFonk(answer);
                            .then(function() {
                                send({
                                    type: "decline",
                                    answer: answer
                                });
                                handleLeave();
                            })

                    }, function(error) {
                        alert("Error when creating an answer");
                    });
                } catch (error) {
                    alert(error);
                }
            })
        };
        //bir kullanicidan yanit aldigimizda bu fonksiyona düsüyor.
        function handleAnswer(answer) {
            if (yourConn.iceConnectionState == "closed") {
                OpenRTCPeerConnection(configuration);
            }
            yourConn.setRemoteDescription(new RTCSessionDescription(answer));
        };
        //bir kullanicidan iceCandidate aldigimizda bu fonksiyona düsüyor.
        function handleCandidate(candidate) {
            if (yourConn.iceConnectionState == "closed") {
                OpenRTCPeerConnection(configuration);
            }
            yourConn.addIceCandidate(new RTCIceCandidate(candidate));
        };
        //hangup butonu
        hangUpBtn.addEventListener("click", function() {
            //hiçbir konusmada degilken hangup butonuna basinca disconnect olmamasi için
            if (connectedUser == null) {
                alert("Zaten bir konusmada degilsiniz.");
                navigator.notification.alert("Zaten bir konusmada degilsin.", ["baslik"], [OK]);
            } else if (connectedUser != null) {

                send({
                    type: "leave"
                });
                handleLeave();
            }
        });

        function handleLeave() {
            //bzim baglantidigimiz kullanici
            connectedUser = null;
            //karsidan gelen görüntünün kamerasi kapaniyor.
            remoteVideo.src = null;
            //baglantimiz kapaniyor.
            yourConn.close();
            //baglantimizda olusturdugumuz icecandidate nesnesi bosaltiliyor.
            yourConn.onicecandidate = null;
            //baglantimiza sagladigimiz onaddstream(bizim ve karsi tarafin kamerasi ) bosaltiliyor.
            yourConn.onaddstream = null;
        };
    }
};
app.initialize();