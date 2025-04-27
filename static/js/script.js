// DOM Elements
const video = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const topEmotion = document.getElementById('top-emotion');
const generateBtn = document.getElementById('generate-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const memeImage = document.getElementById('meme-image');
const memeResult = document.getElementById('meme-result');
const memeActions = document.getElementById('meme-actions');
const characterSelect = document.getElementById('character-select');
const loadingDiv = document.getElementById('loading');
const emotionsUsed = document.getElementById('emotions-used');
const toast = document.getElementById('toast');
const veggieOptions = document.querySelectorAll('.veggie-option');

// Social media buttons
const shareToTwitter = document.getElementById('share-twitter');
const downloadMeme = document.getElementById('download-meme');

// Current emotions state
let currentEmotions = {};
let generatedMemeUrl = '';
let uploadedImageUrl = ''; 
let selectedVeggie = 'carrot'; // Default veggie

// Show toast notification
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// Set up veggie options click handlers
veggieOptions.forEach(option => {
  option.addEventListener('click', () => {
    veggieOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedVeggie = option.dataset.value;
    characterSelect.value = selectedVeggie;
  });
});

// Load face detection models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/static/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/static/models')
]).then(startVideo)
  .catch(err => {
    console.error("Error loading face-api models:", err);
    topEmotion.innerText = "Error loading face detection models. Please check console.";
    showToast("Error loading face detection models", 5000);
  });

// Start webcam
function startVideo() {
  console.log("Starting video feed...");
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      console.log("Camera access granted");
      video.srcObject = stream;
    })
    .catch(err => {
      console.error("Camera error:", err);
      topEmotion.innerText = "Camera error: " + err.message;
      showToast("Camera access denied. Please allow camera access.", 5000);
    });
}

// Setup face detection when video starts playing
video.addEventListener('play', () => {
  console.log("Video is playing, setting up face detection");
  const canvas = faceapi.createCanvasFromMedia(video);
  videoContainer.appendChild(canvas);
  
  const displaySize = {
    width: video.videoWidth,
    height: video.videoHeight
  };
  
  faceapi.matchDimensions(canvas, displaySize);
  

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (resizedDetections.length > 0) {
      resizedDetections.forEach(detection => {
        const box = detection.detection.box;
        
        // Create fun detection frame instead of boring blue rectangle
        // Draw rainbow gradient border
        const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
        gradient.addColorStop(0, '#FF5757');   // Red
        gradient.addColorStop(0.2, '#FFD157'); // Yellow
        gradient.addColorStop(0.4, '#57FF8D'); // Green
        gradient.addColorStop(0.6, '#57D1FF'); // Light blue
        gradient.addColorStop(0.8, '#D157FF'); // Purple
        gradient.addColorStop(1, '#FF57AB');   // Pink
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        
        // Draw rounded rectangle with sparkles
        ctx.beginPath();
        const radius = 15;
        
        // Draw rounded corners
        ctx.moveTo(box.x + radius, box.y);
        ctx.lineTo(box.x + box.width - radius, box.y);
        ctx.quadraticCurveTo(box.x + box.width, box.y, box.x + box.width, box.y + radius);
        ctx.lineTo(box.x + box.width, box.y + box.height - radius);
        ctx.quadraticCurveTo(box.x + box.width, box.y + box.height, box.x + box.width - radius, box.y + box.height);
        ctx.lineTo(box.x + radius, box.y + box.height);
        ctx.quadraticCurveTo(box.x, box.y + box.height, box.x, box.y + box.height - radius);
        ctx.lineTo(box.x, box.y + radius);
        ctx.quadraticCurveTo(box.x, box.y, box.x + radius, box.y);
        ctx.closePath();
        ctx.stroke();
        
        // Add sparkles/stars at corners
        const drawStar = (x, y, size) => {
          ctx.fillStyle = '#FFFF00'; // Yellow stars
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const radius1 = size;
            const radius2 = size/2;
            const angle1 = (i * 2 * Math.PI / 5) - Math.PI/2;
            const angle2 = ((i * 2 + 1) * Math.PI / 5) - Math.PI/2;
            const xInner = x + radius2 * Math.cos(angle2);
            const yInner = y + radius2 * Math.sin(angle2);
            const xOuter = x + radius1 * Math.cos(angle1);
            const yOuter = y + radius1 * Math.sin(angle1);
            
            if (i === 0) {
              ctx.moveTo(xOuter, yOuter);
            } else {
              ctx.lineTo(xOuter, yOuter);
            }
            ctx.lineTo(xInner, yInner);
          }
          ctx.closePath();
          ctx.fill();
        };
        
        // Draw stars at corners
        drawStar(box.x, box.y, 10);
        drawStar(box.x + box.width, box.y, 10);
        drawStar(box.x, box.y + box.height, 10);
        drawStar(box.x + box.width, box.y + box.height, 10);
        

      });
      
      currentEmotions = resizedDetections[0].expressions;
      const top2 = Object.entries(currentEmotions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(e => e[0]);
      topEmotion.innerText = `Now you feel: ${top2.join(', ')}`;
    } else {
      topEmotion.innerText = "No face detected";
    }
  }, 500);
});

// 创建SVG备用图像函数
function createFallbackSVG(emotions, veggie) {
  // 为不同情绪选择不同的背景色
  const emotionColors = {
    'happy': '#FFD700',      // Gold
    'sad': '#6495ED',        // Cornflower Blue
    'angry': '#FF6347',      // Tomato
    'fearful': '#9370DB',    // Medium Purple
    'disgusted': '#32CD32',  // Lime Green
    'surprised': '#FF69B4',  // Hot Pink
    'neutral': '#B0C4DE',    // Light Steel Blue
  };
  
  // 获取背景颜色基于第一种情绪
  let bgColor = '#fd79a8'; // 默认粉色
  if (emotions && emotions.length > 0) {
    const firstEmotion = emotions[0][0].toLowerCase();
    if (emotionColors[firstEmotion]) {
      bgColor = emotionColors[firstEmotion];
    }
  }
  
  // 蔬菜表情符号
  const veggieEmojis = {
    'potato': '🥔',
    'carrot': '🥕',
    'broccoli': '🥦',
    'corn': '🌽',
    'tomato': '🍅',
    'eggplant': '🍆'
  };
  
  const veggieEmoji = veggieEmojis[veggie] || '🥕';
  
  // 情绪表情符号
  const emotionEmojis = {
    'happy': '😊',
    'sad': '😢',
    'angry': '😠',
    'fearful': '😨',
    'disgusted': '🤢',
    'surprised': '😲',
    'neutral': '😐'
  };
  
  let emotionText = "";
  for (const emotion of emotions) {
    const emotionName = emotion[0].toLowerCase();
    if (emotionEmojis[emotionName]) {
      emotionText += emotionEmojis[emotionName] + " " + emotion[0] + " ";
    }
  }
  
  // 随机有趣的短语
  const phrases = [
    "Feeling veggie vibes!",
    "Plants have feelings too!",
    "Veggie mood activated!",
    "Root for me!",
    "I'm rooting for you!",
    "Lettuce celebrate!",
    "Trying to stay cool as a cucumber!",
    "This is how I roll!"
  ];
  
  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
  
  // 创建SVG内容
  const svgContent = `
  <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
        <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.5" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    
    <!-- 背景 -->
    <rect width="100%" height="100%" fill="url(#grad)" rx="20" ry="20"/>
    
    <!-- 闪烁效果 -->
    ${Array.from({length: 50}, () => {
      return `<circle cx="${Math.random() * 472 + 20}" cy="${Math.random() * 472 + 20}" r="${Math.random() * 3 + 2}" fill="white" opacity="${Math.random() * 0.6 + 0.3}" />`;
    }).join('')}
    
    <!-- 蔬菜表情符号 -->
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="150" text-anchor="middle" dominant-baseline="middle" filter="url(#shadow)">
      ${veggieEmoji}
    </text>
    
    <!-- 情绪文字 -->
    <text x="50%" y="160" font-family="Arial, sans-serif" font-size="30" text-anchor="middle" fill="white" filter="url(#shadow)">
      ${emotionText}
    </text>
    
    <!-- 有趣的短语 -->
    <text x="50%" y="400" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="white" filter="url(#shadow)">
      ${randomPhrase}
    </text>
    
    <!-- 边框装饰 -->
    <rect x="10" y="10" width="492" height="492" rx="15" ry="15" fill="none" stroke="white" stroke-width="5" stroke-dasharray="15,10" opacity="0.6"/>
  </svg>
  `;
  
  // 将SVG转换为Blob并创建URL
  const svgBlob = new Blob([svgContent], {type: 'image/svg+xml'});
  return URL.createObjectURL(svgBlob);
}

// 更新生成meme函数，使用服务器端的 Sana Sprint 模型
async function generateMeme() {
  console.log("Generating meme");
  
  if (!currentEmotions || Object.keys(currentEmotions).length === 0) {
    showToast("No emotion detected. Please make sure your face is visible to the camera.");
    return;
  }
  
  uploadedImageUrl = '';
  generateBtn.style.display = 'none';
  loadingDiv.style.display = 'flex';
  memeResult.style.display = 'none';
  memeActions.style.display = 'none';
  
  // 添加动态加载消息
  const loadingMessages = [
    "Cooking up your veggie...",
    "Adding emotional sauce...",
    "Sprinkling some meme magic...",
    "Veggie transformation in progress...",
    "Asking the veggie gods for inspiration...",
    "Making your veggie super cool..."
  ];
  
  // 每2秒更改一次加载消息
  const loadingElement = loadingDiv.querySelector('p');
  let messageIndex = 0;
  loadingElement.textContent = "✨ " + loadingMessages[0] + " ✨";
  
  const messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    loadingElement.textContent = "✨ " + loadingMessages[messageIndex] + " ✨";
  }, 2000);
  
  // Get top 2 emotions
  const top2 = Object.entries(currentEmotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  const emotionWords = top2.map(e => e[0]).join(', ');
  
  // Get character from veggie
  const character = selectedVeggie;
  
  // Create prompt for image generation
  // 为 Sana Sprint 模型调整提示词
  const prompt = `a cute cartoon ${character} vegetable character expressing ${emotionWords} emotions, high quality, bright colors, fun style`;
  
  console.log("Generating meme with prompt:", prompt);
  
  try {
    // 调用后端API
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    // 清除消息间隔
    clearInterval(messageInterval);
    
    console.log("API response status:", response.status);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("API response received:", data.image ? "Image data received" : "Error: " + data.error);
    
    if (data.image) {
      generatedMemeUrl = "data:image/png;base64," + data.image;
      memeImage.src = generatedMemeUrl;
      memeResult.style.display = 'block';
      console.log("Meme image set and displayed");
      memeActions.style.display = 'flex';
      
      const emotionPercentages = top2.map(e => `${e[0]} (${(e[1] * 100).toFixed(1)}%)`);
      emotionsUsed.innerHTML = `
        ${emotionPercentages.join(', ')}
      `;
      
      // Upload the image to server for sharing
      await uploadImageToServer();
      
      showToast("Your veggie meme is ready! 🥳", 2000);
    } else {
      throw new Error(data.error || "Unknown error");
    }
  } catch (error) {
    console.error("Error generating meme:", error);
    
    // 使用SVG备用方案
    const svgUrl = createFallbackSVG(top2, character);
    generatedMemeUrl = svgUrl;
    memeImage.src = svgUrl;
    memeResult.style.display = 'block';
    memeActions.style.display = 'flex';
    
    const emotionPercentages = top2.map(e => `${e[0]} (${(e[1] * 100).toFixed(1)}%)`);
    emotionsUsed.innerHTML = `
      ${emotionPercentages.join(', ')}
    `;
    
    // 转换SVG为blob再转base64用于上传
    const response = await fetch(svgUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      generatedMemeUrl = reader.result;
      // Upload the image to server for sharing
      await uploadImageToServer();
    };
    
    showToast("Using backup meme generator. Your veggie is still fabulous!", 3000);
  } finally {
    // 无论成功还是失败，都确保隐藏加载指示器
    loadingDiv.style.display = 'none';
    clearInterval(messageInterval);
  }
}

// Generate button click handler
generateBtn.addEventListener('click', generateMeme);
regenerateBtn.addEventListener('click', generateMeme);

async function uploadImageToServer() {
  if (!generatedMemeUrl) return null;
  
  try {
    const response = await fetch('/api/upload-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: generatedMemeUrl })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log("Image uploaded to server:", data.imageUrl);
      uploadedImageUrl = data.imageUrl;
      return data.imageUrl;
    } else {
      console.error("Failed to upload image:", data.error);
      return null;
    }
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
}

// Share on Twitter
shareToTwitter.addEventListener('click', async () => {
  if (!uploadedImageUrl) {
    const imageUrl = await uploadImageToServer();
    
    if (!imageUrl) {
      showToast("Unable to share. Please try again.");
      return;
    }
  }
  
  // Create Twitter share URL
  const text = `Check out my emotion-based meme created with Veggie Meme Generator!`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(uploadedImageUrl)}`;
  window.open(twitterUrl, '_blank');
  showToast("Opening Twitter to share your meme!");
});

// Download meme
downloadMeme.addEventListener('click', () => {
  if (!generatedMemeUrl) {
    showToast("No meme has been generated yet!");
    return;
  }
  
  const link = document.createElement('a');
  link.href = generatedMemeUrl;
  link.download = `veggie-meme-${new Date().getTime()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("Meme saved to your device!");
});

console.log("Script loaded successfully");