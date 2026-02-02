import { Request, Response, NextFunction } from 'express';
export declare const getDashboard: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getTrendingContent: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getRecommendations: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getContentPerformance: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getEngagementMetrics: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const trackEvent: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=analytics.controller.d.ts.map