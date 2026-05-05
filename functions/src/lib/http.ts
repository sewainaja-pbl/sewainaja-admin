import type { Response } from 'express';
import type { ErrorCode } from '../errors';

export const ok = (res: Response, data: unknown, message = 'Berhasil') => {
  return res.status(200).json({
    success: true,
    data,
    message,
  });
};

export const fail = (
  res: Response,
  code: ErrorCode,
  message: string,
  status: number,
) => {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};
