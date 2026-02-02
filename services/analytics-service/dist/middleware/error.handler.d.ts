import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
export declare const errorHandler: (err: Error | AppError, req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=error.handler.d.ts.map