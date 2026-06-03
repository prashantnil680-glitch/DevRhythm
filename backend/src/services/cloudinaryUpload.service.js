const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} userId - User ID (used for folder path)
 * @param {string} originalName - Original file name (with extension)
 * @returns {Promise<{publicId: string, url: string}>}
 */
const uploadFile = async (buffer, userId, originalName) => {
  // Keep the original file name (with extension) in the public ID to preserve extension for later detection
  const baseName = originalName.replace(/\.[^/.]+$/, ''); // remove extension
  const extension = originalName.split('.').pop(); // get extension
  const publicId = `${Date.now()}_${baseName}.${extension}`;
  
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `user_${userId}/imports`,
        resource_type: 'auto',
        public_id: publicId,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            publicId: result.public_id,
            url: result.secure_url,
          });
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Delete a file from Cloudinary by public ID.
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<{result: string}>}
 */
const deleteFile = async (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

module.exports = {
  uploadFile,
  deleteFile,
};