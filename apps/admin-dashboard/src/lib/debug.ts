// src/lib/debug.ts
export const debugLog = (
    component: string,
    action: string,
    data: any,
    error: boolean = false
  ) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${component}] [${action}]`;
    
    if (error) {
      console.error(prefix, data);
    } else {
      console.log(prefix, data);
    }
  };
  
  // Function to help inspect JWT tokens
  export const decodeJwt = (token: string) => {
    try {
      // Split the token and get the payload part
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );
  
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error decoding JWT token:', e);
      return null;
    }
  };
  
  // Helper to inspect API requests
  export const logApiRequest = (method: string, url: string, data?: any, headers?: any) => {
    debugLog('API', `${method} ${url}`, {
      headers: headers,
      data: data
    });
  };
  
  // Helper to inspect API responses
  export const logApiResponse = (url: string, status: number, data: any) => {
    debugLog('API', `Response ${status} from ${url}`, data);
  };