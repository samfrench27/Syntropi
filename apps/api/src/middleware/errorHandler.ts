import { Request, Response, NextFunction } from 'express';
import { winstonLogger } from '../utils/logger';

interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  winstonLogger.error(`Error: ${statusCode} - ${message}`, {
    method: req.method,
    url: req.originalUrl,
    error: err.stack,
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });
  
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

export const createError = (message: string, statusCode: number = 400): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  return error;
};
