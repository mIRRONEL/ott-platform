import { Pool } from 'pg';
import { Db } from 'mongodb';
export declare const setDatabases: (pool: Pool, db: Db) => void;
export declare const getRecommendations: (userId: string, limit?: number, category?: string, algorithm?: string) => Promise<{
    userId: string;
    algorithm: string;
    recommendations: any[];
    generatedAt: Date;
}>;
export declare const getTrendingRecommendations: (limit?: number) => Promise<any[]>;
export declare const getPersonalizedDailyRecommendations: (userId: string, limit?: number) => Promise<any[]>;
//# sourceMappingURL=recommendation.service.d.ts.map