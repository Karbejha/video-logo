import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import './App.css';

const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg']; // Commonly used video formats
const validLogoTypes = ['image/png', 'image/jpeg', 'image/svg+xml']; // Commonly used image formats

// Default to localhost in development
const DEFAULT_API_URL = 'http://localhost:5000';

const App = () => {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [video, setVideo] = useState(null);
  const [logo, setLogo] = useState(null);
  const [outputVideo, setOutputVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logoPosition, setLogoPosition] = useState('top-left');
  const [logoSize, setLogoSize] = useState(20);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isServerConnected, setIsServerConnected] = useState(false);

  useEffect(() => {
    const fetchApiUrl = async () => {
      try {
        // First try to get the API URL from the server
        const response = await axios.get(`${DEFAULT_API_URL}/api-url`);
        setApiUrl(response.data.apiUrl);
        setIsServerConnected(true);
      } catch (error) {
        console.error('Error fetching API URL:', error);
        // If that fails, check if the server is running locally
        try {
          await axios.get(`${DEFAULT_API_URL}/api-url`);
          setApiUrl(DEFAULT_API_URL);
          setIsServerConnected(true);
        } catch (localError) {
          console.error('Local server also not available:', localError);
          setError('Please make sure the backend server is running on port 5000');
          setIsServerConnected(false);
        }
      }
    };

    fetchApiUrl();
  }, []);

  const onDropVideo = (acceptedFiles) => {
    setError(null);
    const file = acceptedFiles[0];
    if (file) {
      setVideo(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const onDropLogo = (acceptedFiles) => {
    setError(null);
    const file = acceptedFiles[0];
    if (file) {
      setLogo(file);
    }
  };

  const handleProcess = async () => {
    if (!video || !logo) {
      setError('Please upload both video and logo!');
      return;
    }

    // File type validation
    if (!validVideoTypes.includes(video.type)) {
      setError('Only MP4, WEBM, or OGG videos are supported');
      return;
    }

    if (!validLogoTypes.includes(logo.type)) {
      setError('Only PNG, JPEG, or SVG logos are supported');
      return;
    }

    // Size validation
    const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB
    const MAX_LOGO_SIZE = 1 * 1024 * 1024; // 1MB

    if (video.size > MAX_VIDEO_SIZE) {
      setError('Video file size should be less than 30MB');
      return;
    }

    if (logo.size > MAX_LOGO_SIZE) {
      setError('Logo file size should be less than 1MB');
      return;
    }

    const formData = new FormData();
    formData.append('video', video);
    formData.append('logo', logo);
    formData.append('logoPosition', logoPosition);
    formData.append('logoSize', logoSize);

    try {
      setProgress(0);
      setIsProcessing(true);
      setError(null);

      const response = await axios.post(`${apiUrl}/process`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
        timeout: 900000 // 15 minutes
      });

      if (response.data.success) {
        setOutputVideo(response.data.output);
      } else {
        setError(response.data.error || 'Failed to process video');
      }
    } catch (error) {
      console.error('Error processing video:', error);
      let errorMessage = 'Failed to process the video. Please try again.';

      if (error.response) {
        errorMessage = error.response.data.error || error.response.statusText;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Processing timeout. Please try with a shorter video.';
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Video Logo Overlay Tool</h1>
        <p>Add your logo to any video in seconds</p>
      </header>

      <main>
        <div className="upload-section">
          <div className="upload-box">
            <h3>Upload Video</h3>
            <p className="subtitle">(MP4, WEBM, OGG, max 30MB)</p>
            <Dropzone onDrop={onDropVideo} accept={validVideoTypes.join(',')} />
            {video && (
              <div className="file-info">
                <p>Selected: {video.name}</p>
                <p>Size: {(video.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          <div className="upload-box">
            <h3>Upload Logo</h3>
            <p className="subtitle">(PNG, JPEG, SVG, max 1MB)</p>
            <Dropzone onDrop={onDropLogo} accept={validLogoTypes.join(',')} />
            {logo && (
              <div className="file-info">
                <p>Selected: {logo.name}</p>
                <p>Size: {(logo.size / 1024).toFixed(2)} KB</p>
              </div>
            )}
          </div>
        </div>

        {previewUrl && (
          <div className="preview-section">
            <h3>Video Preview</h3>
            <video src={previewUrl} controls className="preview-video" />
          </div>
        )}

        <div className="settings-section">
          <div className="setting">
            <label>Logo Position</label>
            <select
              value={logoPosition}
              onChange={(e) => setLogoPosition(e.target.value)}
              disabled={isProcessing}
            >
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
            </select>
          </div>

          <div className="setting">
            <label>Logo Size (% of Video Width)</label>
            <input
              type="range"
              min="1"
              max="50"
              value={logoSize}
              onChange={(e) => setLogoSize(Number(e.target.value))}
              disabled={isProcessing}
            />
            <span>{logoSize}%</span>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="process-button"
          onClick={handleProcess}
          disabled={isProcessing || !video || !logo}
        >
          {isProcessing ? 'Processing...' : 'Process Video'}
        </button>

        {isProcessing && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress" style={{ width: `${progress}%` }} />
            </div>
            <p>{progress}%</p>
          </div>
        )}

        {outputVideo && (
          <div className="output-section">
            <h3>Your Video is Ready!</h3>
            <a
              href={`${apiUrl}/uploads/${outputVideo}`}
              download
              className="download-button"
            >
              Download Video
            </a>
          </div>
        )}
      </main>
    </div>
  );
};

function Dropzone({ onDrop, accept }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept,
    multiple: false
  });
  
  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'active' : ''}`}
    >
      <input {...getInputProps()} />
      <p>{isDragActive ? 'Drop the file here' : 'Drag & drop a file here, or click to select'}</p>
    </div>
  );
}

export default App;