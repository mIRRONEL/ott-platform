import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
export declare const validateRequest: (schema: Schema, source?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=validation.d.ts.map