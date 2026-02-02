import { Pool } from 'pg';
import { Db } from 'mongodb';
export declare const setDatabases: (pool: Pool, db: Db) => void;
interface UserEvent {
    userId: string;
    eventType: string;
    contentId: string | null;
    metadata: Record<string, any>;
    timestamp: Date;
    sessionId: string | null;
}
interface DashboardMetrics {
    userId: string;
    totalWatchTime: number;
    contentWatched: number;
    categoriesWatched: string[];
    favoriteCategories: {
        category: string;
        count: number;
    }[];
    watchHistory: Array<{
        contentId: string;
        title: string;
        watchedAt: Date;
    }>;
    continuationData: Array<{
        contentId: string;
        title: string;
        lastPosition: number;
    }>;
    metrics: {
        avgRating: number;
        contentRated: number;
        reviewsWritten: number;
    };
}
export declare const getUserDashboard: (userId: string, startDate?: Date, endDate?: Date, period?: string) => Promise<DashboardMetrics>;
export declare const getTrendingContent: (category?: string, limit?: number, period?: string, sortBy?: string) => Promise<any[]>;
export declare const getContentPerformance: (contentId: string, startDate?: Date, endDate?: Date) => Promise<any | null>;
export declare const getEngagementMetrics: (contentId: string, metric?: string) => Promise<any | null>;
export declare const storeEvent: (event: UserEvent) => Promise<void>;
export {};
//# sourceMappingURL=analytics.service.d.ts.map