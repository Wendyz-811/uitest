from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import base64
import requests
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

API_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-dev"
HF_TOKEN = os.getenv("HF_TOKEN") or "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"

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs('static/models', exist_ok=True)
os.makedirs('static/js', exist_ok=True)

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
    
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": prompt
    }
    
    try:
        print(f"Sending request to Hugging Face with prompt: {prompt}")
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {response.headers}")
        
        if response.status_code == 200 and "image" in response.headers.get("Content-Type", ""):
            print("Successfully received image")
            b64_image = base64.b64encode(response.content).decode('utf-8')
            return jsonify({"image": b64_image})
        else:
            print(f"Error response: {response.text}")
            error_msg = response.text
            try:
                error_json = response.json()
                error_msg = error_json.get('error', error_msg)
            except:
                pass
            return jsonify({"error": error_msg}), response.status_code
            
    except requests.exceptions.Timeout:
        print("Request timed out")
        return jsonify({"error": "Request timed out. The image generation is taking too long."}), 504
    except Exception as e:
        print(f"Exception: {str(e)}")
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
    app.run(debug=debug_mode, port=5076)