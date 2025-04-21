// DOM Elements
const video = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const emotionOutput = document.getElementById('emotion-output');
const generateBtn = document.getElementById('generate-btn');
const memeImage = document.getElementById('meme-image');
const characterSelect = document.getElementById('character-select');
const loadingDiv = document.getElementById('loading');
const shareButtons = document.getElementById('share-buttons');
const emotionsUsed = document.getElementById('emotions-used');
const toast = document.getElementById('toast');

// Social media buttons
const shareToTwitter = document.getElementById('share-twitter');
const downloadMeme = document.getElementById('download-meme');

// Current emotions state
let currentEmotions = {};
let generatedMemeUrl = '';
let uploadedImageUrl = ''; // Store URL after uploading to server

// Show toast notification
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// Load face detection models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/static/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/static/models')
]).then(startVideo)
  .catch(err => {
    console.error("Error loading face-api models:", err);
    emotionOutput.innerText = "Error loading face detection models. Please check console.";
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
      emotionOutput.innerText = "Camera error: " + err.message;
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
  
  // Detect faces and emotions every 500ms
  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    // Clear the canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Only draw the detection boxes (face rectangles)
    if (resizedDetections.length > 0) {
      resizedDetections.forEach(detection => {
        const box = detection.detection.box;
        
        // Draw a blue rectangle around the face
        ctx.strokeStyle = '#0063B2';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // Draw the confidence score
        ctx.fillStyle = '#0063B2';
        ctx.fillRect(box.x, box.y - 30, 60, 30);
        ctx.fillStyle = '#FFF';
        ctx.font = '18px Arial';
        ctx.fillText(
          detection.detection.score.toFixed(2), 
          box.x + 5, 
          box.y - 10
        );
        
        // Display the dominant emotion with percentage at bottom of box
        const dominantEmotion = Object.entries(detection.expressions)
          .sort((a, b) => b[1] - a[1])[0];
        
        const emotionText = `${dominantEmotion[0]} (${(dominantEmotion[1] * 100).toFixed(0)}%)`;
        const textWidth = ctx.measureText(emotionText).width + 10;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(box.x, box.y + box.height, textWidth, 30);
        ctx.fillStyle = '#FFF';
        ctx.fillText(emotionText, box.x + 5, box.y + box.height + 20);
      });
      
      // Update current emotions from first detected face
      currentEmotions = resizedDetections[0].expressions;
      
      // Get top 2 emotions
      const top2 = Object.entries(currentEmotions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(e => `${e[0]} (${(e[1] * 100).toFixed(1)}%)`);
      
      emotionOutput.innerHTML = `
        <strong>Top Emotions:</strong> ${top2.join(', ')}
      `;
    } else {
      emotionOutput.innerText = "No face detected";
    }
  }, 500);
});

// Generate meme button click handler
generateBtn.addEventListener('click', async () => {
  console.log("Generate button clicked");
  
  if (!currentEmotions || Object.keys(currentEmotions).length === 0) {
    showToast("No emotion detected. Please make sure your face is visible to the camera.");
    return;
  }
  
  // Reset previous uploaded URL
  uploadedImageUrl = '';
  
  // Show loading indicator
  loadingDiv.style.display = 'flex';
  
  // Hide meme image while loading
  memeImage.style.display = 'none';
  
  // Hide share buttons
  shareButtons.style.display = 'none';
  
  // Get top 2 emotions
  const top2 = Object.entries(currentEmotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  const emotionWords = top2.map(e => e[0]).join(', ');
  
  // Get character from select
  const character = characterSelect.value;
  
  // Create prompt for image generation
  const prompt = `meme: a (${emotionWords}) tired ${character} cartoon style`;
  
  console.log("Generating meme with prompt:", prompt);
  
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    console.log("API response status:", response.status);
    
    const data = await response.json();
    console.log("API response received:", data.image ? "Image data received" : "Error: " + data.error);
    
    // Hide loading indicator
    loadingDiv.style.display = 'none';
    
    if (data.image) {
      generatedMemeUrl = "data:image/png;base64," + data.image;
      
      memeImage.src = generatedMemeUrl;
      memeImage.style.display = 'block';
      console.log("Meme image set and displayed");
      const emotionPercentages = top2.map(e => `${e[0]} (${(e[1] * 100).toFixed(1)}%)`);
      emotionsUsed.innerHTML = `
        <strong>Emotions in this meme:</strong> ${emotionPercentages.join(', ')}
      `;
      
      shareButtons.style.display = 'flex';
      
      await uploadImageToServer();
    } else {
      console.error("Failed to generate meme:", data.error);
      showToast("Failed to generate meme: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Error generating meme:", error);
    

    loadingDiv.style.display = 'none';
    
    showToast("Error generating meme: " + error.message);
  }
});


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
  const text = `Check out my emotion-based meme created with Emotion Meme Generator!`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(uploadedImageUrl)}`;

  window.open(twitterUrl, '_blank');
  showToast("Opening Twitter to share your meme!");
});

downloadMeme.addEventListener('click', () => {
  if (!generatedMemeUrl) {
    showToast("No meme has been generated yet!");
    return;
  }
  
  const link = document.createElement('a');
  link.href = generatedMemeUrl;
  link.download = `emotion-meme-${new Date().getTime()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("Meme saved to your device!");
});

console.log("Script loaded successfully");