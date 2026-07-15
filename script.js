/**
 * Snap4U - Premium AI Photobooth client-side logic
 * Enhanced with bright theme support, orientation adjustments, natural soft filters, 
 * customizable title text, decorative frames, and mock camera fallbacks.
 */

// --- STATE MANAGEMENT ---
const state = {
  mode: 'photo', // 'photo' or 'video'
  cameraActive: false,
  stream: null,
  facingMode: 'user', // 'user' or 'environment'
  timer: 3,
  maxShots: 4,
  videoDuration: 5,
  capturedPhotos: [], // array of { id, dataUrl }
  selectedFrame: 'white',
  boothTitle: '목민네컷',
  frameText: '',
  showDate: true,
  outputRatio: 'strip',
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
    filter: 'normal'
  },
  videoChunks: [],
  mediaRecorder: null,
  recordedVideoBlob: null,
  qrTimerInterval: null,
  
  // Fallback simulator variables
  useMockCamera: false,
  mockAnimationId: null
};


const FRAME_TEMPLATES = {
  white: {
    name: '클래식 화이트',
    overlay: './assets/frames/white_overlay.webp',
    size: [941, 1672],
    slots: [[259, 115, 674, 419], [259, 453, 673, 760], [259, 791, 673, 1099], [259, 1132, 673, 1441]],
    landscape: ['#ffffff', '#eef1f5', '#d7dee8']
  },
  black: {
    name: '클래식 블랙',
    overlay: './assets/frames/black_overlay.webp',
    size: [941, 1672],
    slots: [[258, 116, 681, 426], [258, 459, 681, 770], [258, 802, 681, 1114], [258, 1146, 681, 1459]],
    landscape: ['#101116', '#252830', '#ffffff']
  },
  angel: {
    name: '엔젤 스카이',
    overlay: './assets/frames/angel_overlay.webp',
    size: [941, 1672],
    slots: [[192, 143, 748, 425], [190, 449, 821, 748], [159, 800, 749, 1082], [192, 1105, 749, 1382]],
    landscape: ['#dff3ff', '#91d3ff', '#ffffff']
  },
  phone: {
    name: '키치 폰 하트',
    overlay: './assets/frames/phone_overlay.webp',
    size: [941, 1672],
    slots: [[212, 211, 741, 496], [212, 520, 741, 807], [212, 830, 741, 1115], [213, 1139, 741, 1424]],
    landscape: ['#ffd1e5', '#ff79b8', '#ffffff']
  },
  doodle: {
    name: '해피 두들 파티',
    overlay: './assets/frames/doodle_overlay.webp',
    size: [941, 1672],
    slots: [[187, 236, 753, 512], [179, 539, 759, 812], [179, 840, 759, 1112], [179, 1141, 760, 1491]],
    landscape: ['#fff7df', '#ffd98d', '#8c5c2f']
  },
  scribble: {
    name: '스크리블 토크',
    overlay: './assets/frames/scribble_overlay.webp',
    size: [941, 1672],
    slots: [[265, 250, 685, 514], [265, 542, 685, 807], [265, 836, 686, 1102], [265, 1131, 685, 1496]],
    landscape: ['#f7f0df', '#dfd3bd', '#111111']
  },
  clover: {
    name: '럭키 클로버',
    overlay: './assets/frames/clover_overlay.webp',
    size: [941, 1672],
    slots: [[110, 258, 457, 843], [485, 258, 831, 843], [110, 871, 457, 1454], [485, 871, 831, 1454]],
    landscape: ['#efffea', '#bfe8c4', '#5ea56b']
  },
  pixel: {
    name: '픽셀 플레이',
    overlay: './assets/frames/pixel_overlay.webp',
    size: [941, 1672],
    slots: [[103, 336, 449, 844], [491, 336, 837, 844], [103, 885, 449, 1393], [491, 885, 837, 1393]],
    landscape: ['#d9f7f4', '#93d9e7', '#344a6a']
  },
  violet: {
    name: '바이올렛 클라우드',
    overlay: './assets/frames/violet_overlay.webp',
    size: [941, 1672],
    slots: [[94, 328, 455, 836], [486, 328, 848, 836], [22, 862, 455, 1388], [486, 862, 922, 1390]],
    landscape: ['#f2ddff', '#c7a7e6', '#ffffff']
  },
  chrome: {
    name: '크롬 엔젤',
    overlay: './assets/frames/chrome_overlay.webp',
    size: [941, 1672],
    slots: [[221, 185, 713, 476], [215, 499, 711, 789], [222, 811, 711, 1096], [215, 1121, 711, 1412]],
    landscape: ['#eef3fa', '#abb9d0', '#ffffff']
  }
};

const frameImageCache = new Map();
let compositeRenderToken = 0;

function loadFrameAsset(src) {
  if (frameImageCache.has(src)) return frameImageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`프레임 이미지를 불러오지 못했습니다: ${src}`));
    img.src = src;
  });
  frameImageCache.set(src, promise);
  return promise;
}

function loadPhotoAsset(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('촬영 이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

// --- DOM ELEMENTS ---
const startScreen = document.getElementById('startScreen');
const startPhotoModeBtn = document.getElementById('startPhotoMode');
const startVideoModeBtn = document.getElementById('startVideoMode');

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
const captureModeRadios = document.getElementsByName('captureMode');
const timerSelect = document.getElementById('timerSelect');
const shotCount = document.getElementById('shotCount');
const shotCountGroup = document.getElementById('shotCountGroup');
const videoDurationGroup = document.getElementById('videoDurationGroup');
const videoDurationSelect = document.getElementById('videoDurationSelect');

const startCameraBtn = document.getElementById('startCameraButton');
const switchCameraBtn = document.getElementById('switchCameraButton');
const captureBtn = document.getElementById('captureButton');

const frameCards = document.querySelectorAll('.frame-card');
const boothTitleInput = document.getElementById('boothTitleInput');
const frameText = document.getElementById('frameText');
const showDateCheckbox = document.getElementById('showDate');
const outputRatioRadios = document.getElementsByName('outputRatio');

const retouchToggle = document.getElementById('retouchToggle');
const brightnessRange = document.getElementById('brightnessRange');
const contrastRange = document.getElementById('contrastRange');
const saturationRange = document.getElementById('saturationRange');
const blurRange = document.getElementById('blurRange');

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
    setCaptureModeUI('photo');
    startScreen.classList.add('hidden');
    initiateCameraAuto();
  });
  if (startVideoModeBtn) {
    startVideoModeBtn.addEventListener('click', () => {
      state.mode = 'video';
      setCaptureModeUI('video');
      startScreen.classList.add('hidden');
      initiateCameraAuto();
    });
  }

  headerLogo.addEventListener('click', (e) => {
    e.preventDefault();
    startScreen.classList.remove('hidden');
    stopCamera();
  });

  // Nav menu tabs
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      // Sync tab view switching
      if (view === 'photo' || view === 'video') {
        state.mode = view;
        setCaptureModeUI(view);
      }
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

  // Settings Panel mode
  captureModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.mode = e.target.value;
      setCaptureModeUI(state.mode);
    });
  });

  timerSelect.addEventListener('change', (e) => {
    state.timer = parseInt(e.target.value);
  });

  shotCount.addEventListener('change', (e) => {
    state.maxShots = parseInt(e.target.value);
  });

  if (videoDurationSelect) {
    videoDurationSelect.addEventListener('change', (e) => {
      state.videoDuration = parseInt(e.target.value);
    });
  }

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
        compositePhotosToCanvas();
      }
    });
  });

  boothTitleInput.addEventListener('input', (e) => {
    state.boothTitle = e.target.value || '목민네컷';
    if (state.capturedPhotos.length > 0) {
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

  outputRatioRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.outputRatio = e.target.value;
      if (state.capturedPhotos.length > 0) {
        compositePhotosToCanvas();
      }
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
    const isCameraTab = (activeView === 'photo' || activeView === 'video') && viewName === activeView;
    tab.classList.toggle('is-active', viewName === activeView || isCameraTab);
  });

  cameraSection.style.display = 'none';
  reviewSection.style.display = 'none';
  frameSection.style.display = 'none';

  if (activeView === 'photo' || activeView === 'video') {
    cameraSection.style.display = 'block';
    stepIndicator.textContent = state.mode === 'photo' ? 'STEP 1. 사진 촬영' : 'STEP 1. 영상 녹화';
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

function setCaptureModeUI(mode) {
  captureModeRadios.forEach(radio => {
    radio.checked = radio.value === mode;
  });

  if (mode === 'photo') {
    if (shotCountGroup) shotCountGroup.style.display = 'flex';
    if (videoDurationGroup) videoDurationGroup.style.display = 'none';
    if (captureBtn) captureBtn.innerHTML = '📸 촬영 시작';
  } else {
    if (shotCountGroup) shotCountGroup.style.display = 'none';
    if (videoDurationGroup) videoDurationGroup.style.display = 'flex';
    if (captureBtn) captureBtn.innerHTML = '🎥 녹화 시작';
  }
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
      audio: state.mode === 'video'
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
  if (state.mode === 'photo') {
    startPhotoCaptureSequence();
  } else {
    startVideoRecording();
  }
}

async function startPhotoCaptureSequence() {
  if (state.isCapturingSequence) return;
  state.isCapturingSequence = true;
  state.capturedPhotos = [];
  state.currentShotIndex = 0;
  captureBtn.disabled = true;
  startCameraBtn.disabled = true;
  switchCameraBtn.disabled = true;

  for (let i = 0; i < state.maxShots; i++) {
    state.currentShotIndex = i;
    cameraStatus.textContent = `${i + 1}번째 컷 촬영 대기 중 (${i + 1}/${state.maxShots})`;
    
    await runCountdown(state.timer);
    
    triggerFlashEffect();
    captureSinglePhoto(i);
    
    await new Promise(r => setTimeout(r, 1200));
  }

  state.isCapturingSequence = false;
  captureBtn.disabled = false;
  startCameraBtn.disabled = false;
  switchCameraBtn.disabled = false;
  cameraStatus.textContent = '촬영이 완료되었습니다! 2단계로 진행해 주세요.';
  
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
    ctx.font = '700 40px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📸 Mock Capture #${index + 1}`, w/2, h - 100);
  } else {
    // Mirror standard camera stream
    if (state.facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = getCanvasFilterString();
    drawImageCover(ctx, cameraPreview, 0, 0, w, h);
  }

  const dataUrl = outCanvas.toDataURL('image/png');
  state.capturedPhotos.push({
    id: Date.now() + Math.random(),
    dataUrl: dataUrl
  });
}

// --- VIDEO RECORDING ENGINES ---
function startVideoRecording() {
  if (state.isRecording) return;
  state.isRecording = true;
  state.videoChunks = [];
  captureBtn.disabled = true;
  captureBtn.textContent = '🔴 준비 중';

  runCountdown(state.timer).then(() => {
    try {
      captureBtn.textContent = `🔴 녹화 중 (0/${state.videoDuration}s)`;
      
      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/mp4' };
      }

      state.mediaRecorder = new MediaRecorder(state.stream, options);
      state.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          state.videoChunks.push(e.data);
        }
      };

      state.mediaRecorder.onstop = () => {
        state.recordedVideoBlob = new Blob(state.videoChunks, { type: state.mediaRecorder.mimeType || 'video/webm' });
        downloadVideoBtn.disabled = false;
        cameraStatus.textContent = '영상 녹화가 완료되었습니다.';
        
        document.querySelector('[data-view="frame"]').disabled = false;
        updateView('frame');
      };

      state.mediaRecorder.start();
      
      let elapsed = 0;
      const clock = setInterval(() => {
        elapsed++;
        captureBtn.textContent = `🔴 녹화 중 (${elapsed}/${state.videoDuration}s)`;
        if (elapsed >= state.videoDuration) {
          clearInterval(clock);
          stopVideoRecording();
        }
      }, 1000);

    } catch (err) {
      alert(`🎥 녹화 시작 실패: ${err.message}`);
      state.isRecording = false;
      captureBtn.disabled = false;
      captureBtn.innerHTML = '🎥 녹화 시작';
    }
  });
}

function stopVideoRecording() {
  if (!state.isRecording) return;
  state.isRecording = false;
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  captureBtn.disabled = false;
  captureBtn.innerHTML = '🎥 녹화 시작';
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
      <img src="${photo.dataUrl}" alt="${index + 1}번째 촬영본">
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
    ctx.font = '700 40px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📸 Re-shot Mock #${index + 1}`, w/2, h/2);
  } else {
    if (state.facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = getCanvasFilterString();
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
async function compositePhotosToCanvas() {
  const photos = state.capturedPhotos;
  if (photos.length === 0) return;

  const token = ++compositeRenderToken;
  const ctx = resultCanvas.getContext('2d');
  const outputRatio = state.outputRatio || 'strip';
  const template = FRAME_TEMPLATES[state.selectedFrame] || FRAME_TEMPLATES.white;

  try {
    const loadedPhotos = await Promise.all(photos.slice(0, 4).map(photo => loadPhotoAsset(photo.dataUrl)));
    if (token !== compositeRenderToken) return;

    if (outputRatio === 'strip') {
      await renderGeneratedFrameStrip(ctx, template, loadedPhotos, token);
    } else {
      renderGeneratedFrameLandscape(ctx, template, loadedPhotos);
    }

    generateQRLocalSimulation();
  } catch (error) {
    console.error(error);
  }
}

async function renderGeneratedFrameStrip(ctx, template, photos, token) {
  const [canvasWidth, canvasHeight] = template.size;
  resultCanvas.width = canvasWidth;
  resultCanvas.height = canvasHeight;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  template.slots.forEach((rect, index) => {
    const [x0, y0, x1, y1] = rect;
    const width = x1 - x0;
    const height = y1 - y0;
    const photo = photos[index];
    if (!photo) return;

    const bleed = Math.max(6, Math.round(Math.min(width, height) * 0.02));
    drawImageCover(ctx, photo, x0 - bleed, y0 - bleed, width + bleed * 2, height + bleed * 2);
  });

  const overlay = await loadFrameAsset(template.overlay);
  if (token !== compositeRenderToken) return;
  ctx.drawImage(overlay, 0, 0, canvasWidth, canvasHeight);
  drawGeneratedFrameFooter(ctx, template, canvasWidth, canvasHeight, true);
}

function fitAspectInsideRect(x, y, width, height, aspect) {
  let fittedWidth = width;
  let fittedHeight = fittedWidth / aspect;
  if (fittedHeight > height) {
    fittedHeight = height;
    fittedWidth = fittedHeight * aspect;
  }
  return {
    x: x + (width - fittedWidth) / 2,
    y: y + (height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight
  };
}

function getCompositeLayout(photoCount, outputRatio = 'landscape34') {
  const count = Math.max(1, Math.min(4, photoCount));
  const canvasWidth = 1200;
  const canvasHeight = 900;
  const footerHeight = 150;
  const headerHeight = 110;
  const marginX = 76;
  const gap = 30;
  const contentTop = headerHeight;
  const contentBottom = canvasHeight - footerHeight;
  const availableWidth = canvasWidth - marginX * 2;
  const availableHeight = contentBottom - contentTop;
  const photoAspect = state.cameraRatio === 'landscape' ? (4 / 3) : (3 / 4);
  const slots = [];

  const fit = (maxWidth, maxHeight) => fitAspectInsideRect(0, 0, maxWidth, maxHeight, photoAspect);

  if (count === 1) {
    const s = fit(availableWidth * 0.54, availableHeight * 0.70);
    slots.push({ x: (canvasWidth - s.width) / 2, y: contentTop + (availableHeight - s.height) / 2, width: s.width, height: s.height });
  } else if (count === 2) {
    const s = fit((availableWidth - gap) / 2, availableHeight * 0.72);
    const totalWidth = s.width * 2 + gap;
    const x0 = (canvasWidth - totalWidth) / 2;
    const y = contentTop + (availableHeight - s.height) / 2;
    slots.push({ x: x0, y, width: s.width, height: s.height });
    slots.push({ x: x0 + s.width + gap, y, width: s.width, height: s.height });
  } else if (count === 3) {
    const large = fit(availableWidth * 0.43, availableHeight * 0.72);
    const small = fit((availableWidth - large.width - gap), (availableHeight - gap) / 2);
    const groupWidth = large.width + gap + small.width;
    const groupHeight = Math.max(large.height, small.height * 2 + gap);
    const x0 = (canvasWidth - groupWidth) / 2;
    const y0 = contentTop + (availableHeight - groupHeight) / 2;
    slots.push({ x: x0, y: y0 + (groupHeight - large.height) / 2, width: large.width, height: large.height });
    slots.push({ x: x0 + large.width + gap, y: y0, width: small.width, height: small.height });
    slots.push({ x: x0 + large.width + gap, y: y0 + small.height + gap, width: small.width, height: small.height });
  } else {
    const s = fit((availableWidth - gap) / 2, (availableHeight - gap) / 2);
    const gridWidth = s.width * 2 + gap;
    const gridHeight = s.height * 2 + gap;
    const x0 = (canvasWidth - gridWidth) / 2;
    const y0 = contentTop + (availableHeight - gridHeight) / 2;
    for (let i = 0; i < 4; i++) {
      slots.push({ x: x0 + (i % 2) * (s.width + gap), y: y0 + Math.floor(i / 2) * (s.height + gap), width: s.width, height: s.height });
    }
  }

  return { canvasWidth, canvasHeight, slots, footerHeight, headerHeight, outputRatio };
}

function renderGeneratedFrameLandscape(ctx, template, photos) {
  const layout = getCompositeLayout(photos.length, 'landscape34');
  const { canvasWidth, canvasHeight, slots } = layout;
  resultCanvas.width = canvasWidth;
  resultCanvas.height = canvasHeight;

  const theme = getGeneratedLandscapeTheme(state.selectedFrame);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const bg = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bg.addColorStop(0, theme.bgTop);
  bg.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  drawLandscapeOuterCard(ctx, canvasWidth, canvasHeight, theme);
  drawLandscapeBackgroundDecor(ctx, canvasWidth, canvasHeight, theme, slots.length);

  slots.forEach((slot, index) => {
    const photo = photos[index];
    drawLandscapePhotoMat(ctx, slot, theme);
    if (!photo) return;
    ctx.save();
    roundedRectPath(ctx, slot.x, slot.y, slot.width, slot.height, 28);
    ctx.clip();
    drawImageCover(ctx, photo, slot.x, slot.y, slot.width, slot.height);
    ctx.restore();
  });

  drawLandscapeHeroDecor(ctx, canvasWidth, canvasHeight, theme, slots.length);
  drawGeneratedFrameFooter(ctx, template, canvasWidth, canvasHeight, false);
}

function getGeneratedLandscapeTheme(frame) {
  const themes = {
    white: { bgTop: '#ffffff', bgBottom: '#edf1f6', accent: '#d8dee7', accentSoft: '#f7f9fc', text: '#2b3340', mood: 'minimal' },
    black: { bgTop: '#15171c', bgBottom: '#2d3138', accent: '#9da8b8', accentSoft: '#f4f7fb', text: '#ffffff', mood: 'minimal-dark' },
    angel: { bgTop: '#8dd2ff', bgBottom: '#cbeeff', accent: '#53b9ff', accentSoft: '#ffffff', text: '#ffffff', mood: 'angel' },
    phone: { bgTop: '#ffd0e9', bgBottom: '#ff8fc4', accent: '#ff4f9f', accentSoft: '#fff3fb', text: '#8f2b61', mood: 'phone' },
    doodle: { bgTop: '#fff4d4', bgBottom: '#ffd88e', accent: '#f4b446', accentSoft: '#fffdf6', text: '#6e4b1f', mood: 'party' },
    scribble: { bgTop: '#f4efe5', bgBottom: '#e2d7c5', accent: '#202020', accentSoft: '#fffdfa', text: '#1c1c1c', mood: 'scribble' },
    clover: { bgTop: '#ddffd8', bgBottom: '#b7e8bc', accent: '#59b36b', accentSoft: '#f6fff4', text: '#386941', mood: 'clover' },
    pixel: { bgTop: '#dffaf8', bgBottom: '#b0ddf6', accent: '#4d7bb8', accentSoft: '#f6fdfd', text: '#29445d', mood: 'pixel' },
    violet: { bgTop: '#e8ddff', bgBottom: '#caaee9', accent: '#a68ae3', accentSoft: '#faf7ff', text: '#6b4d9a', mood: 'dream' },
    chrome: { bgTop: '#f6f7fb', bgBottom: '#d6deea', accent: '#aab6c9', accentSoft: '#ffffff', text: '#3b4452', mood: 'chrome' }
  };
  return themes[frame] || themes.white;
}

function drawLandscapeOuterCard(ctx, w, h, theme) {
  ctx.save();
  ctx.shadowColor = 'rgba(77, 94, 120, 0.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  roundedRectPath(ctx, 26, 26, w - 52, h - 52, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.stroke();
  ctx.restore();
}

function drawLandscapePhotoMat(ctx, slot, theme) {
  const outerPad = 12;
  ctx.save();
  ctx.shadowColor = 'rgba(66, 86, 110, 0.12)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  roundedRectPath(ctx, slot.x - outerPad, slot.y - outerPad, slot.width + outerPad * 2, slot.height + outerPad * 2, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 6;
  const stroke = ctx.createLinearGradient(slot.x, slot.y, slot.x + slot.width, slot.y + slot.height);
  stroke.addColorStop(0, 'rgba(255,255,255,0.98)');
  stroke.addColorStop(1, theme.accent);
  roundedRectPath(ctx, slot.x, slot.y, slot.width, slot.height, 28);
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function drawLandscapeBackgroundDecor(ctx, w, h, theme, count) {
  ctx.save();
  for (let i = 0; i < 22 + count * 4; i++) {
    const x = 60 + ((i * 97) % (w - 120));
    const y = 52 + ((i * 131) % (h - 104));
    drawSparkle(ctx, x, y, 5 + (i % 4), 'rgba(255,255,255,0.92)');
  }
  if (theme.mood === 'angel' || theme.mood === 'dream') {
    drawSoftCloud(ctx, 92, h - 72, 1.35, 'rgba(255,255,255,0.95)');
    drawSoftCloud(ctx, w - 210, h - 82, 1.45, 'rgba(255,255,255,0.95)');
    drawSoftCloud(ctx, 130, 86, 0.88, 'rgba(255,255,255,0.72)');
    drawSoftCloud(ctx, w - 180, 92, 0.92, 'rgba(255,255,255,0.72)');
  }
  if (theme.mood === 'phone') {
    drawGlossyHeart(ctx, 84, 106, 24, '#ff8ec4', '#ff5ba5');
    drawGlossyHeart(ctx, w - 92, 118, 22, '#fff0a7', '#ff71b0');
    drawGlossyStar(ctx, w - 92, h - 118, 24, '#8edbff', '#ff84bc');
  }
  if (theme.mood === 'clover') {
    drawClover(ctx, 100, 98, 0.78, '#7bdf8d', '#52aa61');
    drawClover(ctx, w - 96, h - 112, 0.84, '#7bdf8d', '#52aa61');
  }
  if (theme.mood === 'chrome') {
    drawGlossyStar(ctx, 96, 102, 24, '#ffffff', '#aab6c9');
    drawGlossyStar(ctx, w - 90, 108, 26, '#ffffff', '#aab6c9');
  }
  ctx.restore();
}

function drawLandscapeHeroDecor(ctx, w, h, theme, count) {
  ctx.save();
  ctx.textAlign = 'center';
  if (theme.mood === 'angel') {
    drawWingPair(ctx, 118, 92, 0.82, 'rgba(255,255,255,0.92)');
    drawWingPair(ctx, w - 118, 92, 0.82, 'rgba(255,255,255,0.92)');
    drawGlossyHeart(ctx, w / 2, count === 4 ? h / 2 : h - 158, 24, '#7fcfff', '#42b5ff');
  } else if (theme.mood === 'phone') {
    drawGlossyHeart(ctx, w / 2, 74, 18, '#ff8ec4', '#ff5ca6');
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.fillRect(100, 56, w - 200, 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.90)';
    ctx.lineWidth = 4;
    roundedRectPath(ctx, 100, 56, w - 200, 22, 11);
    ctx.stroke();
  } else if (theme.mood === 'party') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 28px Pretendard, sans-serif';
    ctx.fillText('HAPPY DOODLE', w / 2, 72);
  } else if (theme.mood === 'scribble') {
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    roundedRectPath(ctx, 38, 38, w - 76, h - 76, 28);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (theme.mood === 'pixel') {
    ctx.fillStyle = '#34506f';
    ctx.font = '700 28px NeoDunggeunmo, monospace';
    ctx.fillText('PIXEL PLAY', 140, 68);
    ctx.fillText(`1UP 0${count}04`, w - 140, 68);
  } else if (theme.mood === 'dream') {
    drawGlossyStar(ctx, 102, 100, 22, '#ffffff', '#cab3f1');
    drawGlossyHeart(ctx, w - 98, h - 112, 20, '#f3c6ff', '#baa0e6');
  } else if (theme.mood === 'chrome') {
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(w / 2, 68, 22, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGeneratedFrameFooter(ctx, template, width, height, isStrip) {
  const title = (state.boothTitle || '').trim();
  const detail = (state.frameText || '').trim();
  const frame = state.selectedFrame;
  const dark = frame === 'black' || frame === 'scribble' || frame === 'pixel';
  const yBase = isStrip ? height - 30 : height - 28;

  if (!title && !detail && !state.showDate) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = dark ? '#ffffff' : '#293342';
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 10;

  if (title) {
    ctx.font = `700 ${isStrip ? 24 : 25}px Pretendard, sans-serif`;
    ctx.fillText(title, width / 2, yBase - (detail ? 22 : 0) - (state.showDate ? 20 : 0));
  }

  if (detail) {
    ctx.font = `500 ${isStrip ? 16 : 17}px Pretendard, sans-serif`;
    ctx.fillText(detail, width / 2, yBase - (state.showDate ? 18 : 0));
  }

  if (state.showDate) {
    const today = new Date();
    const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    ctx.font = `500 ${isStrip ? 14 : 15}px Pretendard, sans-serif`;
    ctx.globalAlpha = 0.78;
    ctx.fillText(formattedDate, width / 2, yBase);
  }
  ctx.restore();
}

// Draw patterns on frame backgrounds
function getFrameTheme(frame) {
  const themes = {
    white: { bg1: '#ffffff', bg2: '#f1f4f8', accent: '#d9e0ea', accent2: '#bfc9d6', text: '#28313d', decor: 'minimal' },
    black: { bg1: '#0f1115', bg2: '#2c3038', accent: '#b9c1ce', accent2: '#7a8596', text: '#ffffff', decor: 'black' },
    pink: { bg1: '#ffd8ea', bg2: '#ff8fc1', accent: '#ff4f9f', accent2: '#fff0a8', text: '#7a2851', decor: 'pink' },
    blue: { bg1: '#dff2ff', bg2: '#7ec8ff', accent: '#36a9ff', accent2: '#ffffff', text: '#205988', decor: 'blue' },
    chrome: { bg1: '#f7f8fb', bg2: '#cfd7e2', accent: '#8b97a8', accent2: '#ffffff', text: '#313a48', decor: 'chrome' },
    dots: { bg1: '#fff7ff', bg2: '#efdfff', accent: '#b17eff', accent2: '#ffe97a', text: '#5e4a84', decor: 'dots' },
    bubble: { bg1: '#eef9ff', bg2: '#c9e5ff', accent: '#80c8ff', accent2: '#ffffff', text: '#355c7d', decor: 'bubble' },
    checker: { bg1: '#fff8fb', bg2: '#ffd8e7', accent: '#ff8dbe', accent2: '#7ed6ff', text: '#6b4252', decor: 'checker' },
    confetti: { bg1: '#fff7f9', bg2: '#ffd9eb', accent: '#ff78ba', accent2: '#8bc8ff', text: '#6b4a68', decor: 'confetti' },
    faith: { bg1: '#ffffff', bg2: '#d9e9ff', accent: '#9dc0ff', accent2: '#fff5d6', text: '#4b678f', decor: 'faith' },
    clover: { bg1: '#f8fff4', bg2: '#d2f7d9', accent: '#64cd7c', accent2: '#ffffff', text: '#467651', decor: 'clover' },
    heart: { bg1: '#ffe6f1', bg2: '#ff9fca', accent: '#ff5aa6', accent2: '#ffffff', text: '#7e2d55', decor: 'heart' }
  };
  return themes[frame] || themes.blue;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawSparkle(ctx, x, y, size, color = 'rgba(255,255,255,0.95)') {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.22, -size * 0.22);
  ctx.lineTo(size, 0);
  ctx.lineTo(size * 0.22, size * 0.22);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.22, size * 0.22);
  ctx.lineTo(-size, 0);
  ctx.lineTo(-size * 0.22, -size * 0.22);
  ctx.closePath();
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 1.6;
  ctx.fill();
  ctx.restore();
}

function drawSoftCloud(ctx, x, y, scale = 1, tint = 'rgba(255,255,255,0.9)') {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = tint;
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 20 * scale;
  [[-44, 8, 34], [-12, -10, 38], [22, -2, 42], [58, 10, 32]].forEach(([cx, cy, r]) => {
    ctx.beginPath();
    ctx.arc(cx * scale, cy * scale, r * scale, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillRect(-48 * scale, 8 * scale, 112 * scale, 28 * scale);
  ctx.restore();
}

function drawGlossyHeart(ctx, x, y, size, color1, color2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  const g = ctx.createLinearGradient(-1, -1, 1, 1);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(0, 0.9);
  ctx.bezierCurveTo(1.2, 0.1, 1.2, -0.8, 0.35, -0.9);
  ctx.bezierCurveTo(0.05, -0.92, -0.15, -0.72, 0, -0.4);
  ctx.bezierCurveTo(-0.15, -0.72, -0.35, -0.92, -0.65, -0.9);
  ctx.bezierCurveTo(-1.5, -0.8, -1.2, 0.1, 0, 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-0.25, -0.45, 0.35, 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlossyStar(ctx, x, y, size, color1, color2) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  ctx.fillStyle = g;
  ctx.shadowColor = color1;
  ctx.shadowBlur = size;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? size : size * 0.45;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWingPair(ctx, x, y, scale, color = 'rgba(255,255,255,0.92)') {
  const wing = (dir) => {
    ctx.save();
    ctx.translate(x + dir * 58 * scale, y);
    ctx.scale(dir * scale, scale);
    const g = ctx.createLinearGradient(0, -20, 55, 40);
    g.addColorStop(0, 'rgba(255,255,255,0.96)');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,255,255,0.7)';
    ctx.shadowBlur = 18 * scale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(30, -34, 50, -18, 55, 10);
    ctx.bezierCurveTo(30, 20, 22, 28, 0, 24);
    ctx.bezierCurveTo(8, 12, 8, 4, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  wing(-1);
  wing(1);
}

function drawCrossGlow(ctx, x, y, scale, color = '#fff7d6') {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 24 * scale;
  const g = ctx.createLinearGradient(0, -40 * scale, 0, 40 * scale);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  roundedRectPath(ctx, -10 * scale, -40 * scale, 20 * scale, 80 * scale, 10 * scale);
  ctx.fill();
  roundedRectPath(ctx, -36 * scale, -10 * scale, 72 * scale, 20 * scale, 10 * scale);
  ctx.fill();
  ctx.restore();
}

function drawClover(ctx, x, y, scale, color1, color2) {
  ctx.save();
  ctx.translate(x, y);
  const petals = [[-18,-18],[18,-18],[-18,18],[18,18]];
  petals.forEach(([px, py]) => {
    const g = ctx.createRadialGradient(px, py - 8, 2, px, py, 26 * scale);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, color1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px * scale, py * scale, 22 * scale, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = color2;
  ctx.lineWidth = 8 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 16 * scale);
  ctx.quadraticCurveTo(8 * scale, 46 * scale, -8 * scale, 72 * scale);
  ctx.stroke();
  ctx.restore();
}

function drawPhotoMat(ctx, x, y, w, h, frame) {
  const theme = getFrameTheme(frame);
  ctx.save();
  ctx.shadowColor = 'rgba(30, 41, 59, 0.12)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  roundedRectPath(ctx, x, y, w, h, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const stroke = ctx.createLinearGradient(x, y, x + w, y + h);
  stroke.addColorStop(0, 'rgba(255,255,255,0.95)');
  stroke.addColorStop(1, theme.accent);
  ctx.lineWidth = 6;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function drawFramePattern(ctx, w, h) {
  const frame = state.selectedFrame;
  const theme = getFrameTheme(frame);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, theme.bg1);
  bg.addColorStop(1, theme.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // soft vignette / glow
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.2, 40, w * 0.5, h * 0.2, h * 0.95);
  glow.addColorStop(0, 'rgba(255,255,255,0.45)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // sparse large elements rather than tiny clustered ones
  if (frame === 'blue') {
    drawWingPair(ctx, w / 2, 92, 1);
    drawSoftCloud(ctx, 110, 118, 1.2);
    drawSoftCloud(ctx, w - 190, 128, 1.28);
    drawSoftCloud(ctx, 115, h - 100, 1.35, 'rgba(255,255,255,0.96)');
    drawSoftCloud(ctx, w - 180, h - 110, 1.45, 'rgba(255,255,255,0.96)');
    drawGlossyHeart(ctx, w / 2, h - 165, 20, '#6bc6ff', '#2aa5ff');
    [80, 180, 320, 470, 650, 740].forEach((sx, i) => drawSparkle(ctx, sx, 70 + (i % 2) * 50, 10 + (i % 3) * 3));
    [70, 720].forEach((sx) => drawSparkle(ctx, sx, h - 150, 14));
  } else if (frame === 'pink') {
    drawGlossyHeart(ctx, 120, 120, 24, '#ff8ec4', '#ff5ba5');
    drawGlossyHeart(ctx, w - 110, 126, 22, '#ffd46f', '#ff8ec4');
    drawGlossyHeart(ctx, 120, h - 130, 26, '#ff7fbc', '#ff4f9f');
    drawGlossyHeart(ctx, w - 110, h - 138, 22, '#fff4a0', '#ff6ca8');
    drawGlossyStar(ctx, 85, 240, 24, '#fff2a6', '#ff84bc');
    drawGlossyStar(ctx, w - 88, h - 250, 26, '#8ddaff', '#ff84bc');
    [w/2].forEach((sx) => drawSparkle(ctx, sx, 78, 16));
  } else if (frame === 'chrome') {
    drawGlossyStar(ctx, 100, 110, 28, '#ffffff', '#adb6c4');
    drawGlossyStar(ctx, w - 96, 110, 28, '#ffffff', '#adb6c4');
    drawGlossyStar(ctx, 100, h - 120, 22, '#ffffff', '#aab4c2');
    drawGlossyStar(ctx, w - 96, h - 120, 22, '#ffffff', '#aab4c2');
    ctx.strokeStyle = 'rgba(255,255,255,0.68)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(w / 2, 92, 34, Math.PI, 2 * Math.PI);
    ctx.stroke();
  } else if (frame === 'dots') {
    for (let i = 0; i < 26; i++) {
      const x = 50 + (i % 6) * 128;
      const y = 70 + Math.floor(i / 6) * 160;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(177,126,255,0.18)';
      ctx.beginPath(); ctx.arc(x, y, i % 2 ? 7 : 10, 0, Math.PI * 2); ctx.fill();
    }
    drawGlossyStar(ctx, w - 88, 115, 24, '#ffe97a', '#b17eff');
    drawGlossyStar(ctx, 96, h - 120, 24, '#ffe97a', '#b17eff');
  } else if (frame === 'bubble') {
    drawSoftCloud(ctx, 110, 130, 0.92, 'rgba(255,255,255,0.62)');
    [ [88, 90, 34], [700, 140, 52], [90, h - 150, 44], [680, h - 190, 30], [w / 2 + 180, h * 0.52, 26] ].forEach(([bx, by, r]) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.25, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
    });
  } else if (frame === 'checker') {
    ctx.globalAlpha = 0.22;
    for (let yy = 0; yy < h; yy += 64) {
      for (let xx = 0; xx < w; xx += 64) {
        if ((xx / 64 + yy / 64) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(xx, yy, 64, 64);
        }
      }
    }
    ctx.globalAlpha = 1;
    drawGlossyStar(ctx, 90, 100, 24, '#8dd6ff', '#ff8dbe');
    drawGlossyHeart(ctx, w - 110, h - 130, 20, '#ff8dbe', '#ff5fa2');
  } else if (frame === 'confetti') {
    const pieces = ['#ff78ba', '#8bc8ff', '#ffe97d', '#a98cff'];
    for (let i = 0; i < 28; i++) {
      ctx.save();
      const px = 60 + (Math.sin(i * 1.7) * 0.5 + 0.5) * (w - 120);
      const py = 70 + (Math.cos(i * 2.1) * 0.5 + 0.5) * (h - 180);
      ctx.translate(px, py);
      ctx.rotate(i * 0.44);
      ctx.fillStyle = pieces[i % pieces.length];
      roundedRectPath(ctx, -12, -8, 24, 16, 7);
      ctx.fill();
      ctx.restore();
    }
  } else if (frame === 'faith') {
    drawCrossGlow(ctx, 110, 122, 1.1, '#fff5d6');
    drawCrossGlow(ctx, w - 110, 122, 1.1, '#fff5d6');
    drawWingPair(ctx, w / 2, 102, 0.85, 'rgba(255,255,255,0.88)');
    drawSoftCloud(ctx, 115, h - 105, 1.15, 'rgba(255,255,255,0.92)');
    drawSoftCloud(ctx, w - 185, h - 112, 1.2, 'rgba(255,255,255,0.92)');
  } else if (frame === 'clover') {
    drawClover(ctx, 104, 114, 0.85, '#7de38c', '#4aa95b');
    drawClover(ctx, w - 110, 118, 0.82, '#7de38c', '#4aa95b');
    drawClover(ctx, 112, h - 136, 0.92, '#7de38c', '#4aa95b');
    drawClover(ctx, w - 102, h - 138, 0.8, '#7de38c', '#4aa95b');
  } else if (frame === 'heart') {
    drawGlossyHeart(ctx, 104, 110, 24, '#ff8fc1', '#ff4f9f');
    drawGlossyHeart(ctx, w - 104, 112, 24, '#ff8fc1', '#ff4f9f');
    drawGlossyHeart(ctx, 112, h - 138, 26, '#ff8fc1', '#ff4f9f');
    drawGlossyHeart(ctx, w - 106, h - 138, 22, '#fff2ac', '#ff6aa8');
  } else if (frame === 'black') {
    drawGlossyStar(ctx, 100, 100, 26, '#ffffff', '#9fa8b7');
    drawGlossyStar(ctx, w - 102, h - 130, 24, '#ffffff', '#9fa8b7');
    drawSparkle(ctx, w / 2, 70, 18, 'rgba(255,255,255,0.95)');
  }

  // universal sparkles
  [ [56, 56, 8], [w - 56, 62, 8], [60, h - 54, 8], [w - 62, h - 62, 8] ].forEach(([sx, sy, ss]) => drawSparkle(ctx, sx, sy, ss, 'rgba(255,255,255,0.88)'));
}

function drawForegroundDecorations(ctx, w, h) {
  const frame = state.selectedFrame;
  ctx.save();
  if (frame === 'pink' || frame === 'heart') {
    drawGlossyHeart(ctx, w / 2, h - 182, 22, '#ff8fc1', '#ff5ba5');
  } else if (frame === 'blue' || frame === 'faith') {
    drawSparkle(ctx, w / 2, h - 172, 14, 'rgba(255,255,255,0.95)');
  } else if (frame === 'chrome') {
    drawGlossyStar(ctx, w / 2, h - 182, 18, '#ffffff', '#adb6c4');
  } else if (frame === 'clover') {
    drawClover(ctx, w / 2, h - 176, 0.62, '#7de38c', '#4aa95b');
  }
  ctx.restore();
}

// Render dynamic customized title, date stamps and subtext
function drawFrameOverlayText(ctx, width, height) {
  ctx.save();
  
  const frame = state.selectedFrame;
  const theme = getFrameTheme(frame);
  const textColor = theme.text || '#2f3640';

  // Render Customizable Booth Brand Title (하단 OO네컷)
  ctx.fillStyle = textColor;
  ctx.font = '700 40px Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.boothTitle, width / 2, height - 96);

  // Render Subtitle Message (가운데)
  if (state.frameText) {
    ctx.font = '600 26px Pretendard, sans-serif';
    ctx.fillText(state.frameText, width / 2, height - 146);
  }

  // Render Date Timestamp (최하단)
  if (state.showDate) {
    const today = new Date();
    const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    ctx.font = '500 20px Pretendard, sans-serif';
    ctx.globalAlpha = 0.65;
    ctx.fillText(formattedDate, width / 2, height - 45);
  }

  ctx.restore();

  // Draw simulation QR Code
  generateQRLocalSimulation();
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

function downloadRecordedVideo() {
  if (!state.recordedVideoBlob) return;
  const url = URL.createObjectURL(state.recordedVideoBlob);
  const link = document.createElement('a');
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  
  link.download = `snap4u-video-${dateStr}.webm`;
  link.href = url;
  link.click();
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
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
