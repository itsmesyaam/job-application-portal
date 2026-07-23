import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
];

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'zip'];

/**
 * Uploads a candidate resume or task assignment file to the S3 bucket with strict security checks.
 * @param file File object extracted from the form request.
 * @returns The secure public URL of the uploaded file.
 */
export async function uploadResume(file: File): Promise<string> {
  // 1. Strict MIME-type Verification
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Security Error: Invalid file format. Only PDF, DOCX, and ZIP archives are allowed.');
  }

  // 2. Strict Filename Extension Sanitization
  const rawExtension = file.name.split('.').pop() || '';
  const fileExtension = ALLOWED_EXTENSIONS.includes(rawExtension.toLowerCase()) 
    ? rawExtension.toLowerCase() 
    : 'bin';

  if (fileExtension === 'bin') {
    throw new Error('Security Error: Malicious or unsupported file extension detected.');
  }

  // 3. Generate a secure random filename key to prevent path traversal and collisions
  const fileKey = `resumes/${crypto.randomUUID()}.${fileExtension}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: buffer,
    ContentType: file.type,
    // Add security metadata to S3 object
    Metadata: {
      originalName: file.name.replace(/[^\x00-\x7F]/g, ''), // Strip non-ASCII
    },
  });

  await s3Client.send(command);

  // Build the public access URL
  if (process.env.AWS_S3_ENDPOINT) {
    const cleanEndpoint = process.env.AWS_S3_ENDPOINT.replace(/\/$/, '');
    if (process.env.AWS_S3_FORCE_PATH_STYLE === 'true') {
      return `${cleanEndpoint}/${BUCKET_NAME}/${fileKey}`;
    }
    return `${cleanEndpoint.replace('://', `://${BUCKET_NAME}.`)}/${fileKey}`;
  }

  return `https://${BUCKET_NAME}.s3.${process.env.AWS_S3_REGION || 'us-west-1'}.amazonaws.com/${fileKey}`;
}
