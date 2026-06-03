const axios = require('axios');
const cloudinary = require('../config/cloudinary');

/**
 * Fetch a file from Cloudinary by public ID.
 * @param {string} publicId - Cloudinary public ID (e.g., "user_xxx/imports/xxx")
 * @returns {Promise<{buffer: Buffer, originalname: string, mimetype: string, size: number}>}
 */
const fetchFile = async (publicId) => {
  // Construct the download URL (use raw upload type, but Cloudinary serves the original file)
  // The URL can be obtained from the cloudinary.url() method, but simpler: use secure_url from the stored record.
  // Since we don't have the URL directly, we construct it using the publicId.
  // For raw files, we need to know the resource type. Default is 'upload' for images, but for raw files we need to use 'raw'.
  // The file was uploaded with resource_type: 'auto', which Cloudinary treats as 'raw' for non-image files.
  // We'll attempt to fetch using the raw resource type.
  const url = cloudinary.url(publicId, { resource_type: 'raw', secure: true });
  
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  
  const buffer = Buffer.from(response.data);
  const contentDisposition = response.headers['content-disposition'];
  let originalname = publicId.split('/').pop();
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) originalname = match[1];
  }
  
  const mimetype = response.headers['content-type'] || 'application/octet-stream';
  const size = buffer.length;
  
  return { buffer, originalname, mimetype, size };
};

module.exports = { fetchFile };