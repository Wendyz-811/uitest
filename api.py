from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import base64
import uuid
from io import BytesIO
import time

app = Flask(__name__)

UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs('static/models', exist_ok=True)
os.makedirs('static/js', exist_ok=True)

# Global variable to store the model
pipeline = None

def load_model():
    global pipeline
    if pipeline is None:
        try:
            import torch
            from diffusers import SanaSprintPipeline
            
            # Check if CUDA is available
            if torch.cuda.is_available():
                device = "cuda:0"
                dtype = torch.bfloat16
                print("Using CUDA with bfloat16")
            else:
                device = "cpu"
                dtype = torch.float32
                print("Using CPU with float32")
            
            # Load the model
            print("Loading Sana Sprint model. This may take some time...")
            pipeline = SanaSprintPipeline.from_pretrained(
                "Efficient-Large-Model/Sana_Sprint_1.6B_1024px_diffusers",
                torch_dtype=dtype
            )
            
            pipeline.to(device)
            print("Sana Sprint model loaded successfully")
            return True
        except Exception as e:
            print(f"Failed to load model: {str(e)}")
            return False
    return True

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.get_json()
    prompt = data.get('prompt', '')
    
    if not prompt:
        return jsonify({"error": "Missing prompt"}), 400
    
    # Try to load the model
    if not load_model():
        return jsonify({"error": "Failed to load image generation model. Check server logs."}), 500
    
    try:
        global pipeline
        print(f"Generating image with prompt: {prompt}")
        
        # Run image generation with Sana Sprint
        start_time = time.time()
        image = pipeline(prompt=prompt, num_inference_steps=2).images[0]
        end_time = time.time()
        print(f"Image generation took {end_time - start_time:.2f} seconds")
        
        # Convert PIL image to base64
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        print("Image generated successfully")
        return jsonify({"image": img_str})
    
    except Exception as e:
        print(f"Error generating image: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-base64', methods=['POST'])
def upload_base64():
    print("Base64 upload request received")
    data = request.get_json()
    image_data = data.get('image', '')
    
    if not image_data:
        print("No image data provided")
        return jsonify({"error": "No image data provided"}), 400
    
    try:
        if ';base64,' in image_data:
            image_data = image_data.split(';base64,')[1]
        
        filename = f"meme_{uuid.uuid4().hex}.png"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(image_data))
        image_url = request.host_url + filepath
        print(f"Base64 image saved to {image_url}")
        return jsonify({
            "success": True,
            "filename": filename,
            "imageUrl": image_url
        })
    except Exception as e:
        print(f"Error saving base64 image: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_ENV') == 'development'
    print(f"Starting Emotion Meme Generator - Debug mode: {debug_mode}")
    app.run(debug=debug_mode, port=5124)