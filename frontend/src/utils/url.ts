/**
 * Dynamic API and Media URL Resolver
 * Supports unified Nginx reverse proxy (Port 80/443) and direct dev ports (3000/5173).
 */
export const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '' || port === '80' || port === '443') {
      return '';
    }
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3000`;
  }
  return 'http://localhost:3000';
};

export const getApiUrl = (): string => {
  const base = getBaseUrl();
  return base ? `${base}/api` : '/api';
};

export const getVideoManifestUrl = (videoId: string): string => {
  const base = getBaseUrl();
  return `${base}/api/stream/${videoId}/manifest`;
};

export const getVideoMp4Url = (fileName: string): string => {
  const base = getBaseUrl();
  return `${base}/api/content/uploads/${fileName}`;
};

export const getThumbnailUrl = (videoId: string, thumb?: string): string => {
  const base = getBaseUrl();
  if (thumb && thumb.startsWith('/')) {
    return `${base}${thumb}`;
  }
  if (thumb && thumb.startsWith('http')) {
    return thumb;
  }
  return `${base}/api/stream/${videoId}/thumbnail`;
};
