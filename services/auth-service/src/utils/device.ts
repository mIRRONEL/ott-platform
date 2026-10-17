export interface DeviceInfo {
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'smart_tv' | 'bot' | 'unknown';
  browser: string;
  os: string;
}

export function parseUserAgent(ua?: string): DeviceInfo {
  if (!ua) {
    return {
      deviceName: 'Unknown Device',
      deviceType: 'unknown',
      browser: 'Web Browser',
      os: 'Unknown OS'
    };
  }

  let browser = 'Web Browser';
  let os = 'Unknown OS';
  let deviceType: DeviceInfo['deviceType'] = 'desktop';

  // Detect OS
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) {
    os = 'Android';
    deviceType = 'mobile';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = /ipad/i.test(ua) ? 'iPadOS' : 'iOS';
    deviceType = /ipad/i.test(ua) ? 'tablet' : 'mobile';
  } else if (/linux/i.test(ua)) os = 'Linux';
  else if (/tizen|webos|smart-tv/i.test(ua)) {
    os = 'Smart TV';
    deviceType = 'smart_tv';
  }

  // Detect Browser
  if (/edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Apple Safari';

  const deviceName = `${browser} on ${os}`;

  return {
    deviceName,
    deviceType,
    browser,
    os
  };
}
