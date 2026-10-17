import { Request, Response, NextFunction } from 'express';
import FormData from 'form-data';
import * as http from 'http';
import * as https from 'https';
import fs from 'fs';

export const uploadVideoHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let responseAlreadySent = false;

  try {
    console.log('[UPLOAD] Handler started');
    
    if (!req.file) {
      console.log('[UPLOAD] No file provided');
      res.status(400).json({
        status: 'error',
        message: 'No video file provided',
        statusCode: 400
      });
      return;
    }

    const { title, description, category, subCategory } = req.body;

    if (!title) {
      console.log('[UPLOAD] No title provided');
      res.status(400).json({
        status: 'error',
        message: 'Video title is required',
        statusCode: 400
      });
      return;
    }

    console.log('[UPLOAD] File received:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });

    // Create FormData to forward to content service
    const formData = new FormData();
    
    // Add file from disk path (not buffer)
    const fileStream = fs.createReadStream(req.file.path);
    console.log('[UPLOAD] Creating FormData with file stream');
    
    formData.append('video', fileStream, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (category) formData.append('category', category);
    if (subCategory) formData.append('subCategory', subCategory);

    const contentServiceUrl = process.env.CONTENT_SERVICE_URL || 'http://ott-content-service:3003';
    console.log('[UPLOAD] Content service URL env:', process.env.CONTENT_SERVICE_URL);
    console.log('[UPLOAD] Content service URL:', contentServiceUrl);
    
    const urlObj = new URL(`${contentServiceUrl}/api/content/upload`);
    console.log('[UPLOAD] URL object:', { href: urlObj.href, hostname: urlObj.hostname, port: urlObj.port });
    
    const protocol = urlObj.protocol === 'https:' ? https : http;

    console.log('[UPLOAD] Proxying to:', urlObj.toString());

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 3003),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
        ...(req.user?.userId ? { 'x-user-id': req.user.userId } : {})
      },
      timeout: 3600000 // 1 hour timeout for large multi-gigabyte video uploads
    };

    console.log('[UPLOAD] Request options:', { hostname: options.hostname, port: options.port, path: options.path });

    const proxyReq = protocol.request(options, (proxyRes) => {
      console.log('[UPLOAD] Got response from content service:', proxyRes.statusCode);
      
      let responseData = '';

      proxyRes.on('data', (chunk) => {
        console.log('[UPLOAD] Got chunk:', chunk.length, 'bytes');
        responseData += chunk;
      });

      proxyRes.on('end', () => {
        console.log('[UPLOAD] Response ended, total length:', responseData.length);
        console.log('[UPLOAD] Response data:', responseData.substring(0, 200));
        
        if (responseAlreadySent) {
          console.log('[UPLOAD] Response already sent, ignoring');
          return;
        }
        
        responseAlreadySent = true;
        
        try {
          const parsedData = JSON.parse(responseData);
          console.log('[UPLOAD] Parsed JSON successfully');
          res.status(proxyRes.statusCode || 200).json(parsedData);
          
          // Clean up temp file
          fs.unlink(req.file!.path, (err) => {
            if (err) console.error('[UPLOAD] Failed to delete temp file:', err);
          });
        } catch (parseError) {
          console.error('[UPLOAD] JSON parse error:', parseError);
          res.status(proxyRes.statusCode || 200).json({
            status: 'error',
            message: responseData || 'Content service error',
            statusCode: proxyRes.statusCode || 500
          });
        }
      });
    });

    proxyReq.on('error', (error) => {
      console.error('[UPLOAD] Proxy request error:', error);
      
      if (!responseAlreadySent) {
        responseAlreadySent = true;
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          error: (error as Error).message
        });
      }
    });

    proxyReq.on('timeout', () => {
      console.error('[UPLOAD] Request timeout');
      proxyReq.destroy();
      
      if (!responseAlreadySent) {
        responseAlreadySent = true;
        res.status(504).json({
          status: 'error',
          message: 'Gateway timeout',
          code: 'GATEWAY_TIMEOUT'
        });
      }
    });

    console.log('[UPLOAD] Piping FormData to proxyReq');
    formData.pipe(proxyReq);
  } catch (error: any) {
    console.error('[UPLOAD] Catch error:', error);
    
    if (!responseAlreadySent) {
      responseAlreadySent = true;
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};

const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });

export const uploadChunkHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const contentServiceUrl = process.env.CONTENT_SERVICE_URL || 'http://content-service:3003';
    const urlObj = new URL(`${contentServiceUrl}/api/content/upload/chunk`);
    const isHttps = urlObj.protocol === 'https:';
    const protocol = isHttps ? https : http;
    const agent = isHttps ? keepAliveHttpsAgent : keepAliveHttpAgent;

    const queryString = req.url && req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const forwardPath = urlObj.pathname + queryString;

    const forwardHeaders: Record<string, any> = { ...req.headers };
    forwardHeaders.host = `${urlObj.hostname}:${urlObj.port || (isHttps ? 443 : 3003)}`;
    if (req.user?.userId) {
      forwardHeaders['x-user-id'] = req.user.userId;
    }

    const proxyReq = protocol.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 3003),
      path: forwardPath,
      method: 'POST',
      agent,
      headers: forwardHeaders,
      timeout: 300000
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[GATEWAY] Chunk stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ status: 'error', message: err.message, statusCode: 500 });
      }
    });

    req.pipe(proxyReq);
  } catch (error: any) {
    console.error('[GATEWAY] Chunk forwarding error:', error);
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', message: error.message, statusCode: 500 });
    }
  }
};


