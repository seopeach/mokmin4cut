/**
 * Snap4U - Premium AI Photobooth client-side logic
 * Enhanced with bright theme support, orientation adjustments, natural soft filters, 
 * customizable title text, decorative frames, and mock camera fallbacks.
 */

// --- STATE MANAGEMENT ---
const state = {
  mode: 'photo',
  cameraActive: false,
  stream: null,
  facingMode: 'user', // 'user' or 'environment'
  timer: 3,
  maxShots: 4,
  outputRatio: 'strip',
  titleFont: 'basic',
  capturedPhotos: [], // array of { id, dataUrl }
  selectedFrame: 'white',
  boothTitle: '목민네컷',
  frameText: '',
  showDate: true,
  cameraRatio: 'portrait', // 'portrait' (3:4) or 'landscape' (4:3)
  currentShotIndex: 0,
  isRecording: false,
  isCapturingSequence: false,
  retouchSettings: {
    enabled: true,
    brightness: 105,
    contrast: 100,
    saturation: 105,
    blur: 1, // Soft skin
    filter: 'normal',
    faceRetouchLevel: 0
  },
  videoChunks: [],
  mediaRecorder: null,
  recordedVideoBlob: null,
  recordedVideoMimeType: 'video/webm',
  recordingTimeline: [],
  recordingStartedAt: 0,
  qrTimerInterval: null,
  
  // Fallback simulator variables
  useMockCamera: false,
  mockAnimationId: null
};

// --- DOM ELEMENTS ---
const startScreen = document.getElementById('startScreen');
const startPhotoModeBtn = document.getElementById('startPhotoMode');

const headerLogo = document.getElementById('headerLogo');
const stepIndicator = document.getElementById('stepIndicator');

const navTabs = document.querySelectorAll('.nav-tab');
const cameraSection = document.querySelector('.camera-section');
const reviewSection = document.querySelector('.review-section');
const frameSection = document.querySelector('.frame-section');

const cameraStage = document.getElementById('cameraStage');
const cameraPreview = document.getElementById('cameraPreview');
const captureCanvas = document.getElementById('captureCanvas');
const frameOverlay = document.getElementById('frameOverlay');
const flashEffect = document.getElementById('flashEffect');
const countdownOverlay = document.getElementById('countdown');
const cameraStatus = document.getElementById('cameraStatus');

const cameraRatioRadios = document.getElementsByName('cameraRatio');
const timerSelect = document.getElementById('timerSelect');
const shotCount = document.getElementById('shotCount');
const shotCountGroup = document.getElementById('shotCountGroup');
const outputRatioRadios = document.getElementsByName('outputRatio');
const titleFontRadios = document.getElementsByName('titleFont');

const startCameraBtn = document.getElementById('startCameraButton');
const switchCameraBtn = document.getElementById('switchCameraButton');
const captureBtn = document.getElementById('captureButton');

const frameCards = document.querySelectorAll('.frame-card');
const boothTitleInput = document.getElementById('boothTitleInput');
const frameText = document.getElementById('frameText');
const showDateCheckbox = document.getElementById('showDate');

const retouchToggle = document.getElementById('retouchToggle');
const brightnessRange = document.getElementById('brightnessRange');
const contrastRange = document.getElementById('contrastRange');
const saturationRange = document.getElementById('saturationRange');
const blurRange = document.getElementById('blurRange');
const faceRetouchLevelRadios = document.getElementsByName('faceRetouchLevel');
const faceRetouchStatus = document.getElementById('faceRetouchStatus');

const brightnessVal = document.getElementById('brightnessVal');
const contrastVal = document.getElementById('contrastVal');
const saturationVal = document.getElementById('saturationVal');
const blurVal = document.getElementById('blurVal');

const filterBtns = document.querySelectorAll('.filter-btn');

const photoGrid = document.getElementById('photoGrid');
const resultCanvas = document.getElementById('resultCanvas');
const qrCodeArea = document.getElementById('qrCodeArea');
const qrTimer = document.getElementById('qrTimer');

const downloadImageBtn = document.getElementById('downloadImageButton');
const downloadVideoBtn = document.getElementById('downloadVideoButton');
const shareBtn = document.getElementById('shareButton');
const restartBtn = document.getElementById('restartButton');
const goToFrameBtn = document.getElementById('goToFrameButton');
const backToCameraBtn = document.getElementById('backToCameraButton');
const editOrderBtn = document.getElementById('editOrderButton');
const selectedPhotoCount = document.getElementById('selectedPhotoCount');

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateView('photo');
  applyRetouchSettings();
});

// --- ROUTING & VIEW CONTROLLER ---
function setupEventListeners() {
  // Start Screen buttons
  startPhotoModeBtn.addEventListener('click', () => {
    state.mode = 'photo';
    startScreen.classList.add('hidden');
    initiateCameraAuto();
  });

  headerLogo.addEventListener('click', (e) => {
    e.preventDefault();
    startScreen.classList.remove('hidden');
    stopCamera();
  });

  // Nav menu tabs
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      updateView(view);
    });
  });

  // Settings Panel orientation
  cameraRatioRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.cameraRatio = e.target.value;
      updateCameraAspectUI();
      if (state.cameraActive && !state.useMockCamera) {
        startCamera(); // Re-initialize camera constraints
      }
    });
  });


  timerSelect.addEventListener('change', (e) => {
    state.timer = parseInt(e.target.value);
  });

  shotCount.addEventListener('change', (e) => {
    state.maxShots = parseInt(e.target.value);
  });

  outputRatioRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.outputRatio = e.target.value;
      if (state.capturedPhotos.length > 0) compositePhotosToCanvas();
    });
  });

  titleFontRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.titleFont = e.target.value;
      if (state.capturedPhotos.length > 0) compositePhotosToCanvas();
    });
  });


  // Camera triggers
  startCameraBtn.addEventListener('click', toggleCameraConnection);
  switchCameraBtn.addEventListener('click', switchCameraDirection);
  captureBtn.addEventListener('click', handleCaptureTrigger);

  // Frames selector
  frameCards.forEach(card => {
    card.addEventListener('click', () => {
      frameCards.forEach(c => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('is-selected');
      card.setAttribute('aria-pressed', 'true');
      state.selectedFrame = card.getAttribute('data-frame');
      updateFrameOverlayClass();
      if (state.capturedPhotos.length > 0) {
        renderPhotoGrid();
        compositePhotosToCanvas();
      }
    });
  });

  boothTitleInput.addEventListener('input', (e) => {
    state.boothTitle = e.target.value || '목민네컷';
    if (state.capturedPhotos.length > 0) {
      renderPhotoGrid();
      compositePhotosToCanvas();
    }
  });

  frameText.addEventListener('input', (e) => {
    state.frameText = e.target.value;
    if (state.capturedPhotos.length > 0) {
      compositePhotosToCanvas();
    }
  });

  showDateCheckbox.addEventListener('change', (e) => {
    state.showDate = e.target.checked;
    if (state.capturedPhotos.length > 0) {
      compositePhotosToCanvas();
    }
  });

  faceRetouchLevelRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.retouchSettings.faceRetouchLevel = Number(e.target.value);
      const level = state.retouchSettings.faceRetouchLevel;
      if (faceRetouchStatus) {
        faceRetouchStatus.textContent = level === 0
          ? '기본 상태입니다.'
          : level === 1
            ? '1단계: 눈과 얼굴선을 자연스럽게 정돈합니다.'
            : '2단계: 눈과 얼굴선을 조금 더 선명하게 보정합니다.';
      }
      if (state.capturedPhotos.length > 0) compositePhotosToCanvas();
    });
  });

  // Retouch sliders
  retouchToggle.addEventListener('change', (e) => {
    state.retouchSettings.enabled = e.target.checked;
    applyRetouchSettings();
    if (state.capturedPhotos.length > 0) {
      compositePhotosToCanvas();
    }
  });

  [brightnessRange, contrastRange, saturationRange, blurRange].forEach(slider => {
    slider.addEventListener('input', () => {
      if (slider === brightnessRange) {
        state.retouchSettings.brightness = slider.value;
        brightnessVal.textContent = `${slider.value}%`;
      } else if (slider === contrastRange) {
        state.retouchSettings.contrast = slider.value;
        contrastVal.textContent = `${slider.value}%`;
      } else if (slider === saturationRange) {
        state.retouchSettings.saturation = slider.value;
        saturationVal.textContent = `${slider.value}%`;
      } else if (slider === blurRange) {
        state.retouchSettings.blur = slider.value;
        blurVal.textContent = `${slider.value}px`;
      }
      applyRetouchSettings();
      if (state.capturedPhotos.length > 0) {
        renderPhotoGrid();
        compositePhotosToCanvas();
      }
    });
  });

  // Filter selection
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.retouchSettings.filter = btn.getAttribute('data-filter');
      applyRetouchSettings();
      if (state.capturedPhotos.length > 0) {
        renderPhotoGrid();
        compositePhotosToCanvas();
      }
    });
  });

  // Downloader & Reset actions
  downloadImageBtn.addEventListener('click', downloadSynthesizedImage);
  downloadVideoBtn.addEventListener('click', downloadRecordedVideo);
  shareBtn.addEventListener('click', shareOutcome);
  restartBtn.addEventListener('click', resetSession);
  goToFrameBtn.addEventListener('click', () => { updateView('frame'); compositePhotosToCanvas(); });
  backToCameraBtn.addEventListener('click', () => updateView('photo'));
  editOrderBtn.addEventListener('click', () => updateView('review'));
}

function updateView(activeView) {
  navTabs.forEach(tab => {
    const viewName = tab.getAttribute('data-view');
    tab.classList.toggle('is-active', viewName === activeView);
  });

  cameraSection.style.display = 'none';
  reviewSection.style.display = 'none';
  frameSection.style.display = 'none';

  if (activeView === 'photo') {
    cameraSection.style.display = 'block';
    stepIndicator.textContent = 'STEP 1. 사진 촬영';
  } else if (activeView === 'review') {
    reviewSection.style.display = 'block';
    stepIndicator.textContent = 'STEP 2. 촬영 결과 확인';
    renderPhotoGrid();
  } else if (activeView === 'frame') {
    frameSection.style.display = 'block';
    stepIndicator.textContent = 'STEP 3. 프레임 및 보정 설정';
    compositePhotosToCanvas();
  }
}

function setCaptureModeUI() {
  captureBtn.innerHTML = '📸 촬영 시작';
}

function updateCameraAspectUI() {
  if (state.cameraRatio === 'portrait') {
    cameraStage.className = 'camera-stage aspect-3-4';
  } else {
    cameraStage.className = 'camera-stage aspect-4-3';
  }
}

function updateFrameOverlayClass() {
  frameOverlay.className = 'frame-overlay';
  frameOverlay.classList.add(`frame-${state.selectedFrame}`);
}

// --- MEDIA DEVICES CAMERA ENGINE ---
async function initiateCameraAuto() {
  if (!state.cameraActive) {
    await startCamera();
  }
}

async function startCamera() {
  cameraStatus.textContent = '카메라 장치 연결 중...';
  stopMockCameraLoop();
  
  try {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }

    const isPortrait = state.cameraRatio === 'portrait';
    const constraints = {
      video: {
        facingMode: state.facingMode,
        width: { ideal: isPortrait ? 960 : 1280 },
        height: { ideal: isPortrait ? 1280 : 960 }
      },
      audio: false
    };

    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    state.stream = mediaStream;
    cameraPreview.srcObject = mediaStream;
    cameraPreview.style.display = 'block';
    state.cameraActive = true;
    state.useMockCamera = false;
    cameraStatus.textContent = '카메라가 연결되었습니다.';
    captureBtn.disabled = false;
    startCameraBtn.textContent = '🔌 카메라 끊기';

    if (state.facingMode === 'environment') {
      cameraStage.classList.add('is-rear-camera');
    } else {
      cameraStage.classList.remove('is-rear-camera');
    }
  } catch (error) {
    console.warn('Physical camera blocked or not found. Switching to Mock Camera for presentation testing.', error);
    startMockCameraLoop();
  }
}

function stopCamera() {
  stopMockCameraLoop();
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
  cameraPreview.srcObject = null;
  state.cameraActive = false;
  captureBtn.disabled = true;
  cameraStatus.textContent = '카메라가 연결되어 있지 않습니다.';
  startCameraBtn.textContent = '🔌 카메라 연결';
}

async function toggleCameraConnection() {
  if (state.cameraActive) {
    stopCamera();
  } else {
    await startCamera();
  }
}

async function switchCameraDirection() {
  state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
  if (state.cameraActive && !state.useMockCamera) {
    await startCamera();
  }
}

// --- MOCK CAMERA LOOP FALLBACK ---
// If getUserMedia fails or is blocked, this draws a beautiful animated visual simulation on captureCanvas,
// piping it onto the video element using captureStream() or painting it directly, 
// so the user can test the app without a physical camera.
function startMockCameraLoop() {
  state.useMockCamera = true;
  state.cameraActive = true;
  captureBtn.disabled = false;
  startCameraBtn.textContent = '🔌 카메라 끊기';
  cameraStatus.textContent = '테스트용 가상 웹캠 모드로 연결되었습니다.';
  
  cameraPreview.style.display = 'none'; // hide real video
  
  // Set dimensions
  const isPortrait = state.cameraRatio === 'portrait';
  captureCanvas.width = isPortrait ? 480 : 640;
  captureCanvas.height = isPortrait ? 640 : 480;
  captureCanvas.hidden = false;
  captureCanvas.style.width = '100%';
  captureCanvas.style.height = '100%';
  captureCanvas.style.objectFit = 'cover';

  const ctx = captureCanvas.getContext('2d');
  let frameCount = 0;

  function drawMockFrame() {
    if (!state.useMockCamera) return;
    
    const w = captureCanvas.width;
    const h = captureCanvas.height;
    
    // Draw background pastel gradient
    const gradient = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, w);
    gradient.addColorStop(0, '#f9f9fc');
    gradient.addColorStop(1, '#dfe4ea');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Draw animated pastel decoration circles
    ctx.fillStyle = 'rgba(140, 122, 230, 0.15)';
    ctx.beginPath();
    ctx.arc(w/2 + Math.cos(frameCount/30) * 40, h/2 - 50 + Math.sin(frameCount/50) * 20, 90, 0, 2*Math.PI);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 143, 177, 0.15)';
    ctx.beginPath();
    ctx.arc(w/2 - 60 + Math.sin(frameCount/40) * 30, h/2 + 60, 70, 0, 2*Math.PI);
    ctx.fill();

    // Draw simulated portrait silhouette
    ctx.fillStyle = '#718093';
    ctx.beginPath();
    ctx.arc(w/2, h/2 - 20, 55, 0, 2 * Math.PI); // Head
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(w/2, h/2 + 90, 85, 60, 0, 0, 2 * Math.PI); // Shoulders
    ctx.fill();

    // Face elements
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w/2 - 18, h/2 - 25, 6, 0, 2 * Math.PI); // eye
    ctx.arc(w/2 + 18, h/2 - 25, 6, 0, 2 * Math.PI); // eye
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w/2, h/2 - 10, 18, 0.1 * Math.PI, 0.9 * Math.PI); // Smile
    ctx.stroke();

    // Flashy label
    ctx.fillStyle = '#8c7ae6';
    ctx.font = 'bold 16px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📸 웹캠 테스트 모드', w/2, h - 35);
    ctx.fillStyle = '#718093';
    ctx.font = '12px Pretendard, sans-serif';
    ctx.fillText('촬영을 시작하면 이쁜 모형 컷이 합성됩니다', w/2, h - 15);

    frameCount++;
    state.mockAnimationId = requestAnimationFrame(drawMockFrame);
  }

  drawMockFrame();
}

function stopMockCameraLoop() {
  state.useMockCamera = false;
  captureCanvas.hidden = true;
  if (state.mockAnimationId) {
    cancelAnimationFrame(state.mockAnimationId);
    state.mockAnimationId = null;
  }
}

// --- NATURAL FILTERS & GLOW PRESETS ---
function applyRetouchSettings() {
  if (!state.retouchSettings.enabled) {
    cameraPreview.style.filter = 'none';
    captureCanvas.style.filter = 'none';
    return;
  }

  const filterStr = getCanvasFilterString();
  cameraPreview.style.filter = filterStr;
  captureCanvas.style.filter = filterStr;
}

// Generates smooth, gorgeous filter layers
function getCanvasFilterString() {
  if (!state.retouchSettings.enabled) return 'none';
  const { brightness, contrast, saturation, blur, filter } = state.retouchSettings;
  
  let filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  
  if (parseFloat(blur) > 0) {
    filterStr += ` blur(${blur * 0.5}px)`; // scale slightly for preview naturalness
  }

  switch (filter) {
    case 'bright': // 뽀샤시
      filterStr += ' brightness(108%) contrast(102%) saturate(106%)';
      break;
    case 'peach': // 피치 웜
      filterStr += ' sepia(22%) saturate(125%) hue-rotate(-10deg) brightness(104%)';
      break;
    case 'clear': // 맑은 쿨
      filterStr += ' saturate(115%) contrast(108%) hue-rotate(5deg) brightness(102%)';
      break;
    case 'film':
      filterStr += ' sepia(30%) contrast(95%) saturate(90%)';
      break;
    case 'mono':
      filterStr += ' grayscale(100%) contrast(105%)';
      break;
  }
  return filterStr;
}

function drawImageCover(ctx, source, x, y, targetWidth, targetHeight) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
  if (!sourceWidth || !sourceHeight) return;

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.drawImage(source, sx, sy, sw, sh, x, y, targetWidth, targetHeight);
}

// --- CAPTURE SEQUENCE ENGINE ---
function handleCaptureTrigger() {
  startPhotoCaptureSequence();
}


function getRecordableStream() {
  try {
    if (state.useMockCamera && captureCanvas.captureStream) {
      return captureCanvas.captureStream(30);
    }
    if (cameraPreview.captureStream) {
      return cameraPreview.captureStream(30);
    }
    return state.stream;
  } catch (error) {
    return state.stream;
  }
}

async function startAutoProcessRecording() {
  state.videoChunks = [];
  state.recordedVideoBlob = null;
  state.recordedVideoMimeType = 'video/webm';
  state.recordingStartedAt = 0;
  downloadVideoBtn.disabled = true;
  const recordableStream = getRecordableStream();
  if (!recordableStream || typeof MediaRecorder === 'undefined') return false;

  let options = { mimeType: 'video/webm;codecs=vp9,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm;codecs=vp8,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };

  try {
    state.mediaRecorder = new MediaRecorder(recordableStream, options);
    state.recordedVideoMimeType = options.mimeType || 'video/webm';
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) state.videoChunks.push(e.data);
    };
    state.mediaRecorder.start();
    state.recordingStartedAt = performance.now();
    return true;
  } catch (error) {
    console.warn('자동 촬영 영상 기록 시작 실패', error);
    state.mediaRecorder = null;
    state.recordingStartedAt = 0;
    return false;
  }
}

function stopAutoProcessRecording() {
  return new Promise((resolve) => {
    if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }
    state.mediaRecorder.onstop = () => {
      state.recordedVideoBlob = state.videoChunks.length
        ? new Blob(state.videoChunks, { type: state.recordedVideoMimeType || state.mediaRecorder.mimeType || 'video/webm' })
        : null;
      downloadVideoBtn.disabled = !state.recordedVideoBlob;
      resolve(state.recordedVideoBlob);
    };
    state.mediaRecorder.stop();
  });
}

async function startPhotoCaptureSequence() {
  if (state.isCapturingSequence) return;
  state.isCapturingSequence = true;
  state.capturedPhotos = [];
  state.currentShotIndex = 0;
  state.recordingTimeline = [];
  captureBtn.disabled = true;
  startCameraBtn.disabled = true;
  switchCameraBtn.disabled = true;
  cameraStatus.textContent = '촬영 준비 중입니다.';

  await startAutoProcessRecording();

  for (let i = 0; i < state.maxShots; i++) {
    state.currentShotIndex = i;
    const segment = {
      index: i,
      start: state.recordingStartedAt ? Math.max(0, (performance.now() - state.recordingStartedAt) / 1000) : i * (state.timer + 1.2),
      end: null
    };

    cameraStatus.textContent = `${i + 1}번째 컷 촬영 대기 중 (${i + 1}/${state.maxShots})`;
    await runCountdown(state.timer);
    triggerFlashEffect();
    captureSinglePhoto(i);
    await new Promise(r => setTimeout(r, 900));
    segment.end = state.recordingStartedAt
      ? Math.max(segment.start + 1, (performance.now() - state.recordingStartedAt) / 1000)
      : segment.start + Math.max(1.4, state.timer + 0.9);
    state.recordingTimeline.push(segment);
  }

  await stopAutoProcessRecording();
  state.isCapturingSequence = false;
  captureBtn.disabled = false;
  startCameraBtn.disabled = false;
  switchCameraBtn.disabled = false;
  cameraStatus.textContent = '촬영이 완료되었습니다! 촬영 결과를 확인해 주세요.';

  document.querySelector('[data-view="review"]').disabled = false;
  document.querySelector('[data-view="frame"]').disabled = false;
  updateView('review');
  renderPhotoGrid();
}


function runCountdown(seconds) {
  return new Promise((resolve) => {
    if (seconds === 0) {
      resolve();
      return;
    }
    countdownOverlay.style.display = 'grid';
    let current = seconds;
    countdownOverlay.textContent = current;

    const timer = setInterval(() => {
      current--;
      if (current <= 0) {
        clearInterval(timer);
        countdownOverlay.style.display = 'none';
        resolve();
      } else {
        countdownOverlay.textContent = current;
      }
    }, 1000);
  });
}

function triggerFlashEffect() {
  flashEffect.classList.add('flash-active');
  setTimeout(() => {
    flashEffect.classList.remove('flash-active');
  }, 400);
}

function captureSinglePhoto(index) {
  const isPortrait = state.cameraRatio === 'portrait';
  const outCanvas = document.createElement('canvas');
  const w = isPortrait ? 768 : 1024;
  const h = isPortrait ? 1024 : 768;
  outCanvas.width = w;
  outCanvas.height = h;
  const ctx = outCanvas.getContext('2d');

  if (state.useMockCamera) {
    // Generate beautiful virtual template photo
    const hue = (index * 75) % 360;
    
    // Draw soft aesthetic background
    ctx.fillStyle = `hsl(${hue}, 80%, 88%)`;
    ctx.fillRect(0, 0, w, h);
    
    // Gradient circles
    ctx.fillStyle = `hsl(${(hue + 60) % 360}, 80%, 75%)`;
    ctx.beginPath();
    ctx.arc(w/2, h/2 - 40, w * 0.28, 0, 2*Math.PI);
    ctx.fill();

    // Cute smiley emoji or abstract design matching index
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w/2 - 50, h/2 - 60, 20, 0, 2 * Math.PI);
    ctx.arc(w/2 + 50, h/2 - 60, 20, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w/2, h/2 - 10, 60, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = `hsl(${hue}, 80%, 35%)`;
    ctx.font = 'bold 36px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📸 Mock Capture #${index + 1}`, w/2, h - 100);
  } else {
    // Mirror standard camera stream
    if (state.facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = 'none';
    drawImageCover(ctx, cameraPreview, 0, 0, w, h);
  }

  const dataUrl = outCanvas.toDataURL('image/png');
  state.capturedPhotos.push({
    id: Date.now() + Math.random(),
    dataUrl: dataUrl
  });
}

// --- PHOTO GRID & REORDERING ---
function renderPhotoGrid() {
  photoGrid.innerHTML = '';
  if (selectedPhotoCount) selectedPhotoCount.textContent = `${state.capturedPhotos.length}장`;
  if (goToFrameBtn) goToFrameBtn.disabled = state.capturedPhotos.length === 0;
  state.capturedPhotos.forEach((photo, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.draggable = true;
    card.dataset.index = index;

    card.innerHTML = `
      <img src="${photo.dataUrl}" alt="${index + 1}번째 촬영본" style="filter: ${getCanvasFilterString()};">
      <div class="photo-badge">${index + 1}</div>
      <div class="photo-card-actions">
        <button type="button" class="photo-action-btn re-shoot-btn" title="이 컷만 재촬영">🔄</button>
        <button type="button" class="photo-action-btn delete-btn" title="삭제">❌</button>
      </div>
    `;

    card.querySelector('.re-shoot-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      reshootIndividualPhoto(index);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteIndividualPhoto(index);
    });

    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);

    photoGrid.appendChild(card);
  });
}

async function reshootIndividualPhoto(index) {
  updateView('photo');
  cameraStatus.textContent = `${index + 1}번째 컷을 재촬영합니다.`;
  await runCountdown(state.timer);
  triggerFlashEffect();
  
  const isPortrait = state.cameraRatio === 'portrait';
  const outCanvas = document.createElement('canvas');
  const w = isPortrait ? 768 : 1024;
  const h = isPortrait ? 1024 : 768;
  outCanvas.width = w;
  outCanvas.height = h;
  const ctx = outCanvas.getContext('2d');
  
  if (state.useMockCamera) {
    const hue = (index * 75) % 360;
    ctx.fillStyle = `hsl(${hue}, 80%, 88%)`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `hsl(${(hue + 120) % 360}, 80%, 75%)`;
    ctx.beginPath();
    ctx.arc(w/2, h/2 - 40, w * 0.28, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📸 Re-shot Mock #${index + 1}`, w/2, h/2);
  } else {
    if (state.facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = 'none';
    drawImageCover(ctx, cameraPreview, 0, 0, w, h);
  }
  
  state.capturedPhotos[index].dataUrl = outCanvas.toDataURL('image/png');
  
  // Return to photo review view
  updateView('review');
  renderPhotoGrid();
  compositePhotosToCanvas();
}

function deleteIndividualPhoto(index) {
  if (confirm('선택한 컷을 정말 삭제하시겠습니까?')) {
    state.capturedPhotos.splice(index, 1);
    renderPhotoGrid();
    compositePhotosToCanvas();
  }
}

// Drag & drop logic
let dragSourceEl = null;

function handleDragStart(e) {
  dragSourceEl = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.index);
}

function handleDragOver(e) {
  e.preventDefault();
  return false;
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();

  const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
  const targetIndex = parseInt(this.dataset.index);

  if (sourceIndex !== targetIndex) {
    const temp = state.capturedPhotos[sourceIndex];
    state.capturedPhotos[sourceIndex] = state.capturedPhotos[targetIndex];
    state.capturedPhotos[targetIndex] = temp;

    renderPhotoGrid();
    compositePhotosToCanvas();
  }
}

function handleDragEnd() {
  this.classList.remove('dragging');
}

// --- CANVAS COMPOSITE ENGINE (4-CUT LAYOUT) ---
function getCompositeLayout(totalImages = state.capturedPhotos.length, outputRatio = state.outputRatio || 'strip') {
  const count = Math.max(1, Math.min(totalImages, 4));
  const photoAspect = state.cameraRatio === 'portrait' ? (3 / 4) : (4 / 3);
  let canvasWidth = 800;
  let canvasHeight = 1600;
  let footerHeight = 180;
  let slots = [];

  if (outputRatio === 'strip') {
    canvasWidth = 820;
    footerHeight = count === 1 ? 210 : 180;
    const paddingX = count === 1 ? 62 : 46;
    const paddingTop = count === 1 ? 70 : 46;
    const gap = count === 3 ? 24 : 28;

    if (count === 1) {
      const slotWidth = canvasWidth - paddingX * 2;
      const slotHeight = slotWidth / photoAspect;
      canvasHeight = paddingTop * 2 + slotHeight + footerHeight;
      slots.push({ x: paddingX, y: paddingTop, width: slotWidth, height: slotHeight });
    } else {
      const slotWidth = canvasWidth - paddingX * 2;
      const slotHeight = slotWidth / photoAspect;
      canvasHeight = paddingTop * 2 + slotHeight * count + gap * (count - 1) + footerHeight;
      for (let i = 0; i < count; i++) {
        slots.push({ x: paddingX, y: paddingTop + i * (slotHeight + gap), width: slotWidth, height: slotHeight });
      }
    }
  } else {
    canvasWidth = outputRatio === 'landscape43' ? 1440 : 1080;
    canvasHeight = outputRatio === 'landscape43' ? 1080 : 1440;
    footerHeight = outputRatio === 'landscape43' ? 182 : 200;
    const paddingX = outputRatio === 'landscape43' ? 54 : 48;
    const paddingTop = 46;
    const gap = 26;
    const availableWidth = canvasWidth - paddingX * 2;
    const availableHeight = canvasHeight - footerHeight - paddingTop * 2;

    const fitSlot = (maxWidth, maxHeight) => {
      let width;
      let height;
      if ((maxWidth / maxHeight) > photoAspect) {
        height = maxHeight;
        width = height * photoAspect;
      } else {
        width = maxWidth;
        height = width / photoAspect;
      }
      return { width, height };
    };

    if (count === 1) {
      const slot = fitSlot(availableWidth * 0.82, availableHeight * 0.9);
      slots.push({
        x: (canvasWidth - slot.width) / 2,
        y: paddingTop + (availableHeight - slot.height) / 2,
        width: slot.width,
        height: slot.height
      });
    } else if (count === 2) {
      if (outputRatio === 'landscape43') {
        const slot = fitSlot((availableWidth - gap) / 2, availableHeight * 0.92);
        const groupWidth = slot.width * 2 + gap;
        const startX = (canvasWidth - groupWidth) / 2;
        const y = paddingTop + (availableHeight - slot.height) / 2;
        for (let i = 0; i < 2; i++) {
          slots.push({ x: startX + i * (slot.width + gap), y, width: slot.width, height: slot.height });
        }
      } else {
        const slot = fitSlot(availableWidth * 0.86, (availableHeight - gap) / 2);
        const groupHeight = slot.height * 2 + gap;
        const startY = paddingTop + (availableHeight - groupHeight) / 2;
        const x = (canvasWidth - slot.width) / 2;
        for (let i = 0; i < 2; i++) {
          slots.push({ x, y: startY + i * (slot.height + gap), width: slot.width, height: slot.height });
        }
      }
    } else if (count === 3) {
      if (outputRatio === 'landscape43') {
        const topSlot = fitSlot(availableWidth * 0.58, availableHeight * 0.54);
        const smallSlot = fitSlot((availableWidth - gap) / 2, availableHeight * 0.38);
        const topX = (canvasWidth - topSlot.width) / 2;
        const topY = paddingTop;
        const bottomWidth = smallSlot.width * 2 + gap;
        const bottomX = (canvasWidth - bottomWidth) / 2;
        const bottomY = paddingTop + availableHeight - smallSlot.height;
        slots.push({ x: topX, y: topY, width: topSlot.width, height: topSlot.height });
        slots.push({ x: bottomX, y: bottomY, width: smallSlot.width, height: smallSlot.height });
        slots.push({ x: bottomX + smallSlot.width + gap, y: bottomY, width: smallSlot.width, height: smallSlot.height });
      } else {
        const topSlot = fitSlot(availableWidth * 0.86, availableHeight * 0.46);
        const smallSlot = fitSlot((availableWidth - gap) / 2, availableHeight * 0.38);
        const topX = (canvasWidth - topSlot.width) / 2;
        const topY = paddingTop;
        const bottomWidth = smallSlot.width * 2 + gap;
        const bottomX = (canvasWidth - bottomWidth) / 2;
        const bottomY = paddingTop + availableHeight - smallSlot.height;
        slots.push({ x: topX, y: topY, width: topSlot.width, height: topSlot.height });
        slots.push({ x: bottomX, y: bottomY, width: smallSlot.width, height: smallSlot.height });
        slots.push({ x: bottomX + smallSlot.width + gap, y: bottomY, width: smallSlot.width, height: smallSlot.height });
      }
    } else {
      const maxCellWidth = (availableWidth - gap) / 2;
      const maxCellHeight = (availableHeight - gap) / 2;
      const slot = fitSlot(maxCellWidth, maxCellHeight);
      const gridWidth = slot.width * 2 + gap;
      const gridHeight = slot.height * 2 + gap;
      const startX = (canvasWidth - gridWidth) / 2;
      const startY = paddingTop + (availableHeight - gridHeight) / 2;
      for (let i = 0; i < 4; i++) {
        slots.push({
          x: startX + (i % 2) * (slot.width + gap),
          y: startY + Math.floor(i / 2) * (slot.height + gap),
          width: slot.width,
          height: slot.height
        });
      }
    }
  }

  return { canvasWidth, canvasHeight, footerHeight, slots, photoAspect, outputRatio, count };
}

function drawRoundedSlotImage(ctx, source, slot, filterStr = 'none') {
  ctx.save();
  const r = 22;
  ctx.beginPath();
  ctx.moveTo(slot.x + r, slot.y);
  ctx.lineTo(slot.x + slot.width - r, slot.y);
  ctx.quadraticCurveTo(slot.x + slot.width, slot.y, slot.x + slot.width, slot.y + r);
  ctx.lineTo(slot.x + slot.width, slot.y + slot.height - r);
  ctx.quadraticCurveTo(slot.x + slot.width, slot.y + slot.height, slot.x + slot.width - r, slot.y + slot.height);
  ctx.lineTo(slot.x + r, slot.y + slot.height);
  ctx.quadraticCurveTo(slot.x, slot.y + slot.height, slot.x, slot.y + slot.height - r);
  ctx.lineTo(slot.x, slot.y + r);
  ctx.quadraticCurveTo(slot.x, slot.y, slot.x + r, slot.y);
  ctx.closePath();
  ctx.clip();
  ctx.filter = filterStr;
  drawImageCover(ctx, source, slot.x, slot.y, slot.width, slot.height);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 4;
  roundRect(ctx, slot.x, slot.y, slot.width, slot.height, 22, false, true);
  ctx.restore();
}

// --- LOCAL FACE RETOUCH ---
let localFaceDetector = null;

function createSourceCanvas(source) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  return canvas;
}

function normalizeFaceBox(box, width, height) {
  const x = Math.max(0, Number(box?.x ?? box?.left ?? width * 0.24));
  const y = Math.max(0, Number(box?.y ?? box?.top ?? height * 0.13));
  const w = Math.min(width - x, Number(box?.width ?? width * 0.52));
  const h = Math.min(height - y, Number(box?.height ?? height * 0.62));
  return { x, y, width: Math.max(40, w), height: Math.max(50, h) };
}

async function detectLocalFaces(canvas) {
  try {
    if ('FaceDetector' in window) {
      localFaceDetector ||= new FaceDetector({ fastMode: true, maxDetectedFaces: 6 });
      const faces = await localFaceDetector.detect(canvas);
      if (faces?.length) return faces;
    }
  } catch (error) {
    console.warn('얼굴 감지를 사용할 수 없어 중앙 얼굴 기준으로 보정합니다.', error);
  }
  return [{ boundingBox: { x: canvas.width * 0.24, y: canvas.height * 0.13, width: canvas.width * 0.52, height: canvas.height * 0.62 }, landmarks: [] }];
}

function getEyeCenters(face, box) {
  const eyePoints = [];
  (face?.landmarks || []).forEach((landmark) => {
    if (!String(landmark.type || '').toLowerCase().includes('eye')) return;
    const locations = landmark.locations || landmark.points || [];
    if (!locations.length) return;
    eyePoints.push({
      x: locations.reduce((sum, p) => sum + Number(p.x || 0), 0) / locations.length,
      y: locations.reduce((sum, p) => sum + Number(p.y || 0), 0) / locations.length
    });
  });
  if (eyePoints.length >= 2) return eyePoints.slice(0, 2).sort((a, b) => a.x - b.x);
  return [
    { x: box.x + box.width * 0.34, y: box.y + box.height * 0.38 },
    { x: box.x + box.width * 0.66, y: box.y + box.height * 0.38 }
  ];
}

function drawMagnifiedEye(ctx, sourceCanvas, eye, box, scale) {
  const rx = box.width * 0.105;
  const ry = box.height * 0.075;
  const sx = Math.max(0, eye.x - rx);
  const sy = Math.max(0, eye.y - ry);
  const sw = Math.min(sourceCanvas.width - sx, rx * 2);
  const sh = Math.min(sourceCanvas.height - sy, ry * 2);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(eye.x, eye.y, dw * 0.52, dh * 0.5, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, eye.x - dw / 2, eye.y - dh / 2, dw, dh);
  ctx.restore();
}

async function applyFaceRetouchToSource(source, level) {
  if (!level) return source;
  const base = createSourceCanvas(source);
  const output = document.createElement('canvas');
  output.width = base.width;
  output.height = base.height;
  const ctx = output.getContext('2d');
  ctx.drawImage(base, 0, 0);

  const faces = await detectLocalFaces(base);
  const slimScale = level === 1 ? 0.975 : 0.95;
  const eyeScale = level === 1 ? 1.03 : 1.06;
  const smoothOpacity = level === 1 ? 0.11 : 0.17;

  faces.forEach((face) => {
    const box = normalizeFaceBox(face.boundingBox, base.width, base.height);
    const centerX = box.x + box.width / 2;
    const narrowedWidth = box.width * slimScale;

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.ellipse(centerX, box.y + box.height * 0.52, box.width * 0.49, box.height * 0.51, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(base, box.x, box.y, box.width, box.height, centerX - narrowedWidth / 2, box.y, narrowedWidth, box.height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = smoothOpacity;
    ctx.filter = level === 1 ? 'blur(2.2px)' : 'blur(3.2px)';
    ctx.beginPath();
    ctx.ellipse(centerX, box.y + box.height * 0.51, box.width * 0.43, box.height * 0.44, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(base, box.x, box.y, box.width, box.height, box.x, box.y, box.width, box.height);
    ctx.restore();

    getEyeCenters(face, box).forEach((eye) => drawMagnifiedEye(ctx, base, eye, box, eyeScale));
  });
  return output;
}

function compositePhotosToCanvas() {
  const photos = state.capturedPhotos;
  if (photos.length === 0) return;

  const layout = getCompositeLayout(photos.length, state.outputRatio || 'strip');
  const { canvasWidth, canvasHeight, footerHeight, slots, outputRatio } = layout;
  const ctx = resultCanvas.getContext('2d');
  resultCanvas.width = canvasWidth;
  resultCanvas.height = canvasHeight;
  drawFramePattern(ctx, canvasWidth, canvasHeight, footerHeight, outputRatio);

  const filterStr = getCanvasFilterString();
  let loadedCount = 0;
  slots.forEach((slot, index) => {
    const photo = photos[index];
    if (!photo) {
      loadedCount++;
      return;
    }
    const img = new Image();
    img.src = photo.dataUrl;
    img.onload = async () => {
      const faceSource = await applyFaceRetouchToSource(
        img,
        state.retouchSettings.enabled ? state.retouchSettings.faceRetouchLevel : 0
      );
      drawRoundedSlotImage(ctx, faceSource, slot, filterStr);
      loadedCount++;
      if (loadedCount === slots.length) {
        drawForegroundDecorations(ctx, slots, canvasWidth, canvasHeight, footerHeight, outputRatio);
        drawFrameOverlayText(ctx, canvasWidth, canvasHeight, footerHeight, outputRatio);
      }
    };
  });
}

function drawSparkle(ctx, x, y, size, color = 'rgba(255,255,255,0.95)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
  ctx.moveTo(x - size * 0.7, y - size * 0.7); ctx.lineTo(x + size * 0.7, y + size * 0.7);
  ctx.moveTo(x + size * 0.7, y - size * 0.7); ctx.lineTo(x - size * 0.7, y + size * 0.7);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(ctx, x, y, size, color, stroke = null) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x - size, y - size * 0.45, x - size * 1.25, y + size * 0.8, x, y + size * 1.2);
  ctx.bezierCurveTo(x + size * 1.25, y + size * 0.8, x + size, y - size * 0.45, x, y + size * 0.3);
  if (color) { ctx.fillStyle = color; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(2, size * 0.1); ctx.stroke(); }
  ctx.restore();
}

function drawFramePattern(ctx, w, h, footerHeight, outputRatio) {
  const frame = state.selectedFrame;
  const footerTop = h - footerHeight;
  ctx.clearRect(0, 0, w, h);

  const paint = (fill) => { ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h); };
  const vg = (...stops) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    return g;
  };
  const hg = (...stops) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    return g;
  };
  const orb = (x, y, rx, ry, color, alpha = 1, angle = 0) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const glossyBand = (y, heightBand, alpha = 0.24) => {
    const g = ctx.createLinearGradient(0, y, 0, y + heightBand);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.55, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, heightBand);
  };
  const footerPanel = (fill, stroke = 'rgba(255,255,255,0.38)', shadow = 'rgba(0,0,0,0.12)') => {
    ctx.save();
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = fill;
    roundRect(ctx, 18, footerTop + 18, w - 36, footerHeight - 36, 30, true, false);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    roundRect(ctx, 18, footerTop + 18, w - 36, footerHeight - 36, 30, false, true);
    ctx.restore();
  };

  if (frame === 'white') {
    paint('#ffffff');
  } else if (frame === 'black') {
    paint('#111111');
  } else if (frame === 'pink') {
    paint(vg([0, '#ff67b7'], [0.44, '#ff95cf'], [1, '#ffd3ec']));
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = -20; x < w + 40; x += 34) ctx.fillRect(x, 0, 5, h);
    for (let y = 0; y < h; y += 34) ctx.fillRect(0, y, w, 2);
    orb(w * 0.82, 98, 76, 76, 'rgba(255,255,255,0.24)');
    orb(w * 0.18, h * 0.68, 64, 64, 'rgba(133,214,255,0.18)');
    glossyBand(42, 96, 0.32);
    footerPanel('rgba(255,246,251,0.88)', 'rgba(255,255,255,0.72)', 'rgba(216,80,149,0.24)');
  } else if (frame === 'blue') {
    paint(vg([0, '#8fd8ff'], [0.48, '#61c2ff'], [1, '#d5efff']));
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let x = -w; x < w * 2; x += 88) ctx.fillRect(x, 0, 16, h);
    orb(w * 0.78, 104, 72, 72, 'rgba(255,255,255,0.18)');
    orb(w * 0.2, h * 0.72, 58, 58, 'rgba(255,244,172,0.16)');
    glossyBand(48, 84, 0.28);
    footerPanel('rgba(239,249,255,0.9)', 'rgba(255,255,255,0.8)', 'rgba(86,176,233,0.2)');
  } else if (frame === 'chrome') {
    paint(hg([0, '#d9e0e9'], [0.16, '#ffffff'], [0.36, '#b4bdca'], [0.58, '#f8f9fb'], [0.78, '#98a3b3'], [1, '#eef2f7']));
    for (let i = -1; i < 10; i++) {
      const band = hg([0, 'rgba(255,255,255,0)'], [0.2, 'rgba(255,255,255,0.52)'], [0.45, 'rgba(134,144,160,0.18)'], [0.72, 'rgba(255,255,255,0.48)'], [1, 'rgba(255,255,255,0)']);
      ctx.fillStyle = band;
      ctx.fillRect(0, i * 100 + 24, w, 44);
    }
    footerPanel('rgba(247,249,251,0.92)', 'rgba(255,255,255,0.9)', 'rgba(123,133,149,0.2)');
  } else if (frame === 'dots') {
    paint('#fff7fc');
    for (let x = 12; x < w; x += 22) {
      for (let y = 12; y < h; y += 22) {
        ctx.fillStyle = (x + y) % 44 === 0 ? 'rgba(255,171,215,0.74)' : 'rgba(153,219,255,0.58)';
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    footerPanel('rgba(255,255,255,0.94)', 'rgba(255,214,233,0.68)', 'rgba(233,143,182,0.12)');
  } else if (frame === 'bubble') {
    paint(vg([0, '#ffe6fb'], [0.55, '#ecf7ff'], [1, '#fff7ed']));
    [[110, 96, 54], [680, 126, 38], [136, h * 0.66, 28], [630, h * 0.74, 46], [420, footerTop - 26, 42]].forEach(([x, y, r]) => drawBead(ctx, x, y, r, 'rgba(255,255,255,0.34)'));
    glossyBand(36, 88, 0.34);
    footerPanel('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.86)', 'rgba(173,205,232,0.18)');
  } else if (frame === 'checker') {
    const size = 40;
    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? 'rgba(255,182,220,0.72)' : 'rgba(184,229,255,0.7)';
        ctx.fillRect(x, y, size, size);
      }
    }
    orb(w * 0.78, 100, 76, 54, 'rgba(255,247,184,0.32)');
    footerPanel('rgba(255,255,255,0.92)', 'rgba(255,255,255,0.88)', 'rgba(138,113,170,0.14)');
  } else if (frame === 'confetti') {
    paint(vg([0, '#fff7ff'], [1, '#fff0f8']));
    const accents = ['#ff8fc9', '#8fd8ff', '#ffd96a', '#a9ef9c', '#c9c2ff'];
    for (let i = 0; i < 88; i++) {
      ctx.save();
      ctx.translate(28 + (i * 79) % (w - 56), 30 + (i * 131) % (h - footerHeight - 52));
      ctx.rotate((i % 7) * 0.32);
      ctx.fillStyle = accents[i % accents.length] + 'cc';
      ctx.fillRect(-6, -2, 12 + (i % 3) * 4, 5 + (i % 2));
      ctx.restore();
    }
    footerPanel('rgba(255,255,255,0.94)', 'rgba(255,228,241,0.84)', 'rgba(230,158,203,0.14)');
  } else if (frame === 'faith') {
    paint(vg([0, '#f7faff'], [0.42, '#dce5ff'], [1, '#f8f9ff']));
    const rg = ctx.createRadialGradient(w * 0.5, 120, 30, w * 0.5, 120, 260);
    rg.addColorStop(0, 'rgba(255,255,255,0.96)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    for (let i = -4; i <= 4; i++) {
      ctx.save();
      ctx.translate(w * 0.5, 86);
      ctx.rotate(i * 0.16);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(-7, 0, 14, h * 0.56);
      ctx.restore();
    }
    footerPanel('rgba(255,255,255,0.95)', 'rgba(213,222,255,0.9)', 'rgba(171,185,234,0.18)');
  } else if (frame === 'clover') {
    paint(vg([0, '#c7f4b8'], [0.46, '#8fdf7f'], [1, '#f8ffd7']));
    orb(w * 0.22, 112, 84, 58, 'rgba(255,255,255,0.18)');
    orb(w * 0.78, h * 0.72, 78, 54, 'rgba(245,255,195,0.22)');
    footerPanel('rgba(255,255,255,0.92)', 'rgba(236,255,204,0.88)', 'rgba(118,194,92,0.18)');
  } else if (frame === 'heart') {
    paint(vg([0, '#ffd3e7'], [0.48, '#ff97ce'], [1, '#ffeaf3']));
    orb(w * 0.16, 108, 76, 54, 'rgba(255,255,255,0.2)');
    orb(w * 0.84, h * 0.7, 72, 52, 'rgba(255,220,146,0.18)');
    glossyBand(42, 90, 0.32);
    footerPanel('rgba(255,255,255,0.92)', 'rgba(255,230,241,0.9)', 'rgba(222,128,176,0.18)');
  }
}

function drawStickerHeart(ctx, x, y, size, primary = '#ff8fcb', secondary = '#ffffff', angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(120, 72, 104, 0.22)';
  ctx.shadowBlur = size * 0.7;
  ctx.shadowOffsetY = size * 0.18;
  const g = ctx.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, secondary);
  g.addColorStop(0.4, '#ffdff0');
  g.addColorStop(1, primary);
  drawHeart(ctx, 0, -size * 0.55, size, g, 'rgba(255,255,255,0.92)');
  ctx.globalAlpha = 0.78;
  drawHeart(ctx, 0, -size * 0.62, size * 0.52, 'rgba(255,255,255,0.72)');
  ctx.restore();
}

function drawStickerClover(ctx, x, y, size, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(52, 140, 63, 0.25)';
  ctx.shadowBlur = size * 0.8;
  ctx.shadowOffsetY = size * 0.14;
  const petal = (dx, dy, c1, c2) => {
    const g = ctx.createLinearGradient(dx - size * 0.4, dy - size * 0.4, dx + size * 0.5, dy + size * 0.5);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(dx, dy, size * 0.56, 0, Math.PI * 2);
    ctx.fill();
  };
  petal(-size * 0.38, -size * 0.38, '#ebffd8', '#6fe081');
  petal(size * 0.38, -size * 0.38, '#f6ffe7', '#8ef19e');
  petal(-size * 0.38, size * 0.38, '#e4ffdc', '#75df87');
  petal(size * 0.38, size * 0.38, '#f0ffdf', '#8be998');
  ctx.strokeStyle = 'rgba(92,173,91,0.95)';
  ctx.lineWidth = Math.max(2,size*0.12);
  ctx.beginPath();
  ctx.moveTo(0, size*0.4);
  ctx.quadraticCurveTo(size*0.28,size*1.18,-size*0.2,size*1.72);
  ctx.stroke();
  ctx.restore();
}

function drawBead(ctx, x, y, r, fill = '#ffffff') {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, 1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.45, fill);
  g.addColorStop(1, 'rgba(200,220,255,0.72)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawForegroundDecorations(ctx, slots, width, height, footerHeight, outputRatio) {
  const frame = state.selectedFrame;
  const isWide = outputRatio !== 'strip';
  const footerTop = height - footerHeight;
  const placeTag = (slot, corner, fn) => {
    const map = {
      tl: [slot.x + 24, slot.y + 26],
      tr: [slot.x + slot.width - 24, slot.y + 26],
      bl: [slot.x + 24, slot.y + slot.height - 24],
      br: [slot.x + slot.width - 24, slot.y + slot.height - 24]
    };
    const [x, y] = map[corner];
    fn(x, y);
  };
  const chromeRing = (x, y, r) => {
    const rg = ctx.createRadialGradient(x - r * 0.18, y - r * 0.18, 2, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.98)');
    rg.addColorStop(0.24, 'rgba(240,243,247,0.95)');
    rg.addColorStop(0.52, 'rgba(173,182,197,0.88)');
    rg.addColorStop(0.78, 'rgba(255,255,255,0.95)');
    rg.addColorStop(1, 'rgba(128,137,152,0.62)');
    ctx.save();
    ctx.strokeStyle = rg;
    ctx.lineWidth = Math.max(8, r * 0.32);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  if (frame === 'white' || frame === 'black') {
    // Solid classic frames intentionally use no additional decorations.
  } else if (frame === 'pink') {
    slots.forEach((slot, idx) => {
      placeTag(slot, idx % 2 ? 'tr' : 'tl', (x, y) => drawStickerHeart(ctx, x, y, isWide ? 18 : 15, idx % 2 ? '#d9cfff' : '#ffb4de', '#ffffff', idx % 2 ? 0.18 : -0.18));
      placeTag(slot, idx % 2 ? 'bl' : 'br', (x, y) => drawBead(ctx, x, y, isWide ? 10 : 8, idx % 2 ? '#9fdcff' : '#ffd86f'));
    });
    drawStickerHeart(ctx, width * 0.5, footerTop + 80, isWide ? 42 : 36, '#ff8fc8');
    drawStickerHeart(ctx, width * 0.14, 84, isWide ? 22 : 18, '#ffb6de');
    drawStickerHeart(ctx, width * 0.86, 94, isWide ? 22 : 18, '#d7ceff', '#ffffff', 0.24);
    drawBead(ctx, width * 0.18, footerTop + 48, isWide ? 14 : 12, '#9fdcff');
    drawBead(ctx, width * 0.82, footerTop + 48, isWide ? 14 : 12, '#ffd86f');
  } else if (frame === 'blue') {
    slots.forEach((slot, idx) => {
      placeTag(slot, idx % 2 ? 'tr' : 'tl', (x, y) => drawBead(ctx, x, y, isWide ? 12 : 10, '#dff5ff'));
      placeTag(slot, idx % 2 ? 'bl' : 'br', (x, y) => drawSparkle(ctx, x, y, 7, 'rgba(255,255,255,0.96)'));
    });
    drawStickerHeart(ctx, width * 0.5, footerTop + 80, isWide ? 36 : 32, '#73bfff');
    drawBead(ctx, width * 0.12, 86, isWide ? 16 : 13, '#9edcff');
    drawBead(ctx, width * 0.88, 86, isWide ? 16 : 13, '#9edcff');
    drawBead(ctx, width * 0.16, footerTop + 48, isWide ? 14 : 12, '#fff1a7');
    drawBead(ctx, width * 0.84, footerTop + 48, isWide ? 14 : 12, '#fff1a7');
  } else if (frame === 'chrome') {
    slots.forEach((slot, idx) => {
      chromeRing(idx % 2 ? slot.x + slot.width + 12 : slot.x - 12, slot.y + 34, isWide ? 20 : 18);
      drawSparkle(ctx, slot.x + slot.width * 0.5, slot.y + slot.height - 18, 7, 'rgba(255,255,255,0.94)');
    });
    chromeRing(width * 0.5, footerTop + 76, isWide ? 30 : 26);
    drawSparkle(ctx, width * 0.22, footerTop + 48, 9, 'rgba(255,255,255,0.96)');
    drawSparkle(ctx, width * 0.78, footerTop + 48, 9, 'rgba(255,255,255,0.96)');
  } else if (frame === 'dots') {
    slots.forEach((slot, idx) => {
      drawBead(ctx, slot.x + 22, slot.y + 22, isWide ? 12 : 10, idx % 2 ? '#9fdcff' : '#ffb7dc');
      drawBead(ctx, slot.x + slot.width - 20, slot.y + slot.height - 20, isWide ? 11 : 9, idx % 2 ? '#ffe17a' : '#b3f1a7');
    });
    drawStickerHeart(ctx, width * 0.5, footerTop + 80, isWide ? 28 : 24, '#ffa8d7');
  } else if (frame === 'bubble') {
    slots.forEach((slot, idx) => {
      drawBead(ctx, idx % 2 ? slot.x + slot.width - 24 : slot.x + 24, slot.y + 26, isWide ? 20 : 16, 'rgba(255,255,255,0.45)');
      drawBead(ctx, idx % 2 ? slot.x + 18 : slot.x + slot.width - 18, slot.y + slot.height - 22, isWide ? 13 : 11, 'rgba(255,255,255,0.3)');
      drawSparkle(ctx, slot.x + slot.width * 0.5, slot.y + 18, 6, 'rgba(255,255,255,0.9)');
    });
    drawBead(ctx, width * 0.5, footerTop + 78, isWide ? 24 : 20, 'rgba(255,255,255,0.4)');
    drawSparkle(ctx, width * 0.5 + 8, footerTop + 68, 8, 'rgba(255,255,255,0.95)');
  } else if (frame === 'checker') {
    slots.forEach((slot, idx) => {
      placeTag(slot, idx % 2 ? 'tr' : 'tl', (x, y) => drawStickerHeart(ctx, x, y, isWide ? 14 : 12, idx % 2 ? '#8fd8ff' : '#ff8cc8', '#ffffff', idx % 2 ? 0.18 : -0.18));
      placeTag(slot, idx % 2 ? 'bl' : 'br', (x, y) => drawStickerClover(ctx, x, y, isWide ? 11 : 9, idx % 2 ? -0.18 : 0.18));
    });
    drawStickerHeart(ctx, width * 0.5, footerTop + 80, isWide ? 32 : 28, '#ffd977');
  } else if (frame === 'confetti') {
    const accents = ['#ff8fc9', '#8fd8ff', '#ffd96a', '#a9ef9c', '#c9c2ff'];
    slots.forEach((slot, idx) => {
      placeTag(slot, 'tl', (x, y) => drawStickerHeart(ctx, x, y, isWide ? 12 : 10, accents[idx % accents.length], '#ffffff', -0.12));
      placeTag(slot, 'tr', (x, y) => drawBead(ctx, x, y, isWide ? 10 : 8, accents[(idx + 2) % accents.length]));
    });
    for (let i = 0; i < 12; i++) {
      const x = 46 + i * (width - 92) / 11;
      const y = i % 2 ? footerTop + 48 : 88;
      if (i % 3 === 0) drawStickerHeart(ctx, x, y, isWide ? 13 : 11, accents[i % accents.length]);
      else if (i % 3 === 1) drawBead(ctx, x, y, isWide ? 11 : 9, accents[i % accents.length]);
      else drawSparkle(ctx, x, y, 7, 'rgba(255,255,255,0.95)');
    }
  } else if (frame === 'faith') {
    const cross = (x, y, s = 1) => {
      ctx.save();
      ctx.shadowColor = 'rgba(171,184,255,0.34)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(166,190,255,0.96)';
      roundRect(ctx, x - 6 * s, y - 24 * s, 12 * s, 48 * s, 6 * s, true, false);
      roundRect(ctx, x - 20 * s, y - 6 * s, 40 * s, 12 * s, 6 * s, true, false);
      ctx.restore();
    };
    cross(width * 0.1, 94, isWide ? 1 : 0.9);
    cross(width * 0.9, 94, isWide ? 1 : 0.9);
    cross(width * 0.1, footerTop + 54, isWide ? 1 : 0.9);
    cross(width * 0.9, footerTop + 54, isWide ? 1 : 0.9);
    slots.forEach((slot) => {
      drawSparkle(ctx, slot.x + slot.width * 0.5, slot.y + 16, 8, 'rgba(180,194,255,0.92)');
      drawSparkle(ctx, slot.x + 20, slot.y + slot.height - 20, 6, 'rgba(180,194,255,0.76)');
    });
    drawSparkle(ctx, width * 0.5, footerTop + 72, 14, 'rgba(180,194,255,0.95)');
  } else if (frame === 'clover') {
    slots.forEach((slot, idx) => {
      placeTag(slot, idx % 2 ? 'tr' : 'tl', (x, y) => drawStickerClover(ctx, x, y, isWide ? 14 : 12, idx % 2 ? 0.18 : -0.18));
      placeTag(slot, idx % 2 ? 'bl' : 'br', (x, y) => drawBead(ctx, x, y, isWide ? 10 : 8, '#f3ffa9'));
    });
    drawStickerClover(ctx, width * 0.12, 86, isWide ? 18 : 15, -0.28);
    drawStickerClover(ctx, width * 0.88, 98, isWide ? 16 : 13, 0.22);
    drawStickerHeart(ctx, width * 0.5, footerTop + 80, isWide ? 24 : 20, '#76e08a');
  } else if (frame === 'heart') {
    slots.forEach((slot, idx) => {
      placeTag(slot, idx % 2 ? 'tr' : 'tl', (x, y) => drawStickerHeart(ctx, x, y, isWide ? 16 : 13, idx % 2 ? '#ffc7e7' : '#ffafd9', '#ffffff', idx % 2 ? 0.16 : -0.16));
      drawSparkle(ctx, slot.x + slot.width * 0.5, slot.y + 18, 7, 'rgba(255,255,255,0.92)');
    });
    drawStickerHeart(ctx, width * 0.12, 86, isWide ? 22 : 18, '#ff8fc8');
    drawStickerHeart(ctx, width * 0.88, 90, isWide ? 20 : 17, '#ffd86f');
    drawStickerHeart(ctx, width * 0.5, footerTop + 80, isWide ? 42 : 36, '#ff8fc8');
  }
}

function drawClover(ctx, x, y, size) {
  drawStickerClover(ctx, x, y, size);
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function getTitleFontFamily() {
  switch (state.titleFont) {
    case 'round': return '"KerisKedu", "Pretendard", sans-serif';
    case 'retro': return '"NeoDunggeunmo", monospace';
    case 'modern': return '"OiNaeng", "Pretendard", sans-serif';
    default: return '"Pretendard", sans-serif';
  }
}

function drawFrameOverlayText(ctx, width, height, footerHeight, outputRatio, skipQr = false) {
  ctx.save();
  const frame = state.selectedFrame;
  const lightFrames = ['white','dots','gradient','checker','confetti','faith','clover','heart','pink','blue','bubble','chrome'];
  const textColor = lightFrames.includes(frame) ? '#24313f' : '#ffffff';
  const isWide = outputRatio !== 'strip';
  const footerTop = height - footerHeight;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';

  if (state.frameText) {
    ctx.font = `600 ${isWide ? 30 : 24}px Pretendard, sans-serif`;
    ctx.fillText(state.frameText, width / 2, footerTop + (isWide ? 52 : 44));
  }

  ctx.font = `800 ${isWide ? 44 : 36}px ${getTitleFontFamily()}`;
  ctx.fillText(state.boothTitle, width / 2, footerTop + (isWide ? 104 : 94));

  if (state.showDate) {
    const today = new Date();
    const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    ctx.font = `500 ${isWide ? 22 : 18}px Pretendard, sans-serif`;
    ctx.globalAlpha = 0.72;
    ctx.fillText(formattedDate, width / 2, footerTop + footerHeight - (isWide ? 34 : 30));
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  if (!skipQr) generateQRLocalSimulation();
}

// --- LOCAL QR CODE SIMULATION ---
function generateQRLocalSimulation() {
  const qrCanvas = document.getElementById('qrCodeArea');
  const qctx = qrCanvas.getContext('2d');
  
  qctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
  
  const size = qrCanvas.width;
  qctx.fillStyle = '#2f3640';
  
  const drawFinder = (x, y) => {
    qctx.fillRect(x, y, 7 * 5, 7 * 5);
    qctx.fillStyle = '#ffffff';
    qctx.fillRect(x + 5, y + 5, 5 * 5, 5 * 5);
    qctx.fillStyle = '#2f3640';
    qctx.fillRect(x + 10, y + 10, 3 * 5, 3 * 5);
  };
  
  drawFinder(10, 10);
  drawFinder(size - 45, 10);
  drawFinder(10, size - 45);

  qctx.fillStyle = '#2f3640';
  for (let r = 0; r < size - 20; r += 6) {
    for (let c = 0; c < size - 20; c += 6) {
      if ((r < 45 && c < 45) || (r < 45 && c > size - 55) || (r > size - 55 && c < 45)) {
        continue;
      }
      if (Math.sin(r * c + 5) > -0.2) {
        qctx.fillRect(10 + r, 10 + c, 4, 4);
      }
    }
  }

  qctx.fillStyle = '#8c7ae6';
  qctx.beginPath();
  qctx.arc(size / 2, size / 2, 14, 0, 2 * Math.PI);
  qctx.fill();
  qctx.fillStyle = '#ffffff';
  qctx.font = '10px Pretendard';
  qctx.textAlign = 'center';
  qctx.textBaseline = 'middle';
  qctx.fillText('📸', size / 2, size / 2);

  if (state.qrTimerInterval) {
    clearInterval(state.qrTimerInterval);
  }

  let duration = 180;
  const updateTimer = () => {
    const min = String(Math.floor(duration / 60)).padStart(2, '0');
    const sec = String(duration % 60).padStart(2, '0');
    qrTimer.textContent = `${min}:${sec}`;
    if (duration <= 0) {
      clearInterval(state.qrTimerInterval);
      qrTimer.textContent = '만료됨';
    }
    duration--;
  };

  updateTimer();
  state.qrTimerInterval = setInterval(updateTimer, 1000);
}

// --- UTILITY DOWNLOADERS & SHARER ---
function downloadSynthesizedImage() {
  const link = document.createElement('a');
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  
  link.download = `snap4u-${state.boothTitle}-${dateStr}.png`;
  link.href = resultCanvas.toDataURL('image/png');
  link.click();
}

function loadVideoFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = async () => {
      try { await video.play().catch(() => {}); video.pause(); } catch (e) {}
      resolve({ video, url });
    };
    video.onerror = () => reject(new Error('video load failed'));
  });
}

async function generateFramedVideoBlob() {
  if (!state.recordedVideoBlob) return null;
  const layout = getCompositeLayout(state.capturedPhotos.length, state.outputRatio || 'strip');
  const { canvasWidth, canvasHeight, footerHeight, slots, outputRatio } = layout;
  const filterStr = getCanvasFilterString();
  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = canvasWidth;
  renderCanvas.height = canvasHeight;
  const ctx = renderCanvas.getContext('2d');
  const stream = renderCanvas.captureStream(30);

  let options = { mimeType: 'video/webm;codecs=vp9,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm;codecs=vp8,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
  const recorder = new MediaRecorder(stream, options);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  const base = await loadVideoFromBlob(state.recordedVideoBlob);
  const duration = base.video.duration || 1;
  const timeline = (state.recordingTimeline && state.recordingTimeline.length)
    ? state.recordingTimeline.slice(0, slots.length).map((seg, idx) => ({
        start: Math.max(0, Math.min(duration - 0.2, seg.start ?? idx * (duration / Math.max(1, slots.length)))),
        end: Math.max((seg.start ?? 0) + 1, Math.min(duration, seg.end ?? ((idx + 1) * duration / Math.max(1, slots.length))))
      }))
    : slots.map((_, idx) => ({ start: idx * (duration / Math.max(1, slots.length)), end: Math.min(duration, (idx + 1) * duration / Math.max(1, slots.length)) }));

  const players = [];
  players.push(base);
  for (let i = 1; i < slots.length; i++) players.push(await loadVideoFromBlob(state.recordedVideoBlob));

  await Promise.all(players.map(async ({ video }, i) => {
    const seg = timeline[i] || timeline[0];
    video.currentTime = Math.max(0, seg.start || 0);
    video.loop = false;
    video.muted = true;
    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= seg.end - 0.05) {
        video.currentTime = seg.start;
        video.play().catch(() => {});
      }
    });
    await video.play().catch(() => {});
  }));

  const renderDuration = Math.min(10, Math.max(3, ...timeline.map(seg => Math.max(1.2, seg.end - seg.start))));
  recorder.start();

  await new Promise((resolve) => {
    const startTs = performance.now();
    function renderFrame() {
      const elapsed = (performance.now() - startTs) / 1000;
      drawFramePattern(ctx, canvasWidth, canvasHeight, footerHeight, outputRatio);
      slots.forEach((slot, index) => {
        const { video } = players[index] || players[0];
        if (video && video.readyState >= 2) drawRoundedSlotImage(ctx, video, slot, filterStr);
      });
      drawForegroundDecorations(ctx, slots, canvasWidth, canvasHeight, footerHeight, outputRatio);
      drawFrameOverlayText(ctx, canvasWidth, canvasHeight, footerHeight, outputRatio, true);
      if (elapsed < renderDuration) requestAnimationFrame(renderFrame);
      else resolve();
    }
    renderFrame();
  });

  await Promise.all(players.map(({ video }) => video.pause()));
  const outputBlob = await new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: options.mimeType || 'video/webm' }));
    recorder.stop();
  });
  players.forEach(({ url }) => URL.revokeObjectURL(url));
  return outputBlob;
}

async function downloadRecordedVideo() {
  if (!state.recordedVideoBlob) return;
  const originalLabel = downloadVideoBtn.textContent;
  downloadVideoBtn.disabled = true;
  downloadVideoBtn.textContent = '⏳ 프레임 영상 생성 중...';

  try {
    const framedVideoBlob = await generateFramedVideoBlob();
    const finalBlob = framedVideoBlob || state.recordedVideoBlob;
    const url = URL.createObjectURL(finalBlob);
    const link = document.createElement('a');
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    link.download = `snap4u-framed-video-${dateStr}.webm`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch (error) {
    console.error('프레임 영상 생성 실패', error);
    const url = URL.createObjectURL(state.recordedVideoBlob);
    const link = document.createElement('a');
    link.download = 'snap4u-video.webm';
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } finally {
    downloadVideoBtn.textContent = originalLabel;
    downloadVideoBtn.disabled = !state.recordedVideoBlob;
  }
}

function shareOutcome() {
  if (navigator.share) {
    resultCanvas.toBlob((blob) => {
      const file = new File([blob], 'snap4u-photo.png', { type: 'image/png' });
      navigator.share({
        title: 'Snap4U AI 포토부스',
        text: `${state.boothTitle}에서 멋진 네컷사진을 찍었어요!`,
        files: [file]
      }).catch(() => {
        navigator.share({
          title: 'Snap4U AI 포토부스',
          url: window.location.href,
          text: `${state.boothTitle}에서 촬영한 사진을 확인해 보세요!`
        });
      });
    });
  } else {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('공유용 복사 링크가 클립보드에 복사되었습니다!');
    }).catch(() => {
      alert('공유 기능을 지원하지 않는 브라우저입니다. 저장 버튼을 사용해 다운로드해주세요.');
    });
  }
}

function resetSession() {
  if (confirm('현재 결과물을 지우고 처음부터 다시 촬영하시겠습니까?')) {
    state.capturedPhotos = [];
    state.videoChunks = [];
    state.recordedVideoBlob = null;
    state.recordingTimeline = [];
    
    document.querySelector('[data-view="review"]').disabled = true;
    document.querySelector('[data-view="frame"]').disabled = true;
    downloadVideoBtn.disabled = true;
    if (state.qrTimerInterval) {
      clearInterval(state.qrTimerInterval);
    }
    
    updateView(state.mode);
    initiateCameraAuto();
  }
}
