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
let uploadedImageUrl = ''; // Store URL after uploading to server
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
    // Remove selected class from all options
    veggieOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Add selected class to clicked option
    option.classList.add('selected');
    
    // Update selected veggie value
    selectedVeggie = option.dataset.value;
    
    // Update the hidden select for compatibility
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
      });
      
      // Update current emotions from first detected face
      currentEmotions = resizedDetections[0].expressions;
      
      // Get top 2 emotions
      const top2 = Object.entries(currentEmotions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(e => e[0]);
      
      // Update the top emotion display
      topEmotion.innerText = `Top two Emotion: ${top2.join(', ')}`;
    } else {
      topEmotion.innerText = "No face detected";
    }
  }, 500);
});

// Generate meme function (used by both generate and regenerate buttons)
async function generateMeme() {
  console.log("Generating meme");
  
  if (!currentEmotions || Object.keys(currentEmotions).length === 0) {
    showToast("No emotion detected. Please make sure your face is visible to the camera.");
    return;
  }
  
  // Reset previous uploaded URL
  uploadedImageUrl = '';
  
  // Hide generate button and show loading
  generateBtn.style.display = 'none';
  loadingDiv.style.display = 'flex';
  
  // Hide meme result and actions while loading
  memeResult.style.display = 'none';
  memeActions.style.display = 'none';
  
  // Get top 2 emotions
  const top2 = Object.entries(currentEmotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  const emotionWords = top2.map(e => e[0]).join(', ');
  
  // Get character from selected veggie
  const character = selectedVeggie;
  
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
      // Store the generated image URL
      generatedMemeUrl = "data:image/png;base64," + data.image;
      
      // Display the image
      memeImage.src = generatedMemeUrl;
      memeResult.style.display = 'block';
      console.log("Meme image set and displayed");
      
      // Show action buttons
      memeActions.style.display = 'flex';
      
      // Display emotions used for this meme
      const emotionPercentages = top2.map(e => `${e[0]} (${(e[1] * 100).toFixed(1)}%)`);
      emotionsUsed.innerHTML = `
        ${emotionPercentages.join(', ')}
      `;
      
      // Upload the image to server for sharing
      await uploadImageToServer();
    } else {
      console.error("Failed to generate meme:", data.error);
      showToast("Failed to generate meme: " + (data.error || "Unknown error"));
      
      // Show generate button again if there was an error
      generateBtn.style.display = 'block';
    }
  } catch (error) {
    console.error("Error generating meme:", error);
    
    // Hide loading indicator in case of error
    loadingDiv.style.display = 'none';
    
    // Show generate button again
    generateBtn.style.display = 'block';
    
    showToast("Error generating meme: " + error.message);
  }
}

// Generate button click handler
generateBtn.addEventListener('click', generateMeme);

// Regenerate button click handler
regenerateBtn.addEventListener('click', generateMeme);

// Upload the generated image to the server
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
  // Make sure we have a URL to share
  if (!uploadedImageUrl) {
    // Try to upload the image first
    const imageUrl = await uploadImageToServer();
    
    if (!imageUrl) {
      showToast("Unable to share. Please try again.");
      return;
    }
  }
  
  // Create Twitter share URL
  const text = `Check out my emotion-based meme created with Emotion Meme Generator!`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(uploadedImageUrl)}`;
  
  // Open Twitter in a new window
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
  link.download = `emotion-meme-${new Date().getTime()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("Meme saved to your device!");
});

console.log("Script loaded successfully");