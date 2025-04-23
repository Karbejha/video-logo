import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import './App.css';

// Define valid file types with their extensions and MIME types
const validVideoTypes = {
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/ogg': ['.ogg']
};

const validLogoTypes = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/svg+xml': ['.svg']
};

// Custom Dropzone component
const CustomDropzone = ({ onDrop, accept, maxFiles, maxSize }) => {
  const handleDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles && rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      if (error.code === 'file-too-large') {
        console.error('File is too large');
        return;
      }
    }
    onDrop(acceptedFiles);
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles,
    multiple: false,
    maxSize
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'active' : ''}`}
    >
      <input {...getInputProps()} />
      <div>
        <p>{isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}</p>
        <p className="dropzone-hint">or click to select</p>
      </div>
    </div>
  );
};

// Get API URL from environment variable or default to localhost
const DEFAULT_API_URL = process.env.REACT_APP_API_URL?.trim().replace(/\s+/g, '') || 'http://localhost:5000';

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
    const checkServer = async () => {
      try {
        const url = new URL('/api-url', DEFAULT_API_URL);
        const response = await axios.get(url.toString());
        if (response.data.apiUrl) {
          setApiUrl(response.data.apiUrl.trim());
        }
        setIsServerConnected(true);
        setError(null);
      } catch (error) {
        console.error('Error fetching API URL:', error);
        if (process.env.NODE_ENV === 'production') {
          setApiUrl(DEFAULT_API_URL);
          setIsServerConnected(true);
          setError(null);
        } else {
          try {
            await axios.get('http://localhost:5000/api-url');
            setApiUrl('http://localhost:5000');
            setIsServerConnected(true);
            setError(null);
          } catch (localError) {
            console.error('Local server also not available:', localError);
            setError('Please make sure the backend server is running on port 5000');
            setIsServerConnected(false);
          }
        }
      }
    };

    checkServer();
  }, []);

  const onDropVideo = (acceptedFiles) => {
    setError(null);
    const file = acceptedFiles[0];
    if (file) {
      const fileType = file.type.toLowerCase();
      if (!Object.keys(validVideoTypes).includes(fileType)) {
        setError('Invalid video format. Only MP4, WEBM, and OGG are supported.');
        return;
      }
      setVideo(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const onDropLogo = (acceptedFiles) => {
    setError(null);
    const file = acceptedFiles[0];
    if (file) {
      const fileType = file.type.toLowerCase();
      if (!Object.keys(validLogoTypes).includes(fileType)) {
        setError('Invalid logo format. Only PNG, JPG, JPEG, and SVG are supported.');
        return;
      }
      setLogo(file);
    }
  };

  const handleProcess = async () => {
    if (!video || !logo) {
      setError('Please upload both video and logo!');
      return;
    }

    // Size validation
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB for free tier
    const MAX_LOGO_SIZE = 10 * 1024 * 1024; // 10MB

    if (video.size > MAX_VIDEO_SIZE) {
      setError('Video file size should be less than 15MB for the free tier');
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

      const url = new URL('/process', apiUrl);
      const response = await axios.post(url.toString(), formData, {
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
        setError(null);
      } else {
        setError(response.data.error || 'Failed to process video');
      }
    } catch (error) {
      console.error('Error processing video:', error);
      let errorMessage = 'Failed to process the video. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Processing timeout. Please try with a shorter video.';
      } else if (!error.response) {
        errorMessage = 'Connection error. Please check your internet connection.';
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <img src="logo.png" alt="Logo" className="logo" style={{ width: 'auto', height: '150px' }} />  
        <h2>أداة إضافة اللوغو إلى الفيديوهات من  تنسيقية اللاذقية</h2>
      </header>

      <main>
        <div className="upload-section">
          <div className="upload-box">
            <h3>Upload Video</h3>
            <p className="subtitle">(MP4, WEBM, OGG, max 500MB)</p>
            <CustomDropzone 
              onDrop={onDropVideo} 
              accept={validVideoTypes}
              maxFiles={1}
              maxSize={500 * 1024 * 1024}
            />
            {video && (
              <div className="file-info">
                <p>Selected: {video.name}</p>
                <p>Size: {(video.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          <div className="upload-box">
            <h3>Upload Logo</h3>
            <p className="subtitle">(PNG, JPG, JPEG, SVG, max 10MB)</p>
            <CustomDropzone 
              onDrop={onDropLogo} 
              accept={validLogoTypes}
              maxFiles={1}
              maxSize={10 * 1024 * 1024}
            />
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
        <p>
          جميع الحقوق محفوظة لتنسيقية اللاذقية
        </p>
      </main>
    </div>
  );
};

export default App;
