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

// --- DOM ELEMENTS ---
const startScreen = document.getElementById('startScreen');
const startPhotoModeBtn = document.getElementById('startPhotoMode');
const startVideoModeBtn = document.getElementById('startVideoMode');

const headerLogo = document.getElementById('headerLogo');
const stepIndicator = document.getElementById('stepIndicator');

const navTabs = document.querySelectorAll('.nav-tab');
const cameraSection = document.querySelector('.camera-section');
const frameSection = document.querySelector('.frame-section');
const retouchSection = document.querySelector('.retouch-section');
const resultSection = document.querySelector('.result-section');

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
  startVideoModeBtn.addEventListener('click', () => {
    state.mode = 'video';
    setCaptureModeUI('video');
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
      // Sync tab view switching
      if (view === 'photo' || view === 'video') {
        updateView('photo');
      } else {
        updateView(view);
      }
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

  videoDurationSelect.addEventListener('change', (e) => {
    state.videoDuration = parseInt(e.target.value);
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
}

function updateView(activeView) {
  navTabs.forEach(tab => {
    const viewName = tab.getAttribute('data-view');
    if (viewName === activeView || (activeView === 'photo' && viewName === 'photo') || (activeView === 'video' && viewName === 'photo')) {
      tab.classList.add('is-active');
    } else {
      tab.classList.remove('is-active');
    }
  });

  if (activeView === 'photo' || activeView === 'video') {
    cameraSection.style.display = 'block';
    frameSection.style.display = 'none';
    retouchSection.style.display = 'none';
    resultSection.style.display = 'none';
    stepIndicator.textContent = state.mode === 'photo' ? 'STEP 1. 사진 촬영' : 'STEP 1. 영상 녹화';
  } else if (activeView === 'frame') {
    cameraSection.style.display = 'none';
    frameSection.style.display = 'block';
    retouchSection.style.display = 'block';
    resultSection.style.display = 'none';
    stepIndicator.textContent = 'STEP 2. 프레임 및 보정 설정';
  } else if (activeView === 'result') {
    cameraSection.style.display = 'none';
    frameSection.style.display = 'none';
    retouchSection.style.display = 'none';
    resultSection.style.display = 'block';
    stepIndicator.textContent = 'STEP 3. 최종 결과물 소장';
  }
}

function setCaptureModeUI(mode) {
  captureModeRadios.forEach(radio => {
    radio.checked = radio.value === mode;
  });

  if (mode === 'photo') {
    shotCountGroup.style.display = 'flex';
    videoDurationGroup.style.display = 'none';
    captureBtn.innerHTML = '📸 촬영 시작';
  } else {
    shotCountGroup.style.display = 'none';
    videoDurationGroup.style.display = 'flex';
    captureBtn.innerHTML = '🎥 녹화 시작';
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
  
  document.querySelector('[data-view="result"]').disabled = false;
  
  // Instantly go to frame & preview settings
  updateView('frame');
  compositePhotosToCanvas();
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
    ctx.filter = getCanvasFilterString();
    ctx.drawImage(cameraPreview, 0, 0, w, h);
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
        
        document.querySelector('[data-view="result"]').disabled = false;
        updateView('result');
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
    ctx.font = 'bold 36px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📸 Re-shot Mock #${index + 1}`, w/2, h/2);
  } else {
    if (state.facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = getCanvasFilterString();
    ctx.drawImage(cameraPreview, 0, 0, w, h);
  }
  
  state.capturedPhotos[index].dataUrl = outCanvas.toDataURL('image/png');
  
  // Instantly return to result view
  updateView('result');
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
function compositePhotosToCanvas() {
  const photos = state.capturedPhotos;
  if (photos.length === 0) return;

  const ctx = resultCanvas.getContext('2d');
  const isPortrait = state.cameraRatio === 'portrait';

  // Layout calculations
  // Width of composite strip is fixed at 800px. Height scales based on number of photos.
  const stripWidth = 800;
  const padding = 45;
  const gap = 30;
  
  const imgWidth = stripWidth - padding * 2;
  const imgHeight = isPortrait ? Math.round(imgWidth * (4 / 3)) : Math.round(imgWidth * (3 / 4));
  
  const totalImages = photos.length;
  const footerHeight = 180;
  const stripHeight = padding * 2 + (imgHeight * totalImages) + (gap * Math.max(0, totalImages - 1)) + footerHeight;

  resultCanvas.width = stripWidth;
  resultCanvas.height = stripHeight;

  // Render Frame Background Design
  drawFramePattern(ctx, stripWidth, stripHeight);

  // Load and draw captured images sequentially
  let loadedCount = 0;
  photos.forEach((photo, index) => {
    const img = new Image();
    img.src = photo.dataUrl;
    img.onload = () => {
      const x = padding;
      const y = padding + index * (imgHeight + gap);

      ctx.save();
      // Rounded corner image box clip
      const r = 16;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + imgWidth - r, y);
      ctx.quadraticCurveTo(x + imgWidth, y, x + imgWidth, y + r);
      ctx.lineTo(x + imgWidth, y + imgHeight - r);
      ctx.quadraticCurveTo(x + imgWidth, y + imgHeight, x + imgWidth - r, y + imgHeight);
      ctx.lineTo(x + r, y + imgHeight);
      ctx.quadraticCurveTo(x, y + imgHeight, x, y + imgHeight - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, x, y, imgWidth, imgHeight);
      ctx.restore();

      loadedCount++;
      if (loadedCount === totalImages) {
        drawFrameOverlayText(ctx, stripWidth, stripHeight);
      }
    };
  });
}

// Draw patterns on frame backgrounds
function drawFramePattern(ctx, w, h) {
  const frame = state.selectedFrame;

  if (frame === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  } else if (frame === 'black') {
    ctx.fillStyle = '#151515';
    ctx.fillRect(0, 0, w, h);
  } else if (frame === 'pink') {
    ctx.fillStyle = '#ff8fb1';
    ctx.fillRect(0, 0, w, h);
  } else if (frame === 'blue') {
    ctx.fillStyle = '#8fd3ff';
    ctx.fillRect(0, 0, w, h);
  } else if (frame === 'dots') {
    ctx.fillStyle = '#faf8fc';
    ctx.fillRect(0, 0, w, h);
    // Draw dots pattern
    ctx.fillStyle = 'rgba(140, 122, 230, 0.2)';
    for (let x = 0; x < w; x += 18) {
      for (let y = 0; y < h; y += 18) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2*Math.PI);
        ctx.fill();
      }
    }
  } else if (frame === 'stars') {
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fbc531';
    // Draw tiny stars/crosses
    for (let i = 0; i < 60; i++) {
      const sx = (Math.sin(i * 123) * 0.5 + 0.5) * w;
      const sy = (Math.cos(i * 456) * 0.5 + 0.5) * h;
      ctx.fillRect(sx, sy, 3, 3);
    }
  }
}

// Render dynamic customized title, date stamps and subtext
function drawFrameOverlayText(ctx, width, height) {
  ctx.save();
  
  const frame = state.selectedFrame;
  const textColor = (frame === 'black' || frame === 'stars') ? '#ffffff' : '#2f3640';

  // Render Customizable Booth Brand Title (하단 OO네컷)
  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.boothTitle, width / 2, height - 90);

  // Render Subtitle Message (가운데)
  if (state.frameText) {
    ctx.font = '500 24px Pretendard, sans-serif';
    ctx.fillText(state.frameText, width / 2, height - 140);
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
    
    document.querySelector('[data-view="result"]').disabled = true;
    downloadVideoBtn.disabled = true;
    if (state.qrTimerInterval) {
      clearInterval(state.qrTimerInterval);
    }
    
    updateView(state.mode);
    initiateCameraAuto();
  }
}
