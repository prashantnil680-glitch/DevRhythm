const multer = require('multer');
const UserFile = require('../models/UserFile');
const cloudinaryUpload = require('../services/cloudinaryUpload.service');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');

// Configure multer for memory storage (reuse existing config)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/json', // .json
    ];
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedExts = ['xlsx', 'xls', 'csv', 'json'];
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload .xlsx, .xls, .csv, or .json'), false);
    }
  },
});

/**
 * Upload a file to Cloudinary and store metadata.
 * POST /api/v1/sheets/upload-file
 */
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const userId = req.user._id;
    const { buffer, originalname, mimetype, size } = req.file;

    // Upload to Cloudinary
    const { publicId, url } = await cloudinaryUpload.uploadFile(buffer, userId, originalname);

    // Save metadata to database
    const userFile = await UserFile.create({
      userId,
      publicId,
      fileName: originalname,
      mimeType: mimetype,
      size,
      url,
    });

    res.status(201).json(formatResponse('File uploaded successfully', {
      publicId: userFile.publicId,
      fileName: userFile.fileName,
      url: userFile.url,
      size: userFile.size,
    }));
  } catch (error) {
    console.error('[UploadFile] Error:', error);
    if (error.message?.includes('File too large')) {
      next(new AppError('File too large. Maximum size is 5MB.', 400));
    } else {
      next(error);
    }
  }
};

/**
 * List all uploaded files for the current user.
 * GET /api/v1/sheets/uploaded-files
 */
const listFiles = async (req, res, next) => {
  try {
    const files = await UserFile.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('publicId fileName size url createdAt')
      .lean();

    res.json(formatResponse('Files retrieved', { files }));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a file from Cloudinary and remove its metadata.
 * DELETE /api/v1/sheets/uploaded-files/:publicId
 */
const deleteFile = async (req, res, next) => {
  try {
    const { publicId } = req.params;
    if (!publicId) {
      throw new AppError('publicId is required', 400);
    }

    // Find file in database and verify ownership
    const file = await UserFile.findOne({ publicId, userId: req.user._id });
    if (!file) {
      throw new AppError('File not found or not owned by user', 404);
    }

    // Delete from Cloudinary
    await cloudinaryUpload.deleteFile(publicId);

    // Delete from database
    await file.deleteOne();

    res.json(formatResponse('File deleted successfully', { publicId }));
  } catch (error) {
    next(error);
  }
};

// Middleware to handle multer errors gracefully
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File too large. Maximum size is 5MB.', 400));
      }
      return next(new AppError(`Upload error: ${err.message}`, 400));
    } else if (err) {
      return next(err);
    }
    next();
  });
};

module.exports = {
  uploadFile: [handleUpload, uploadFile],
  listFiles,
  deleteFile,
};