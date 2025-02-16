import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

const API_URL = 'https://latakia-logo.onrender.com';

// Updated valid MIME types
const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg']; // Commonly used video formats
const validLogoTypes = ['image/png', 'image/jpeg', 'image/svg+xml']; // Commonly used image formats

function App() {
  const [video, setVideo] = useState(null);
  const [logo, setLogo] = useState(null);
  const [outputVideo, setOutputVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logoPosition, setLogoPosition] = useState('top-left');
  const [logoSize, setLogoSize] = useState(20);

  const onDropVideo = (acceptedFiles) => setVideo(acceptedFiles[0]);
  const onDropLogo = (acceptedFiles) => setLogo(acceptedFiles[0]);

  const handleProcess = async () => {
    if (!video || !logo) {
      alert('Please upload both video and logo!');
      return;
    }

    // File type validation
    if (!validVideoTypes.includes(video.type)) {
      alert('Only MP4, WEBM, or OGG videos are supported');
      return;
    }

    if (!validLogoTypes.includes(logo.type)) {
      alert('Only PNG, JPEG, or SVG logos are supported');
      return;
    }

    // Size validation
    const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // Limit to 30MB to avoid server timeout
    const MAX_LOGO_SIZE = 1 * 1024 * 1024; // Limit logo to 1MB

    if (video.size > MAX_VIDEO_SIZE) {
      alert('Video file size should be less than 30MB');
      return;
    }

    if (logo.size > MAX_LOGO_SIZE) {
      alert('Logo file size should be less than 1MB');
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

      const response = await axios.post(`${API_URL}/process`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
        timeout: 900000 // Increased to 15 minutes to allow time for server processing
      });

      setOutputVideo(response.data.output);
      setIsProcessing(false);
      alert('Video processed successfully! Click the download button to save your video.');
    } catch (error) {
      console.error('Error processing video:', error);
      let errorMessage = 'Failed to process the video. Please try again.';

      if (error.response) {
        errorMessage = `Server Error: ${error.response.status} - ${error.response.data.error || error.response.statusText}`;
        console.error('Server response:', error.response.data);
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Processing timeout. Please try with a shorter video.';
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }

      alert(`Error during video processing:\n${errorMessage}`);
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Logo on Video Tool</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Upload Video (MP4, WEBM, OGG, max 30MB)</h3>
        <Dropzone onDrop={onDropVideo} accept={validVideoTypes.join(',')} />
        {video && <p>Selected Video: {video.name}</p>}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Upload Logo (PNG, JPEG, SVG, max 1MB)</h3>
        <Dropzone onDrop={onDropLogo} accept={validLogoTypes.join(',')} />
        {logo && <p>Selected Logo: {logo.name}</p>}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Logo Position</h3>
        <select
          value={logoPosition}
          onChange={(e) => setLogoPosition(e.target.value)}
          style={{ padding: '5px', fontSize: '16px' }}
        >
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Logo Size (% of Video Width)</h3>
        <input
          type="number"
          value={logoSize}
          onChange={(e) => setLogoSize(Math.min(Math.max(e.target.value, 1), 50))}
          min="1"
          max="50"
          style={{ padding: '5px', fontSize: '16px' }}
        />
      </div>

      <button
        onClick={handleProcess}
        disabled={isProcessing}
        style={{
          padding: '10px 20px',
          backgroundColor: isProcessing ? 'gray' : '#007BFF',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
        }}
      >
        {isProcessing ? 'Processing...' : 'Process Video'}
      </button>

      {isProcessing && (
        <div style={{ marginTop: '20px' }}>
          <p>Processing: {progress}%</p>
          <progress value={progress} max="100" style={{ width: '100%' }} />
        </div>
      )}

      {outputVideo && (
        <div style={{ marginTop: '20px' }}>
          <h3>Download Processed Video:</h3>
          <a
            href={`${API_URL}/uploads/${outputVideo}`}
            download
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '5px',
            }}
          >
            Download Video
          </a>
        </div>
      )}
    </div>
  );
}

function Dropzone({ onDrop, accept }) {
  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop,
    accept: accept
  });
  
  return (
    <div
      {...getRootProps()}
      style={{
        border: '2px dashed gray',
        padding: '20px',
        cursor: 'pointer',
        marginBottom: '10px',
      }}
    >
      <input {...getInputProps()} />
      <p>Drag & drop a file here, or click to select a file</p>
    </div>
  );
}

export default App;