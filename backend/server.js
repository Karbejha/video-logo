const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Validate formats and set limits
const validVideoFormats = ['.mp4', '.webm', '.ogg'];
const validLogoFormats = ['.png', '.jpeg', '.svg'];
const MAX_VIDEO_DURATION = 900; // 15 minutes
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_LOGO_SIZE = 1 * 1024 * 1024; // 1MB
const uploadFolder = 'uploads';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 2 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'video' && !validVideoFormats.includes(ext)) {
      return cb(new Error('Invalid video format. Only MP4, WEBM, and OGG are supported.'));
    }
    if (file.fieldname === 'logo' && !validLogoFormats.includes(ext)) {
      return cb(new Error('Invalid logo format. Only PNG, JPEG, and SVG are supported.'));
    }
    cb(null, true);
  }
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://video-logo.vercel.app',
    'https://*.vercel.app'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());
app.use(limiter);
app.use('/uploads', express.static(path.join(__dirname, uploadFolder)));

// Create uploads folder if not exists
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

// Helper function to delete temporary files
const cleanup = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Helper function to get video duration
const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filePath}`, (err, stdout, stderr) => {
      if (err) {
        console.error('ffprobe error:', err);
        console.error('ffprobe stderr:', stderr);
        return reject(err);
      }
      resolve(parseFloat(stdout));
    });
  });
};

// Helper function to process video with FFmpeg
const processVideo = async (videoPath, logoPath, outputPath, position, size) => {
  const overlayPositions = {
    'top-left': '10:10',
    'top-right': 'main_w-overlay_w-10:10',
    'bottom-left': '10:main_h-overlay_h-10',
    'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10'
  };

  const overlay = overlayPositions[position];
  const scale = `scale=iw*${size/100}:-1`;

  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i ${videoPath} -i ${logoPath} -filter_complex "[1:v]${scale}[logo];[0:v][logo]overlay=${overlay}" -c:a copy ${outputPath}`;
    
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error('FFmpeg error:', err);
        console.error('FFmpeg stderr:', stderr);
        return reject(err);
      }
      resolve();
    });
  });
};

// Endpoint to get the API URL
app.get('/api-url', (req, res) => {
  res.json({ apiUrl: API_URL });
});

// Define the /process endpoint
app.post('/process', upload.fields([{ name: 'video' }, { name: 'logo' }]), async (req, res) => {
  console.log('Processing request:', req.body);
  
  const { logoPosition = 'top-left', logoSize = 20 } = req.body;
  const videoFile = req.files.video[0];
  const logoFile = req.files.logo[0];
  const videoOutputPath = `${uploadFolder}/output-${Date.now()}.mp4`;

  try {
    // Validate video duration
    const videoDuration = await getVideoDuration(videoFile.path);
    if (videoDuration > MAX_VIDEO_DURATION) {
      throw new Error(`Video exceeds max duration of ${MAX_VIDEO_DURATION} seconds`);
    }

    // Process video with FFmpeg
    await processVideo(videoFile.path, logoFile.path, videoOutputPath, logoPosition, logoSize);

    // Clean up the temporary files
    cleanup(videoFile.path);
    cleanup(logoFile.path);

    // Send the output video back to the client
    res.json({ 
      success: true,
      output: path.basename(videoOutputPath),
      message: 'Video processed successfully'
    });

  } catch (error) {
    console.error('Error processing video:', error);
    
    // Clean up any files that might have been created
    cleanup(videoFile.path);
    cleanup(logoFile.path);
    cleanup(videoOutputPath);

    res.status(400).json({ 
      success: false,
      error: error.message || 'Error processing video'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API URL: ${API_URL}`);
});