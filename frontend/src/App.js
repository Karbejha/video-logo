import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

function App() {
  const [video, setVideo] = useState(null);
  const [logo, setLogo] = useState(null);
  const [outputVideo, setOutputVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logoPosition, setLogoPosition] = useState('top-left'); // Default position
  const [logoSize, setLogoSize] = useState(20); // Default size (percentage of video width)
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';


  const onDropVideo = (acceptedFiles) => setVideo(acceptedFiles[0]);
  const onDropLogo = (acceptedFiles) => setLogo(acceptedFiles[0]);

  const handleProcess = async () => {
    if (!video || !logo) {
      alert('Please upload both video and logo!');
      return;
    }

    const formData = new FormData();
    formData.append('video', video);
    formData.append('logo', logo);
    formData.append('logoPosition', logoPosition);
    formData.append('logoSize', logoSize);

    try {
      setProgress(0); // Reset progress
      setIsProcessing(true); // Start processing

      const response = await axios.post(`${API_URL}/process`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      setOutputVideo(response.data.output);
      setIsProcessing(false);
      alert('Video processed successfully! Click the download button to save your video.');
    } catch (error) {
      console.error('Error processing video:', error);
      alert('Failed to process the video. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Logo on Video Tool</h1>
      <div style={{ marginBottom: '20px' }}>
        <h3>Upload Video</h3>
        <Dropzone onDrop={onDropVideo} />
        {video && <p>Selected Video: {video.name}</p>}
      </div>
      <div style={{ marginBottom: '20px' }}>
        <h3>Upload Logo</h3>
        <Dropzone onDrop={onDropLogo} />
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
          onChange={(e) => setLogoSize(e.target.value)}
          min="1"
          max="100"
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

function Dropzone({ onDrop }) {
  const { getRootProps, getInputProps } = useDropzone({ onDrop });
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