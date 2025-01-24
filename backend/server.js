const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure FFmpeg
ffmpeg.setFfmpegPath('/usr/local/bin/ffmpeg'); // Ensure FFmpeg is installed

const validVideoFormats = ['.mp4', '.mov'];
const validLogoFormats = ['.png', '.webp'];
const MAX_VIDEO_DURATION = 300; // 5 minutes

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 2 },
});

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const cleanup = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const handleFfmpegError = (err, videoOutputPath, reject) => {
  console.error('FFmpeg error:', err);
  cleanup(videoOutputPath);
  reject(new Error('Error during video processing'));
};

app.post('/process', upload.fields([{ name: 'video' }, { name: 'logo' }]), async (req, res) => {
  const { logoPosition = 'top-left', logoSize = 20 } = req.body;
  const videoFile = req.files.video[0];
  const logoFile = req.files.logo[0];

  const videoOutputPath = `uploads/output-${Date.now()}.mp4`;

  try {
    if (!validVideoFormats.includes(path.extname(videoFile.originalname).toLowerCase())) {
      throw new Error('Invalid video format. Only MP4 and MOV are supported.');
    }

    if (!validLogoFormats.includes(path.extname(logoFile.originalname).toLowerCase())) {
      throw new Error('Invalid logo format. Only PNG and WEBP are supported.');
    }

    const videoDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoFile.path, (err, metadata) => {
        if (err) {
          return reject(err);
        }
        resolve(metadata.format.duration);
      });
    });

    if (videoDuration > MAX_VIDEO_DURATION) {
      throw new Error(`Video exceeds max duration of ${MAX_VIDEO_DURATION} seconds`);
    }

    const overlay = {
      'top-left': '10:10',
      'top-right': 'main_w-overlay_w-10:10',
      'bottom-left': '10:main_h-overlay_h-10',
      'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
    }[logoPosition];

    await new Promise((resolve, reject) => {
      ffmpeg(videoFile.path)
        .input(logoFile.path)
        .complexFilter([
          `[1:v]scale=${logoSize}%:logo`,
          `[0:v][logo]overlay=${overlay}`,
        ])
        .outputOptions(['-c:v libx264', '-preset ultrafast', '-crf 28', '-movflags +faststart'])
        .on('error', (err) => handleFfmpegError(err, videoOutputPath, reject))
        .on('end', () => resolve())
        .save(videoOutputPath);
    });

    cleanup(videoFile.path);
    cleanup(logoFile.path);

    res.json({ output: path.basename(videoOutputPath) });
  } catch (error) {
    console.error('Error processing video:', error);
    cleanup(videoFile.path);
    cleanup(logoFile.path);
    return res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
