const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

// Validate formats and set limits
const validVideoFormats = ['.mp4', '.webm', '.ogg']; // Updated valid formats
const validLogoFormats = ['.png', '.jpeg', '.svg']; // Updated valid formats
const MAX_VIDEO_DURATION = 900; // 15 minutes
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
  limits: { fileSize: 30 * 1024 * 1024, files: 2 }, // Limit to 30MB
});

app.use(cors());
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

// Define the /process endpoint
app.post('/process', upload.fields([{ name: 'video' }, { name: 'logo' }]), async (req, res) => {
  console.log(req.body); // Log the request body
  console.log(req.files); // Log the uploaded files

  const { logoPosition = 'top-left', logoSize = 20 } = req.body;
  const videoFile = req.files.video[0];
  const logoFile = req.files.logo[0];
  const videoOutputPath = `${uploadFolder}/output-${Date.now()}.mp4`;

  try {
    // Validate video and logo formats
    if (!validVideoFormats.includes(path.extname(videoFile.originalname).toLowerCase())) {
      throw new Error('Invalid video format. Only MP4, WEBM, and OGG are supported.');
    }

    if (!validLogoFormats.includes(path.extname(logoFile.originalname).toLowerCase())) {
      throw new Error('Invalid logo format. Only PNG, JPEG, and SVG are supported.');
    }

    // Get video duration
    const videoDuration = await new Promise((resolve, reject) => {
      exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${videoFile.path}`, (err, stdout, stderr) => {
        if (err) {
          console.error('ffprobe error:', err);
          console.error('ffprobe stderr:', stderr);
          return reject(err);
        }
        resolve(parseFloat(stdout));
      });
    });

    if (videoDuration > MAX_VIDEO_DURATION) {
      throw new Error(`Video exceeds max duration of ${MAX_VIDEO_DURATION} seconds`);
    }

    // Determine overlay position
    const overlayPositions = {
      'top-left': '10:10',
      'top-right': 'main_w-overlay_w-10:10',
      'bottom-left': '10:main_h-overlay_h-10',
      'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
    };
    const overlay = overlayPositions[logoPosition];

    // Process video with HandBrakeCLI
    await new Promise((resolve, reject) => {
      const command = `HandBrakeCLI -i ${videoFile.path} -o ${videoOutputPath} --preset="Fast 1080p30"`;
      console.log('Executing command:', command);
      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.error('HandBrakeCLI error:', err);
          console.error('HandBrakeCLI stderr:', stderr);
          cleanup(videoOutputPath);
          reject(new Error('Error during video processing'));
        } else {
          console.log('HandBrakeCLI stdout:', stdout);
          resolve();
        }
      });
    });

    // Clean up the temporary files after processing
    cleanup(videoFile.path);
    cleanup(logoFile.path);

    // Send the output video back to the client
    res.json({ output: path.basename(videoOutputPath) });

  } catch (error) {
    console.error('Error processing video:', error);
    cleanup(videoFile.path);
    cleanup(logoFile.path);
    return res.status(400).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));