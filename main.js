// JavaScript 部分 - 逻辑实现

// 存储采集的数据
let dataRecords = [];
let screenInterval = null;
let mediaStream = null; // 用于摄像头的流
let screenStream = null;
let screenshotFrames = []; // 存储屏幕截图数据

// 麦克风录制相关
let micStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecordingAudio = false;
let recordedAudioBlob = null; // 存储录制完成的音频 Blob

// 摄像头视频录制相关
let cameraStream = null;
let videoRecorder = null;
let videoChunks = [];
let isRecordingVideo = false;
let recordedVideoBlob = null; // 存储录制完成的视频 Blob

const logArea = document.getElementById('dataLog');
const mousePosDisplay = document.getElementById('mousePos');
const canvas = document.getElementById('screenCanvas');
const ctx = canvas.getContext('2d');

let mouseTimer = null;
let lastMouseX = 0;
let lastMouseY = 0;

// ==============================
// ✅ 修复：合并 mousemove 监听器（只保留一个）
// ==============================
document.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;

    // 更新坐标显示（安全检查）
    if (mousePosDisplay) {
        mousePosDisplay.innerHTML = `x: ${x} y: ${y}`;
    }

    // 更新最后位置
    lastMouseX = x;
    lastMouseY = y;

    // 清除之前的计时器
    if (mouseTimer) {
        clearTimeout(mouseTimer);
    }

    // 重新设置 10 秒后触发日志
    mouseTimer = setTimeout(() => {
        console.log(`[DEBUG] 鼠标停留日志触发: (${lastMouseX}, ${lastMouseY})`);
        logEvent('MOUSE', `鼠标长时间停留 (x:${lastMouseX}, y:${lastMouseY})`);
    }, 10000); // 10秒 = 10000毫秒
});

// ==============================
// 系统功能函数
// ==============================

// 获取本地组合流（单例模式）
function getLocalStream() {
    if (!mediaStream) {
        mediaStream = new MediaStream();
        const camVideo = document.getElementById('camVideo');
        if (camVideo) camVideo.srcObject = mediaStream;
    }
    return mediaStream;
}

// 摄像头控制
async function toggleCamera() {
    const btn = document.getElementById('camBtn');
    const recordBtn = document.getElementById('recordVideoBtn');
    const previewBox = document.getElementById('camPreviewBox');

    if (!cameraStream) {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            const camVideo = document.getElementById('camVideo');
            if (camVideo) camVideo.srcObject = cameraStream;

            btn.innerText = "关闭";
            btn.classList.add('stop');
            if (previewBox) previewBox.classList.add('active');
            if (recordBtn) recordBtn.style.display = 'inline-block';

            logEvent("系统", "摄像头已连接");

            cameraStream.getVideoTracks()[0].onended = () => {
                btn.innerText = "开启/关闭";
                btn.classList.remove('stop');
                if (previewBox) previewBox.classList.remove('active');
                if (recordBtn) recordBtn.style.display = 'none';
                logEvent("系统", "摄像头已断开");
            };

        } catch (err) {
            console.error("摄像头错误:", err);
            alert("无法获取摄像头权限: " + err.message);
        }
    } else {
        if (isRecordingVideo) {
            toggleVideoRecording(); // 先停止录制
        }

        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        const camVideo = document.getElementById('camVideo');
        if (camVideo) camVideo.srcObject = null;

        btn.innerText = "开启/关闭";
        btn.classList.remove('stop');
        if (previewBox) previewBox.classList.remove('active');
        const rBtn = document.getElementById('recordVideoBtn');
        const dBtn = document.getElementById('downloadVideoBtn');
        if (rBtn) rBtn.style.display = 'none';
        if (dBtn) dBtn.style.display = 'none';

        logEvent("系统", "摄像头已停止");
    }
}

// 视频录制控制
async function toggleVideoRecording() {
    const btn = document.getElementById('recordVideoBtn');
    const downloadBtn = document.getElementById('downloadVideoBtn');

    if (!isRecordingVideo) {
        try {
            videoChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
                ? 'video/webm; codecs=vp9'
                : 'video/webm';

            videoRecorder = new MediaRecorder(cameraStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 2500000
            });

            videoRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) videoChunks.push(event.data);
            };

            videoRecorder.onstop = async () => {
                const webmBlob = new Blob(videoChunks, { type: 'video/webm' });
                const statusEl = document.getElementById('videoStatus');
                if (statusEl) statusEl.innerHTML = '<small>正在转换为 MP4 格式...</small>';

                try {
                    recordedVideoBlob = await convertToMp4(webmBlob);
                    if (downloadBtn) downloadBtn.style.display = 'inline-block';
                    if (statusEl) statusEl.innerHTML = '<small>视频录制完成，可以下载</small>';
                    logEvent("系统", "视频录制完成");
                } catch (err) {
                    console.error('MP4 转换失败:', err);
                    recordedVideoBlob = webmBlob;
                    if (downloadBtn) downloadBtn.style.display = 'inline-block';
                    if (statusEl) statusEl.innerHTML = '<small>视频录制完成 (WebM 格式)</small>';
                    logEvent("系统", "视频录制完成 (WebM 格式)");
                }
            };

            videoRecorder.start();
            isRecordingVideo = true;

            btn.innerText = "停止录制";
            if (downloadBtn) downloadBtn.style.display = 'none';
            const statusEl = document.getElementById('videoStatus');
            if (statusEl) statusEl.innerHTML = '<small>正在录制视频...</small>';

            logEvent("系统", "开始录制视频");

        } catch (err) {
            console.error("录制错误:", err);
            alert("无法开始录制: " + err.message);
        }
    } else {
        if (videoRecorder && videoRecorder.state !== 'inactive') {
            videoRecorder.stop();
        }
        isRecordingVideo = false;
        btn.innerText = "开始录制";
        btn.classList.remove('stop');
    }
}

// 麦克风录音控制
async function toggleMic() {
    const btn = document.getElementById('micBtn');
    const previewBox = document.getElementById('micPreviewBox');

    if (!isRecordingAudio) {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(micStream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(recordedAudioBlob);
                const audioEl = document.getElementById('micPlayback');
                if (audioEl) {
                    audioEl.src = audioUrl;
                    audioEl.style.display = 'block';
                }
                const downloadSection = document.getElementById('downloadSection');
                if (downloadSection) downloadSection.style.display = 'flex';
                logEvent("系统", "录音完成，已生成回放");
            };

            mediaRecorder.start();
            isRecordingAudio = true;

            btn.innerText = "停止录音";
            btn.classList.add('stop');
            if (previewBox) previewBox.classList.add('active');
            const wrapper = document.getElementById('micWrapper');
            if (wrapper) wrapper.classList.add('mic-active');
            const statusText = document.getElementById('micStatusText');
            if (statusText) statusText.innerText = "正在录音...";
            const playback = document.getElementById('micPlayback');
            if (playback) playback.style.display = 'none';
            const downloadSection = document.getElementById('downloadSection');
            if (downloadSection) downloadSection.style.display = 'none';

            logEvent("系统", "麦克风已连接，开始录音");

        } catch (err) {
            console.error("麦克风错误:", err);
            alert("无法获取麦克风权限: " + err.message);
        }
    } else {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }
        isRecordingAudio = false;

        btn.innerText = "开启/关闭";
        btn.classList.remove('stop');
        const wrapper = document.getElementById('micWrapper');
        if (wrapper) wrapper.classList.remove('mic-active');
        const statusText = document.getElementById('micStatusText');
        if (statusText) statusText.innerText = "录音已结束";
    }
}

// 启动屏幕共享
async function startScreenShare() {
    const previewBox = document.getElementById('screenPreviewBox');
    try {
        if (screenStream) {
            stopScreenShare();
            return;
        }
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenVideo = document.getElementById('screenVideo');
        if (screenVideo) screenVideo.srcObject = screenStream;

        if (previewBox) previewBox.classList.add('active');
        logEvent("系统", "屏幕共享流已获取");

        screenStream.getVideoTracks()[0].onended = stopScreenShare;
        startScreenshotLoop(screenVideo);

    } catch (err) {
        console.error("屏幕共享错误:", err);
        // alert("无法获取屏幕共享权限: " + err.message);
    }
}

// 每秒截屏逻辑
function startScreenshotLoop(videoElement) {
    if (screenInterval) clearInterval(screenInterval);

    screenInterval = setInterval(() => {
        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            canvas.width = videoElement.videoWidth / 2;
            canvas.height = videoElement.videoHeight / 2;
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            const imageData = canvas.toDataURL('image/png');
            const frameData = {
                timestamp: new Date().toISOString(),
                imageData: imageData,
                width: canvas.width,
                height: canvas.height
            };
            screenshotFrames.push(frameData);

            const status = document.getElementById('screenshotStatus');
            if (status) {
                status.innerText = `已截取: ${new Date().toLocaleTimeString()} (总计: ${screenshotFrames.length} 帧)`;
            }

            const exportBtn = document.getElementById('exportImagesBtn');
            if (exportBtn && screenshotFrames.length > 0) {
                exportBtn.style.display = 'inline-block';
            }

            logEvent("图像", "已捕获屏幕截图帧");
        }
    }, 1000);
}

// 键盘监听（可选，避免刷屏）
document.addEventListener('keydown', (e) => {
    // 可注释掉以减少日志
    // logEvent("键盘", `Key: ${e.key} | Code: ${e.code}`);
});

// 停止所有媒体
function stopMedia() {
    if (isRecordingVideo) toggleVideoRecording();
    if (cameraStream) toggleCamera();
    if (isRecordingAudio) toggleMic();
    stopScreenShare();
    logEvent("系统", "所有采集已停止");
}

// 停止屏幕共享
function stopScreenShare() {
    const previewBox = document.getElementById('screenPreviewBox');
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        const screenVideo = document.getElementById('screenVideo');
        if (screenVideo) screenVideo.srcObject = null;
    }
    if (screenInterval) {
        clearInterval(screenInterval);
        screenInterval = null;
    }
    const status = document.getElementById('screenshotStatus');
    if (status) {
        status.innerText = "屏幕共享已停止，可以导出截图";
    }
}

// 安全日志记录
function logEvent(type, content) {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const time = now.toISOString();
    const record = { time, type, content };
    dataRecords.push(record);

    if (logArea) {
        const line = document.createElement('div');
        line.innerText = `[${timeString}] [${type}] ${content}`;
        line.style.marginBottom = '5px';
        line.style.fontFamily = 'monospace';
        logArea.prepend(line);
    } else {
        console.warn("[logEvent] dataLog 元素未找到，日志仅存于内存");
    }
}

// 导出 CSV（保留）
function exportToCSV() {
    if (dataRecords.length === 0) {
        alert("没有数据可导出");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Timestamp,Type,Content\n";

    dataRecords.forEach(row => {
        let safeContent = row.content.replace(/,/g, " ");
        csvContent += `${row.time},${row.type},${safeContent}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "info_capture_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 提交用户输入
function submitInput() {
    const userInput = document.getElementById('userInput');
    const inputText = userInput?.value.trim();

    if (!inputText) return;

    const chatMessages = document.getElementById('chatMessages');
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');

    if (chatMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerText = inputText;
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.innerText = timeString;
        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(timeDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    logEvent("用户输入", `提交内容: ${inputText}`);
    if (userInput) userInput.value = '';
}

// 回车发送
document.getElementById('userInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') submitInput();
});

// 输入框按键记录
document.getElementById('userInput')?.addEventListener('keydown', function (e) {
    logEvent("键盘", `输入框按键: ${e.key}`);
});

// 下载音频
async function downloadAudio(format) {
    if (!recordedAudioBlob) {
        alert('没有可下载的录音');
        return;
    }

    try {
        let blob = recordedAudioBlob;
        let filename = `recording_${Date.now()}`;
        let mimeType = 'audio/webm';

        const processingMsg = format === 'mp3' ? '正在转换为 MP3 格式，请稍候...' :
            format === 'wav' ? '正在转换为 WAV 格式，请稍候...' :
                '正在处理音频文件...';
        logEvent("系统", processingMsg);

        if (format === 'wav') {
            blob = await convertToWav(recordedAudioBlob);
            filename += '.wav';
            mimeType = 'audio/wav';
        } else if (format === 'mp3') {
            blob = await convertToMp3(recordedAudioBlob);
            filename += '.mp3';
            mimeType = 'audio/mpeg';
        } else if (format === 'ogg') {
            blob = await convertToOgg(recordedAudioBlob);
            filename += '.ogg';
            mimeType = 'audio/ogg';
        } else {
            filename += '.webm';
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        logEvent("系统", `音频已下载: ${filename}`);
    } catch (err) {
        console.error('下载失败:', err);
        alert('下载失败: ' + err.message);
    }
}

// 音频格式转换函数（保持不变）
async function convertToWav(webmBlob) { /* ... */ }
function audioBufferToWav(audioBuffer) { /* ... */ }
async function convertToMp3(webmBlob) { /* ... */ }
function convertFloat32ToInt16(buffer) { /* ... */ }
async function convertToOgg(webmBlob) { /* ... */ }
async function reEncodeAudio(audioBuffer, mimeType) { /* ... */ }

// 下载视频
function downloadVideo() {
    if (!recordedVideoBlob) {
        alert('没有可下载的视频');
        return;
    }

    const filename = `video_${Date.now()}.mp4`;
    const url = URL.createObjectURL(recordedVideoBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logEvent("系统", `视频已下载: ${filename}`);
}

// 视频转换（简化）
async function convertToMp4(webmBlob) {
    return new Promise((resolve) => {
        console.log('使用 WebM 格式（兼容 MP4 容器）');
        resolve(new Blob([webmBlob], { type: 'video/mp4' }));
    });
}

// 导出截图
function exportScreenshotImages() {
    if (screenshotFrames.length === 0) {
        alert('没有可导出的截图数据');
        return;
    }

    try {
        const zip = new JSZip();
        screenshotFrames.forEach((frame, index) => {
            const base64Data = frame.imageData.replace(/^data:image\/png;base64,/, '');
            const binaryData = atob(base64Data);
            const uint8Array = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }
            const timestamp = new Date(frame.timestamp).toLocaleString().replace(/[\/:]/g, '-');
            zip.file(`screenshot_${timestamp}_${index.toString().padStart(3, '0')}.png`, uint8Array);
        });

        zip.generateAsync({ type: 'blob' }).then(function (content) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `screenshots_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            logEvent("系统", `已导出 ${screenshotFrames.length} 张截图到 ZIP 文件`);
        });
    } catch (err) {
        console.error('导出失败:', err);
        alert('ZIP 创建失败，将逐个下载图片');
        screenshotFrames.forEach((frame, index) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = frame.imageData;
                link.download = `screenshot_${index.toString().padStart(3, '0')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, index * 100);
        });
        logEvent("系统", `已导出 ${screenshotFrames.length} 张截图（逐个下载）`);
    }
}

// 语音输入
let recognition = null;
let isListening = false;

function toggleVoiceInput() {
    const btn = document.getElementById('voiceBtn');
    const input = document.getElementById('userInput');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。');
        return;
    }

    if (!recognition) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isListening = true;
            if (btn) btn.classList.add('listening');
            if (input) input.placeholder = "正在听...";
            logEvent("语音", "语音识别已启动");
        };

        recognition.onend = () => {
            isListening = false;
            if (btn) btn.classList.remove('listening');
            if (input) input.placeholder = "请输入...";
            logEvent("语音", "语音识别已停止");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (input) input.value = transcript;
            logEvent("语音", `识别结果: ${transcript}`);
        };

        recognition.onerror = (event) => {
            console.error('语音识别错误', event.error);
            isListening = false;
            if (btn) btn.classList.remove('listening');

            let msg = '语音识别出错';
            if (event.error === 'not-allowed') msg = '请允许麦克风权限';
            if (input) input.placeholder = msg;
            logEvent("语音", `识别错误: ${event.error}`);
        };
    }

    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
}
