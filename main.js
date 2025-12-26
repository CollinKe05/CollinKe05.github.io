// 1. 修正剧本配置：匹配你的实际文件夹和文件名 [cite: 1, 2]
const scriptData = [
    {
        userText: "（无意识地乱晃鼠标）",
        aiText: "那个……虽然不想打扰你发呆，但是光标君已经在我的眼前转了五十圈啦。它是迷路了吗？",
        videoUrl: "工导视频/工导 1.mp4", 
        emotions: { happy: 10, sad: 20, angry: 0, doubt: 60, neutral: 10 }
    },
    {
        userText: "哎？……抱歉，你能注意到这个？",
        aiText: "我不光注意到了光标，还看到了你呀。你的眉头皱得好紧，黑眼圈也这么重……看起来像是刚刚打完一场必输的仗。发生什么事了吗？",
        userText: "必输的仗吗……形容得真贴切。",
        videoUrl: "工导视频/工导 2.mp4",
        emotions: { happy: 0, sad: 70, angry: 0, doubt: 10, neutral: 20 }
    },
    {
        userText: "挂科了。明明这一个月我都在背书……也许我真的没天赋吧，所有的努力都像个笑话。",
        aiText:"反对。努力才不是笑话。",
        videoUrl: "工导视频/工导 3.mp4",
        emotions: { happy: 10, sad: 40, angry: 10, doubt: 0, neutral: 40 }
    },
    {
        userText: "……什么？",
        aiText: "如果真的像你说的那样‘没天赋’或者‘不在乎’，那你现在应该觉得轻松才对呀。可是我看得到，你现在的表情充满了‘不甘心’。",
        videoUrl: "工导视频/工导 4.mp4",
        emotions: { happy: 60, sad: 0, angry: 0, doubt: 0, neutral: 40 }
    },
    {
        userText: "不甘心……是因为努力过吗？",
        userText: "你说得对。既然存进去了，就不能让它白费。",
        aiText: "去吧，我就在这里，等着听你的好消息。",
        videoUrl: "工导视频/工导 5.mp4",
        emotions: { happy: 60, sad: 0, angry: 0, doubt: 0, neutral: 40 }
    }
];

let currentStep = 0; // 剧本进度指针
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

// ===== 补充缺失的鼠标相关变量 =====
let lastMouseX = 0;
let lastMouseY = 0;
let mouseTimer = null;

// 页面可见性和焦点状态（修正初始值）
let isPageVisible = !document.hidden;   // ✅ 关键修复
let isPageFocused = true; // focus 事件会更新，初始可设为 true


// 获取本地组合流（单例模式）
function getLocalStream() {
    if (!mediaStream) {
        mediaStream = new MediaStream();
        document.getElementById('camVideo').srcObject = mediaStream;
    }
    return mediaStream;
}

// 1.1 摄像头控制
async function toggleCamera() {
    const btn = document.getElementById('camBtn');
    const recordBtn = document.getElementById('recordVideoBtn');
    const previewBox = document.getElementById('camPreviewBox');

    if (!cameraStream) {
        // 开启摄像头
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            document.getElementById('camVideo').srcObject = cameraStream;

            // 更新 UI
            btn.innerText = "关闭";
            btn.classList.add('stop');
            previewBox.classList.add('active');
            recordBtn.style.display = 'inline-block';

            logEvent("系统", "摄像头已连接");

            // 监听轨道停止
            cameraStream.getVideoTracks()[0].onended = () => {
                btn.innerText = "开启/关闭";
                btn.classList.remove('stop');
                previewBox.classList.remove('active');
                recordBtn.style.display = 'none';
                logEvent("系统", "摄像头已断开");
            };

        } catch (err) {
            console.error("Error:", err);
            alert("无法获取摄像头权限: " + err.message);
        }
    } else {
        // 停止摄像头
        if (isRecordingVideo) {
            toggleVideoRecording(); // 先停止录制
        }

        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        document.getElementById('camVideo').srcObject = null;

        btn.innerText = "开启/关闭";
        btn.classList.remove('stop');
        previewBox.classList.remove('active');
        document.getElementById('recordVideoBtn').style.display = 'none';
        document.getElementById('downloadVideoBtn').style.display = 'none';

        logEvent("系统", "摄像头已停止");
    }
}

// 1.1.1 视频录制控制
async function toggleVideoRecording() {
    const btn = document.getElementById('recordVideoBtn');
    const downloadBtn = document.getElementById('downloadVideoBtn');

    if (!isRecordingVideo) {
        // 开始录制
        try {
            videoChunks = [];

            // 使用支持的 MIME 类型
            const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
                ? 'video/webm; codecs=vp9'
                : 'video/webm';

            videoRecorder = new MediaRecorder(cameraStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            });

            videoRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    videoChunks.push(event.data);
                }
            };

            videoRecorder.onstop = async () => {
                // 生成 WebM 视频
                const webmBlob = new Blob(videoChunks, { type: 'video/webm' });

                // 转换为 MP4
                document.getElementById('videoStatus').innerHTML = '<small>正在转换为 MP4 格式...</small>';
                try {
                    recordedVideoBlob = await convertToMp4(webmBlob);
                    downloadBtn.style.display = 'inline-block';
                    document.getElementById('videoStatus').innerHTML = '<small>视频录制完成，可以下载</small>';
                    logEvent("系统", "视频录制完成");
                } catch (err) {
                    console.error('MP4 转换失败:', err);
                    // 降级：直接使用 WebM
                    recordedVideoBlob = webmBlob;
                    downloadBtn.style.display = 'inline-block';
                    document.getElementById('videoStatus').innerHTML = '<small>视频录制完成 (WebM 格式)</small>';
                    logEvent("系统", "视频录制完成 (WebM 格式)");
                }
            };

            videoRecorder.start();
            isRecordingVideo = true;

            // 更新 UI
            btn.innerText = "停止录制";
            // btn.classList.add('stop');
            downloadBtn.style.display = 'none';
            document.getElementById('videoStatus').innerHTML = '<small>正在录制视频...</small>';

            logEvent("系统", "开始录制视频");

        } catch (err) {
            console.error("Error:", err);
            alert("无法开始录制: " + err.message);
        }
    } else {
        // 停止录制
        if (videoRecorder && videoRecorder.state !== 'inactive') {
            videoRecorder.stop();
        }

        isRecordingVideo = false;

        // 更新 UI
        btn.innerText = "开始录制";
        btn.classList.remove('stop');
    }
}

// 1.2 麦克风录音控制
async function toggleMic() {
    const btn = document.getElementById('micBtn');
    const previewBox = document.getElementById('micPreviewBox');

    if (!isRecordingAudio) {
        // 开始录音
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 准备录制
            audioChunks = [];
            mediaRecorder = new MediaRecorder(micStream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                // 生成音频 Blob
                recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(recordedAudioBlob);

                // 设置给 audio 元素并显示
                const audioEl = document.getElementById('micPlayback');
                audioEl.src = audioUrl;
                audioEl.style.display = 'block';

                // 显示下载按钮
                document.getElementById('downloadSection').style.display = 'flex';

                logEvent("系统", "录音完成，已生成回放");
            };

            // 开始录制
            mediaRecorder.start();
            isRecordingAudio = true;

            // 更新 UI
            btn.innerText = "停止录音";
            btn.classList.add('stop');
            previewBox.classList.add('active');
            document.getElementById('micWrapper').classList.add('mic-active');
            document.getElementById('micStatusText').innerText = "正在录音...";
            document.getElementById('micPlayback').style.display = 'none';
            document.getElementById('downloadSection').style.display = 'none';

            logEvent("系统", "麦克风已连接，开始录音");

        } catch (err) {
            console.error("Error:", err);
            alert("无法获取麦克风权限: " + err.message);
        }
    } else {
        // 停止录音
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }

        isRecordingAudio = false;

        // 更新 UI
        btn.innerText = "开启/关闭";
        btn.classList.remove('stop');
        // previewBox.classList.remove('active'); // Keep active to show playback
        document.getElementById('micWrapper').classList.remove('mic-active');
        document.getElementById('micStatusText').innerText = "录音已结束";
    }
}

// 1.1 启动屏幕共享
async function startScreenShare() {
    const previewBox = document.getElementById('screenPreviewBox');
    try {
        // 获取屏幕共享 (用于截屏)
        if (screenStream) {
            stopScreenShare(); // Toggle logic
            return;
        }
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenVideo = document.getElementById('screenVideo');
        screenVideo.srcObject = screenStream;

        previewBox.classList.add('active');
        logEvent("系统", "屏幕共享流已获取");

        // 监听流停止事件
        screenStream.getVideoTracks()[0].onended = function () {
            stopScreenShare();
        };

        // 启动每秒截屏
        startScreenshotLoop(screenVideo);

    } catch (err) {
        console.error("Error:", err);
        // alert("无法获取屏幕共享权限: " + err.message);
    }
}

// 2. 每秒截屏逻辑
function startScreenshotLoop(videoElement) {
    if (screenInterval) clearInterval(screenInterval);

    screenInterval = setInterval(() => {
        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            // 设置画布尺寸
            canvas.width = videoElement.videoWidth / 2;
            canvas.height = videoElement.videoHeight / 2;

            // 画图
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // 获取 Base64 图片数据
            const imageData = canvas.toDataURL('image/png');

            // 保存截图数据
            const frameData = {
                timestamp: new Date().toISOString(),
                imageData: imageData,
                width: canvas.width,
                height: canvas.height
            };
            screenshotFrames.push(frameData);

            document.getElementById('screenshotStatus').innerText = `已截取: ${new Date().toLocaleTimeString()} (总计: ${screenshotFrames.length} 帧)`;

            // 显示导出按钮
            if (screenshotFrames.length > 0) {
                document.getElementById('exportImagesBtn').style.display = 'inline-block';
            }

            // 记录截屏事件
            logEvent("图像", "已捕获屏幕截图帧");
        }
    }, 1000);
}

// 3. 鼠标移动监听
document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (mousePosDisplay) {
        mousePosDisplay.textContent = `x: ${lastMouseX} y: ${lastMouseY}`;
    }

    // 👇 只有页面可见且聚焦时，才启动“长时间停留”检测
    if (isPageVisible && isPageFocused) {
        if (mouseTimer) clearTimeout(mouseTimer);
        mouseTimer = setTimeout(() => {
            logEvent('MOUSE', `鼠标长时间停留 (x:${lastMouseX}, y:${lastMouseY})`);
        }, 10000);
    } else {
        // 页面不可见或失焦时，确保不计时
        if (mouseTimer) clearTimeout(mouseTimer);
    }
});
// 页面可见性 & 焦点状态跟踪（防止后台误判）
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    if (mouseTimer) clearTimeout(mouseTimer);
});
window.addEventListener('blur', () => {
    isPageFocused = false;
    if (mouseTimer) clearTimeout(mouseTimer);
});
window.addEventListener('focus', () => {
    isPageFocused = true;
});
// 4. 键盘输入监听
document.addEventListener('keydown', (e) => {
    const keyInfo = `Key: ${e.key} | Code: ${e.code}`;
    // logEvent("键盘", keyInfo); // 减少日志刷屏，可选择开启
});

// 5. 停止采集
function stopMedia() {
    if (isRecordingVideo) toggleVideoRecording();
    if (cameraStream) toggleCamera();
    if (isRecordingAudio) toggleMic();
    stopScreenShare();
    logEvent("系统", "所有采集已停止");
}

function stopScreenShare() {
    const previewBox = document.getElementById('screenPreviewBox');
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        document.getElementById('screenVideo').srcObject = null;
    }
    if (screenInterval) {
        clearInterval(screenInterval);
        screenInterval = null;
    }
    document.getElementById('screenshotStatus').innerText = "屏幕共享已停止，可以导出截图";
    // previewBox.classList.remove('active'); // 保持预览区域开启以便导出
}

// 辅助功能：记录数据并显示
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

    // 更新界面日志
    const line = document.createElement('div');
    line.innerText = `[${timeString}] [${type}] ${content}`;
    line.style.marginBottom = '5px';
    logArea.prepend(line);
}

// 6. 导出 CSV (保留功能但不显示按钮，可以后续添加)
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
function renderChatMessage(role, text) {
    const chatMessages = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-message`;
    msgDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${text}</div>
            <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function updateEmotionCharts(emotions) {
    const bars = document.querySelectorAll('.chart-bar');
    const htmlContent = `
        <div class="bar-seg c-happy" style="width: ${emotions.happy}%"></div>
        <div class="bar-seg c-sad" style="width: ${emotions.sad}%"></div>
        <div class="bar-seg c-angry" style="width: ${emotions.angry}%"></div>
        <div class="bar-seg c-doubt" style="width: ${emotions.doubt}%"></div>
        <div class="bar-seg c-neutral" style="width: ${emotions.neutral}%"></div>
    `;
    bars.forEach(bar => {
        bar.innerHTML = htmlContent;
    });
}

function updateIdolVideo(url) {
    const video = document.getElementById('characterVideo');
    if (video) {
        video.src = url;
        video.load();
        video.play().catch(e => console.log("等待用户交互后播放"));
    }
}

// 7. 提交输入信息
// 确保 currentStep 定义在函数外部
// let currentStep = 0; // 已经在文件开头定义了

function submitInput() {
    if (currentStep >= scriptData.length) {
        logEvent("系统", "剧本演示结束");
        return;
    }

    const step = scriptData[currentStep];
    currentStep++; 

    renderChatMessage('user', step.userText);
    document.getElementById('userInput').value = "";

    logEvent("分析", "监测到用户行为模式变化...");
    logEvent("LLM", "正在生成情感化回复...");
    setTimeout(() => {
        renderChatMessage('ai', step.aiText);
        updateIdolVideo(step.videoUrl); // 切换视频
        updateEmotionCharts(step.emotions); // 切换图表
    }, 1000);
}

// 添加回车键发送支持
document.getElementById('userInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        submitInput();
    }
});

// 监听输入框的按键记录
document.getElementById('userInput').addEventListener('keydown', function (e) {
    logEvent("键盘", `输入框按键: ${e.key}`);
});

// 8. 下载音频文件
async function downloadAudio(format) {
    if (!recordedAudioBlob) {
        alert('没有可下载的录音');
        return;
    }

    try {
        let blob = recordedAudioBlob;
        let filename = `recording_${Date.now()}`;
        let mimeType = 'audio/webm';

        // 显示处理提示
        const processingMsg = format === 'mp3' ? '正在转换为 MP3 格式，请稍候...' :
            format === 'wav' ? '正在转换为 WAV 格式，请稍候...' :
                '正在处理音频文件...';
        logEvent("系统", processingMsg);

        // 根据格式处理
        if (format === 'wav') {
            // 将 WebM 转换为 WAV
            blob = await convertToWav(recordedAudioBlob);
            filename += '.wav';
            mimeType = 'audio/wav';
        } else if (format === 'mp3') {
            // 使用 lamejs 转换为 MP3
            blob = await convertToMp3(recordedAudioBlob);
            filename += '.mp3';
            mimeType = 'audio/mpeg';
        } else if (format === 'ogg') {
            // 转换为 OGG 格式
            blob = await convertToOgg(recordedAudioBlob);
            filename += '.ogg';
            mimeType = 'audio/ogg';
        } else {
            filename += '.webm';
        }

        // 创建下载链接
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

// 将 WebM 音频转换为 WAV 格式
async function convertToWav(webmBlob) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fileReader = new FileReader();

        fileReader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // 创建 WAV 文件
                const wavBlob = audioBufferToWav(audioBuffer);
                resolve(wavBlob);
            } catch (err) {
                reject(err);
            }
        };

        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(webmBlob);
    });
}

// 将 AudioBuffer 转换为 WAV Blob
function audioBufferToWav(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // 写入 WAV 头部
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // 写入交错的音频数据
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], { type: 'audio/wav' });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

// 将 WebM 音频转换为 MP3 格式（使用 lamejs）
async function convertToMp3(webmBlob) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fileReader = new FileReader();

        fileReader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // 配置 MP3 编码器
                const sampleRate = audioBuffer.sampleRate;
                const numChannels = audioBuffer.numberOfChannels;
                const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128); // 128 kbps

                const mp3Data = [];
                const sampleBlockSize = 1152; // LAME 的标准块大小

                // 获取音频通道数据
                const leftChannel = audioBuffer.getChannelData(0);
                const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

                // 转换为 Int16 格式
                const left = convertFloat32ToInt16(leftChannel);
                const right = convertFloat32ToInt16(rightChannel);

                // 分块编码
                for (let i = 0; i < left.length; i += sampleBlockSize) {
                    const leftChunk = left.subarray(i, i + sampleBlockSize);
                    const rightChunk = right.subarray(i, i + sampleBlockSize);
                    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                }

                // 完成编码
                const mp3buf = mp3encoder.flush();
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }

                // 创建 Blob
                const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
                resolve(mp3Blob);
            } catch (err) {
                reject(err);
            }
        };

        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(webmBlob);
    });
}

// 将 Float32Array 转换为 Int16Array
function convertFloat32ToInt16(buffer) {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        let s = Math.max(-1, Math.min(1, buffer[i]));
        buf[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buf;
}

// 将 WebM 音频转换为 OGG 格式
async function convertToOgg(webmBlob) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fileReader = new FileReader();

        fileReader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // 检查浏览器是否支持 OGG 录制
                const mimeType = 'audio/ogg; codecs=opus';
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    // 使用 MediaRecorder 重新录制为 OGG 格式
                    const oggBlob = await reEncodeAudio(audioBuffer, mimeType);
                    resolve(oggBlob);
                } else {
                    // 降级方案：使用 WAV 格式
                    console.warn('浏览器不支持 OGG 编码，使用 WAV 格式代替');
                    const wavBlob = audioBufferToWav(audioBuffer);
                    resolve(new Blob([wavBlob], { type: 'audio/ogg' }));
                }
            } catch (err) {
                reject(err);
            }
        };

        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(webmBlob);
    });
}

// 重新编码音频为指定格式
async function reEncodeAudio(audioBuffer, mimeType) {
    return new Promise((resolve, reject) => {
        // 创建离线音频上下文来播放 AudioBuffer
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;

        // 创建 MediaStreamDestination 来捕获音频
        const dest = offlineContext.createMediaStreamDestination();
        source.connect(dest);
        source.start(0);

        // 使用 MediaRecorder 录制
        const chunks = [];
        const mediaRecorder = new MediaRecorder(dest.stream, { mimeType });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            resolve(blob);
        };

        mediaRecorder.onerror = reject;

        mediaRecorder.start();

        // 渲染音频并在完成后停止录制
        offlineContext.startRendering().then(() => {
            setTimeout(() => {
                mediaRecorder.stop();
            }, 100);
        }).catch(reject);
    });
}

// 9. 下载视频文件
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

// 将 WebM 视频转换为 MP4 格式
async function convertToMp4(webmBlob) {
    // 注意：真正的 WebM 到 MP4 转换需要复杂的编解码过程
    // 这里我们使用一个简化的方案：
    // 1. 如果浏览器支持 MP4 录制，直接重新录制
    // 2. 否则，返回 WebM 但标记为 MP4（大多数播放器可以处理）

    return new Promise((resolve, reject) => {
        // 检查是否支持 MP4 录制
        const mp4MimeType = 'video/mp4; codecs=avc1';
        const h264MimeType = 'video/webm; codecs=h264';

        if (MediaRecorder.isTypeSupported(mp4MimeType) || MediaRecorder.isTypeSupported(h264MimeType)) {
            // 浏览器支持 H.264，可以尝试重新编码
            // 但这需要解码和重新编码，比较复杂
            // 简化方案：直接使用 WebM，但大多数现代浏览器都支持
            console.log('使用 WebM 格式（兼容 MP4 容器）');
            resolve(new Blob([webmBlob], { type: 'video/mp4' }));
        } else {
            // 降级方案：使用 FFmpeg.wasm 进行真正的转换
            // 由于 FFmpeg.wasm 较大，这里提供一个占位符
            // 实际应用中可以引入 FFmpeg.wasm 库
            console.warn('浏览器不支持 MP4 编码，使用 WebM 格式');

            // 尝试使用 mp4-muxer 库（如果可用）
            if (typeof Mp4Muxer !== 'undefined') {
                convertWithMp4Muxer(webmBlob).then(resolve).catch(() => {
                    // 如果转换失败，返回原始 WebM
                    resolve(new Blob([webmBlob], { type: 'video/mp4' }));
                });
            } else {
                // 直接返回 WebM，标记为 MP4
                resolve(new Blob([webmBlob], { type: 'video/mp4' }));
            }
        }
    });
}

// 使用 mp4-muxer 进行转换（高级方案）
async function convertWithMp4Muxer(webmBlob) {
    // 这是一个占位符函数
    // 实际实现需要使用 mp4-muxer 库的 API
    // 由于 WebM 到 MP4 的转换比较复杂，这里简化处理
    return new Blob([webmBlob], { type: 'video/mp4' });
}

// 10. 导出屏幕截图图片
function exportScreenshotImages() {
    if (screenshotFrames.length === 0) {
        alert('没有可导出的截图数据');
        return;
    }

    try {
        // 创建 ZIP 文件包含所有图片
        const zip = new JSZip();

        // 添加每个图片到 ZIP 文件
        screenshotFrames.forEach((frame, index) => {
            // 移除 Base64 前缀
            const base64Data = frame.imageData.replace(/^data:image\/png;base64,/, '');

            // 转换为二进制数据
            const binaryData = atob(base64Data);
            const uint8Array = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }

            // 添加到 ZIP 文件，文件名包含时间戳
            const timestamp = new Date(frame.timestamp).toLocaleString().replace(/[\/:]/g, '-');
            zip.file(`screenshot_${timestamp}_${index.toString().padStart(3, '0')}.png`, uint8Array);
        });

        // 生成 ZIP 文件并下载
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

        // 如果 ZIP 创建失败，降级方案：逐个下载图片
        alert('ZIP 创建失败，将逐个下载图片');
        screenshotFrames.forEach((frame, index) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = frame.imageData;
                link.download = `screenshot_${index.toString().padStart(3, '0')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, index * 100); // 间隔下载避免浏览器阻止
        });

        logEvent("系统", `已导出 ${screenshotFrames.length} 张截图（逐个下载）`);
    }
}

// 11. 语音输入功能
let recognition = null;
let isListening = false;

function toggleVoiceInput() {
    const btn = document.getElementById('voiceBtn');
    const input = document.getElementById('userInput');

    // 检查浏览器兼容性
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。');
        return;
    }

    // 初始化 SpeechRecognition 对象
    if (!recognition) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN'; // 设置识别语言为中文
        recognition.continuous = false; // 单句识别模式
        recognition.interimResults = true; // 启用临时结果

        // 事件监听器
        recognition.onstart = () => {
            isListening = true;
            btn.classList.add('listening');
            input.placeholder = "正在听...";
            logEvent("语音", "语音识别已启动");
        };

        recognition.onend = () => {
            isListening = false;
            btn.classList.remove('listening');
            input.placeholder = "请输入...";
            logEvent("语音", "语音识别已停止");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value = transcript; // 将识别结果填入输入框
            logEvent("语音", `识别结果: ${transcript}`);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            isListening = false;
            btn.classList.remove('listening');

            let errorMessage = '语音识别出错';
            if (event.error === 'network') {
                errorMessage = '网络连接失败，请检查网络或尝试使用其他浏览器。';
            } else if (event.error === 'no-speech') {
                errorMessage = '未检测到语音，请重试。';
            } else if (event.error === 'not-allowed') {
                errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问。';
            } else if (event.error === 'service-not-allowed') {
                errorMessage = '语音识别服务不可用，请尝试使用 Chrome 或 Edge 浏览器。';
            }

            input.placeholder = errorMessage;
            logEvent("语音", `识别错误: ${event.error} - ${errorMessage}`);
        };
    }

    // 切换录音状态
    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
}
