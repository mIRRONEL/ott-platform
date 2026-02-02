import { Kafka } from 'kafkajs';
declare const kafka: Kafka;
export declare let producer: import("kafkajs").Producer;
export declare function connectKafka(): Promise<void>;
export declare function disconnectKafka(): Promise<void>;
export default kafka;
//# sourceMappingURL=producer.d.ts.map