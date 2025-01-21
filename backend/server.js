const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to enable CORS
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = ['https://video-logo.vercel.app', 'http://localhost:3000'];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// Middleware to serve static files from the "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create the "uploads" folder if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// Endpoint to process the video
app.post('/process', upload.fields([{ name: 'video' }, { name: 'logo' }]), (req, res) => {
  try {
    const videoPath = req.files['video'][0].path;
    const logoPath = req.files['logo'][0].path;
    const outputVideoPath = `uploads/output-${Date.now()}.mp4`;

    const logoPosition = req.body.logoPosition || 'top-left';
    const logoSize = parseFloat(req.body.logoSize) || 20;

    console.log('Video Path:', videoPath);
    console.log('Logo Path:', logoPath);
    console.log('Logo Position:', logoPosition);
    console.log('Logo Size:', logoSize);

    // Get video dimensions to calculate logo size
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('Error getting video metadata:', err);
        return res.status(500).json({ error: 'Failed to process the video', details: err.message });
      }

      const videoWidth = metadata.streams[0].width;
      const videoHeight = metadata.streams[0].height;

      // Calculate logo dimensions based on percentage of video width
      const logoWidth = (videoWidth * logoSize) / 100;
      const logoHeight = 'ih*ow/iw';

      // Calculate logo position
      let overlayX, overlayY;
      switch (logoPosition) {
        case 'top-left':
          overlayX = 10;
          overlayY = 10;
          break;
        case 'top-right':
          overlayX = videoWidth - logoWidth - 10;
          overlayY = 10;
          break;
        case 'bottom-left':
          overlayX = 10;
          overlayY = videoHeight - logoWidth - 10;
          break;
        case 'bottom-right':
          overlayX = videoWidth - logoWidth - 10;
          overlayY = videoHeight - logoWidth - 10;
          break;
        default:
          overlayX = 10;
          overlayY = 10;
      }

      // Run FFmpeg command to overlay logo on video
      ffmpeg(videoPath)
        .input(logoPath)
        .complexFilter([
          {
            filter: 'scale',
            options: { w: logoWidth, h: logoHeight },
            inputs: '1:v',
            outputs: 'logo',
          },
          {
            filter: 'overlay',
            options: { x: overlayX, y: overlayY },
            inputs: ['0:v', 'logo'],
            outputs: 'out',
          },
        ])
        .outputOptions('-map', '[out]')
        .save(outputVideoPath)
        .on('end', () => {
          console.log('Video processing completed:', outputVideoPath);
          res.json({ output: path.basename(outputVideoPath) });
        })
        .on('error', (err) => {
          console.error('FFmpeg Error:', err.message);
          console.error('FFmpeg Command:', err.cmd);
          res.status(500).json({ error: 'Failed to process the video', details: err.message });
        });
    });
  } catch (err) {
    console.error('Unexpected error:', err.message);
    res.status(500).json({ error: 'An unexpected error occurred', details: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});