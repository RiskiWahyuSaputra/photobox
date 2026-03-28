document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("video");
  const overlayCanvas = document.getElementById("overlay-canvas");
  const overlayCtx = overlayCanvas.getContext("2d");

  const captureBtn = document.getElementById("capture-btn");
  const retakeBtn = document.getElementById("retake-btn");
  const saveBtn = document.getElementById("save-btn");
  const countdownEl = document.getElementById("countdown");
  const flashEl = document.getElementById("flash");
  const stripPreview = document.getElementById("photo-strip");
  const filterSelect = document.getElementById("filter-select");
  const mergeCanvas = document.getElementById("merge-canvas");
  const mergeCtx = mergeCanvas.getContext("2d");

  const loadingOverlay = document.getElementById("loading-overlay");
  const errorOverlay = document.getElementById("error-overlay");

  let capturedPhotos = [];
  let currentFrame = "classic";
  let currentLayout = "1x1";
  let isCapturing = false;
  let stream = null;

  // Load Doves Image for Classic Frame
  const dovesImg = new Image();
  let dovesImgFailed = false;

  dovesImg.onload = () => {
    console.log("Doves image loaded successfully.");
    dovesImgFailed = false;
  };

  dovesImg.onerror = () => {
    console.warn("Doves image failed to load. Using fallback background.");
    dovesImgFailed = true;
  };
  
  // No crossOrigin for same-domain files to prevent GitHub Pages issues
  dovesImg.src = "img/doves.jpg"; 


  // --- 1. Camera Initialization ---
  async function initCamera() {
    loadingOverlay.style.display = "flex";
    errorOverlay.style.display = "none";

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      video.srcObject = stream;

      video.onloadedmetadata = () => {
        loadingOverlay.style.display = "none";
        startPreviewLoop();
      };
    } catch (err) {
      console.error("Camera error:", err);
      loadingOverlay.style.display = "none";
      errorOverlay.style.display = "flex";
    }
  }

  // --- 2. Real-time Preview Loop ---
  function startPreviewLoop() {
    function loop() {
      if (video.paused || video.ended) return;

      // Match canvas size to display size
      const rect = overlayCanvas.getBoundingClientRect();
      if (
        overlayCanvas.width !== rect.width ||
        overlayCanvas.height !== rect.height
      ) {
        overlayCanvas.width = rect.width;
        overlayCanvas.height = rect.height;
      }

      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Draw Mirrored Video
      overlayCtx.save();
      overlayCtx.translate(overlayCanvas.width, 0);
      overlayCtx.scale(-1, 1);

      // Apply Filter
      overlayCtx.filter =
        filterSelect.value === "none" ? "none" : filterSelect.value;

      // Calculate aspect-fill
      const videoRatio = video.videoWidth / video.videoHeight;
      const canvasRatio = overlayCanvas.width / overlayCanvas.height;
      let drawW, drawH, drawX, drawY;

      if (videoRatio > canvasRatio) {
        drawH = overlayCanvas.height;
        drawW = drawH * videoRatio;
        drawX = (overlayCanvas.width - drawW) / 2;
        drawY = 0;
      } else {
        drawW = overlayCanvas.width;
        drawH = drawW / videoRatio;
        drawX = 0;
        drawY = (overlayCanvas.height - drawH) / 2;
      }

      overlayCtx.drawImage(video, drawX, drawY, drawW, drawH);
      overlayCtx.restore();

      // Draw Frame Overlay
      drawFrame(
        overlayCtx,
        overlayCanvas.width,
        overlayCanvas.height,
        currentFrame,
      );

      requestAnimationFrame(loop);
    }
    loop();
  }

  // --- 3. Frame Drawing Logic (Canvas 2D) ---
  function drawFrame(ctx, w, h, frameId) {
    const p = 20; // base padding
    ctx.save();

    switch (frameId) {
      case "classic":
        // 1. Improved Background Drawing (Fit to screen without excessive zoom)
        if (dovesImg.complete && !dovesImgFailed && dovesImg.naturalWidth > 0) {
          const imgRatio = dovesImg.naturalWidth / dovesImg.naturalHeight;
          const canvasRatio = w / h;
          
          ctx.save();
          // Clear background with a soft gray first
          ctx.fillStyle = "#f8f8f8";
          ctx.fillRect(0, 0, w, h);
          
          if (imgRatio > canvasRatio) {
            // Screen is taller (Mobile/Portrait) -> Crop horizontal sides
            const sw = dovesImg.naturalHeight * canvasRatio;
            const sx = (dovesImg.naturalWidth - sw) / 2;
            ctx.drawImage(dovesImg, sx, 0, sw, dovesImg.naturalHeight, 0, 0, w, h);
          } else {
            // Screen is wider (Desktop/Landscape) -> Fit to width
            const vh = w / imgRatio;
            const vy = (h - vh) / 2;
            ctx.drawImage(dovesImg, 0, 0, dovesImg.naturalWidth, dovesImg.naturalHeight, 0, vy, w, vh);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = "#f0f0f0";
          ctx.fillRect(0, 0, w, h);
        }

        // 2. Responsive Camera Box (Dynamic scaling for mobile)
        const isMobile = w < 500;
        const boxScale = isMobile ? 0.45 : 0.27; // Larger relative box on mobile
        const boxW = w * boxScale;
        const boxH = boxW * (video.videoHeight / video.videoWidth || 0.75);
        
        // Dynamic horizontal shift
        const xOffset = isMobile ? (w * 0.1) : (w * 0.13);
        const boxX = (w - boxW) / 2 + xOffset;
        const boxY = (h - boxH) / 2;

        // 3. Draw Camera Feed
        ctx.save();
        ctx.translate(boxX + boxW, boxY);
        ctx.scale(-1, 1);
        ctx.filter = filterSelect.value === "none" ? "none" : filterSelect.value;
        ctx.drawImage(video, 0, 0, boxW, boxH);
        ctx.restore();

        // 4. Borders
        const borderSize = isMobile ? 4 : 6;
        ctx.lineWidth = borderSize;
        ctx.strokeStyle = "#000";
        ctx.strokeRect(boxX - borderSize / 2, boxY - borderSize / 2, boxW + borderSize, boxH + borderSize);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);

        // 5. Responsive Handwriting Text
        ctx.fillStyle = "#333";
        const titleSize = isMobile ? Math.floor(w * 0.055) : 32;
        const lyricSize = isMobile ? Math.floor(w * 0.04) : 35;
        
        ctx.font = `italic ${titleSize}px "VT323", monospace`;
        ctx.textAlign = "left";
        ctx.fillText("Cerita kita tak jauh berbeda", 20, isMobile ? 40 : 50);

        ctx.textAlign = "right";
        ctx.font = `italic ${lyricSize}px "VT323", monospace`;
        ctx.fillText("Got beat down by the world", w - 20, h - (isMobile ? 55 : 65));
        ctx.fillText("sometimes i wanna fold", w - 20, h - (isMobile ? 25 : 30));
        break;

      case "neon":
        ctx.lineWidth = p;
        ctx.strokeStyle = "#0d1b4b";
        ctx.strokeRect(p / 2, p / 2, w - p, h - p);

        ctx.lineWidth = 4;
        ctx.strokeStyle = "#00bfff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00bfff";
        ctx.strokeRect(p + 2, p + 2, w - p * 2 - 4, h - p * 2 - 4);
        break;

      case "cat":
        const time = Date.now() * 0.005;
        const wiggle = Math.sin(time) * 5;

        ctx.lineWidth = p;
        ctx.strokeStyle = "#ffb6c1"; // Pastel Pink Frame
        ctx.strokeRect(p / 2, p / 2, w - p, h - p);

        // --- Animated Tail (Right Side) ---
        ctx.save();
        ctx.translate(w - 10, h - 60);
        ctx.rotate(Math.sin(time * 0.7) * 0.4);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, -10, 30, 15); // Tail base
        ctx.fillRect(25, -20, 15, 15); // Tail tip
        ctx.restore();

        // --- Ears (Top) ---
        const drawEar = (ex, ey, isRight = false) => {
          ctx.save();
          ctx.translate(ex, ey);
          if (isRight) ctx.scale(-1, 1);
          ctx.rotate(wiggle * 0.02);

          // Outer Ear (Black)
          ctx.fillStyle = "#000";
          ctx.fillRect(-20, -25, 40, 30);
          ctx.fillRect(-15, -35, 30, 10);
          ctx.fillRect(-5, -45, 10, 10);

          // Inner Ear (Pink)
          ctx.fillStyle = "#ffb6c1";
          ctx.fillRect(-10, -20, 20, 15);
          ctx.fillRect(-5, -25, 10, 5);
          ctx.restore();
        };
        drawEar(p + 25, 15);
        drawEar(w - p - 25, 15, true);

        // --- Peeking Cat Face (Bottom Center) ---
        const faceX = w / 2;
        const faceY = h - 5 + Math.sin(time * 0.5) * 3;

        // Head
        ctx.fillStyle = "#000";
        ctx.fillRect(faceX - 50, faceY - 35, 100, 40); // Main head
        ctx.fillRect(faceX - 40, faceY - 45, 80, 10); // Top of head

        // Eyes (Blinking)
        const isBlink = Math.sin(time * 0.8) > 0.96;
        if (isBlink) {
          ctx.fillStyle = "#333";
          ctx.fillRect(faceX - 30, faceY - 25, 20, 4);
          ctx.fillRect(faceX + 10, faceY - 25, 20, 4);
        } else {
          // White of eyes
          ctx.fillStyle = "#fff";
          ctx.fillRect(faceX - 30, faceY - 30, 20, 15);
          ctx.fillRect(faceX + 10, faceY - 30, 20, 15);
          // Pupils
          ctx.fillStyle = "#000";
          ctx.fillRect(faceX - 22, faceY - 26, 6, 8);
          ctx.fillRect(faceX + 16, faceY - 26, 6, 8);
        }

        // Nose & Mouth
        ctx.fillStyle = "#ffb6c1";
        ctx.fillRect(faceX - 4, faceY - 12, 8, 6); // Nose

        // Whiskers (White)
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        // Left whiskers
        ctx.beginPath();
        ctx.moveTo(faceX - 45, faceY - 15);
        ctx.lineTo(faceX - 75, faceY - 20);
        ctx.moveTo(faceX - 45, faceY - 10);
        ctx.lineTo(faceX - 75, faceY - 10);
        ctx.stroke();
        // Right whiskers
        ctx.beginPath();
        ctx.moveTo(faceX + 45, faceY - 15);
        ctx.lineTo(faceX + 75, faceY - 20);
        ctx.moveTo(faceX + 45, faceY - 10);
        ctx.lineTo(faceX + 75, faceY - 10);
        ctx.stroke();

        // --- Paws (Holding the edge) ---
        const drawHoldingPaw = (px, py, offset) => {
          const pyAnim = py + Math.sin(time + offset) * 2;
          ctx.fillStyle = "#000"; // Black paw
          ctx.fillRect(px, pyAnim - 10, 25, 15); // Paw base
          ctx.fillStyle = "#fff"; // White toes
          ctx.fillRect(px + 2, pyAnim - 12, 6, 6);
          ctx.fillRect(px + 10, pyAnim - 14, 6, 6);
          ctx.fillRect(px + 18, pyAnim - 12, 6, 6);
        };
        drawHoldingPaw(faceX - 85, h - 15, 0);
        drawHoldingPaw(faceX + 60, h - 15, Math.PI);
        break;

      case "star":
        ctx.fillStyle = "#0a3d8f";
        ctx.fillRect(0, 0, w, p * 1.5);
        ctx.fillRect(0, h - p * 1.5, w, p * 1.5);
        ctx.fillRect(0, 0, p * 1.5, h);
        ctx.fillRect(w - p * 1.5, 0, p * 1.5, h);

        ctx.fillStyle = "#fff";
        const drawStar = (sx, sy) => {
          ctx.fillRect(sx, sy - 4, 2, 10);
          ctx.fillRect(sx - 4, sy, 10, 2);
        };
        drawStar(p, p);
        drawStar(w - p, p);
        drawStar(p, h - p);
        drawStar(w - p, h - p);
        drawStar(w / 2, p / 2);
        drawStar(w / 2, h - p / 2);
        break;

      case "gameboy":
        const bp = 40; // Bottom padding for buttons
        ctx.fillStyle = "#9ca09c"; // Classic GameBoy Gray
        // Borders
        ctx.fillRect(0, 0, w, p * 2); // Top
        ctx.fillRect(0, h - 80, w, 80); // Bottom
        ctx.fillRect(0, 0, p, h); // Left
        ctx.fillRect(w - p, 0, p, h);

        // Screen glass effect
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 4;
        ctx.strokeRect(p, p * 2, w - p * 2, h - p * 2 - 80);

        // D-Pad
        ctx.fillStyle = "#222";
        ctx.fillRect(40, h - 55, 30, 10);
        ctx.fillRect(50, h - 65, 10, 30);

        // A/B Buttons (Rounded pixel style)
        ctx.fillStyle = "#a01010";
        ctx.fillRect(w - 50, h - 50, 15, 15);
        ctx.fillRect(w - 80, h - 40, 15, 15);

        // Start/Select
        ctx.fillStyle = "#666";
        ctx.fillRect(w / 2 - 25, h - 25, 20, 6);
        ctx.fillRect(w / 2 + 5, h - 25, 20, 6);
        break;

      case "official":
        const mTime = Date.now() * 0.003;

        // Classic Mario Blue Background Border
        ctx.lineWidth = p;
        ctx.strokeStyle = "#5c94fc"; // Mario Sky Blue
        ctx.strokeRect(p / 2, p / 2, w - p, h - p);

        // --- Bottom Ground (Brick & Block) ---
        ctx.fillStyle = "#943210"; // Brick Brown
        ctx.fillRect(0, h - p * 2, w, p * 2);

        // Draw Bricks
        ctx.fillStyle = "#000";
        for (let bx = 0; bx < w; bx += 40) {
          ctx.fillRect(bx, h - p * 2, 2, p * 2); // Vertical lines
          ctx.fillRect(bx, h - p, 40, 2); // Horizontal lines
        }

        // --- Question Blocks (Corners) ---
        const drawQBlock = (qx, qy) => {
          ctx.fillStyle = "#f8b800"; // Orange/Yellow
          ctx.fillRect(qx, qy, 30, 30);
          ctx.fillStyle = "#000";
          ctx.fillRect(qx + 2, qy + 2, 26, 26);
          ctx.fillStyle = "#f8b800";
          ctx.fillRect(qx + 4, qy + 4, 22, 22);
          // The "?" mark
          ctx.fillStyle = "#000";
          ctx.fillRect(qx + 12, qy + 8, 8, 4);
          ctx.fillRect(qx + 16, qy + 12, 4, 8);
          ctx.fillRect(qx + 16, qy + 22, 4, 4);
        };
        drawQBlock(10, 10);
        drawQBlock(w - 40, 10);

        // --- Warp Pipe (Bottom Right) ---
        ctx.fillStyle = "#00a800"; // Pipe Green
        ctx.fillRect(w - 70, h - p * 2 - 40, 50, 40); // Pipe body
        ctx.fillStyle = "#000";
        ctx.strokeRect(w - 70, h - p * 2 - 40, 50, 40);
        ctx.fillStyle = "#74ee00"; // Pipe Highlight
        ctx.fillRect(w - 65, h - p * 2 - 40, 10, 40);

        // --- Floating Mushroom (Animated) ---
        const mushX = 80 + Math.sin(mTime) * 20;
        const mushY = h - p * 2 - 25;
        ctx.fillStyle = "#f83800"; // Mushroom Red
        ctx.fillRect(mushX, mushY, 24, 12); // Cap
        ctx.fillStyle = "#fff";
        ctx.fillRect(mushX + 4, mushY + 2, 6, 4); // Spots
        ctx.fillRect(mushX + 14, mushY + 2, 6, 4);
        ctx.fillStyle = "#f8b800"; // Face
        ctx.fillRect(mushX + 6, mushY + 12, 12, 8);
        ctx.fillStyle = "#000";
        ctx.fillRect(mushX + 9, mushY + 14, 2, 4); // Eyes
        ctx.fillRect(mushX + 13, mushY + 14, 2, 4);

        // --- Logo Text ---
        ctx.fillStyle = "#fff";
        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.textAlign = "center";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText("SUPER QBOX", w / 2, h - 10);
        ctx.shadowBlur = 0;
        break;
    }
    ctx.restore();
  }

  // --- 4. Capture Logic ---
  captureBtn.addEventListener("click", async () => {
    if (isCapturing) return;
    isCapturing = true;

    const numPhotos =
      currentLayout === "1x1" ? 1 : currentLayout === "2x1" ? 2 : 4;
    capturedPhotos = [];
    stripPreview.innerHTML = "";
    stripPreview.style.display = "block";

    for (let i = 0; i < numPhotos; i++) {
      await runCountdown();
      captureFrame();
      showFlash();
      await sleep(800);
    }

    isCapturing = false;
    // Visual feedback
    captureBtn.innerText = "DONE!";
    setTimeout(() => (captureBtn.innerText = "CAPTURE"), 2000);
  });

    function captureFrame() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 800;
        tempCanvas.height = 600;
        const tCtx = tempCanvas.getContext('2d');
        
        // Match the rendering logic of the preview
        if (currentFrame === 'classic') {
            // Doves frame handles its own camera drawing in drawFrame
            drawFrame(tCtx, tempCanvas.width, tempCanvas.height, currentFrame);
        } else {
            // Other frames: draw video first, then frame
            tCtx.save();
            tCtx.translate(tempCanvas.width, 0);
            tCtx.scale(-1, 1);
            tCtx.filter = filterSelect.value === 'none' ? 'none' : filterSelect.value;
            
            const vW = video.videoWidth || 640;
            const vH = video.videoHeight || 480;
            const videoRatio = vW / vH;
            const canvasRatio = tempCanvas.width / tempCanvas.height;
            let dW, dH, dX, dY;

            if (videoRatio > canvasRatio) {
                dH = tempCanvas.height; dW = dH * videoRatio;
                dX = (tempCanvas.width - dW) / 2; dY = 0;
            } else {
                dW = tempCanvas.width; dH = dW / videoRatio;
                dX = 0; dY = (tempCanvas.height - dH) / 2;
            }
            tCtx.drawImage(video, dX, dY, dW, dH);
            tCtx.restore();
            
            drawFrame(tCtx, tempCanvas.width, tempCanvas.height, currentFrame);
        }
        
        try {
            const dataUrl = tempCanvas.toDataURL('image/png');
            capturedPhotos.push(dataUrl);

            const img = document.createElement('img');
            img.src = dataUrl;
            img.className = 'strip-photo';
            stripPreview.appendChild(img);
        } catch (e) {
            console.error("Capture failed:", e);
            if (e.name === 'SecurityError') {
                alert("BROWSER SECURITY ERROR:\n\nCapture failed because you are using 'file://'.\n\nPlease open this app via XAMPP at:\nhttp://localhost/photobox/");
            } else {
                alert("Failed to capture photo. Please try again.");
            }
        }
    }

  // --- 5. Download & Merge ---
  saveBtn.addEventListener("click", () => {
    if (capturedPhotos.length === 0) return alert("Capture photos first!");

    const padding = 40;
    let w = 800,
      h = 600;

    if (currentLayout === "strip") {
      w = 450;
      h = 1600;
    } else if (currentLayout === "2x1") {
      w = 800;
      h = 1100;
    } else if (currentLayout === "2x2") {
      w = 1200;
      h = 1000;
    }

    mergeCanvas.width = w;
    mergeCanvas.height = h;

    // Background
    mergeCtx.fillStyle =
      currentFrame === "gameboy"
        ? "#8b8b8b"
        : currentFrame === "neon"
          ? "#0d1b4b"
          : "#000";
    mergeCtx.fillRect(0, 0, w, h);

    let loadedCount = 0;
    capturedPhotos.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const pos = getLayoutPos(i, w, h, padding, currentLayout);
        mergeCtx.drawImage(img, pos.x, pos.y, pos.w, pos.h);
        loadedCount++;
        if (loadedCount === capturedPhotos.length) finishDownload();
      };
      img.src = src;
    });
  });

  function getLayoutPos(i, tw, th, p, layout) {
    let x, y, w, h;
    const aw = tw - p * 2;
    const ah = th - p * 2;

    if (layout === "1x1") {
      x = p;
      y = p;
      w = aw;
      h = ah;
    } else if (layout === "strip") {
      w = aw;
      h = (ah - p * 3) / 4;
      x = p;
      y = p + i * (h + p);
    } else if (layout === "2x1") {
      w = aw;
      h = (ah - p) / 2;
      x = p;
      y = p + i * (h + p);
    } else if (layout === "2x2") {
      w = (aw - p) / 2;
      h = (ah - p) / 2;
      x = p + (i % 2) * (w + p);
      y = p + Math.floor(i / 2) * (h + p);
    }
    return { x, y, w, h };
  }

  function finishDownload() {
    mergeCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `POLINELA_BOX_${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  // --- Utilities ---
  function runCountdown() {
    return new Promise((resolve) => {
      let count = 3;
      countdownEl.style.display = "block";
      countdownEl.innerText = count;
      const timer = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(timer);
          countdownEl.style.display = "none";
          resolve();
        } else {
          countdownEl.innerText = count;
        }
      }, 800);
    });
  }

  function showFlash() {
    flashEl.style.display = "block";
    flashEl.style.opacity = "1";
    setTimeout(() => {
      flashEl.style.opacity = "0";
      setTimeout(() => (flashEl.style.display = "none"), 200);
    }, 50);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  retakeBtn.addEventListener("click", () => {
    capturedPhotos = [];
    stripPreview.innerHTML = "";
    stripPreview.style.display = "none";
  });

  // Event listeners for Frame/Layout
  document.querySelectorAll(".frame-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document
        .querySelectorAll(".frame-option")
        .forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      currentFrame = opt.dataset.frame;
    });
  });

  document.querySelectorAll(".layout-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document
        .querySelectorAll(".layout-option")
        .forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      currentLayout = opt.dataset.layout;
    });
  });

  initCamera();
});
