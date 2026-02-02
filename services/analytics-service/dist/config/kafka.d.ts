import { Kafka } from 'kafkajs';
export declare const kafka: Kafka;
export declare const kafkaConsumer: import("kafkajs").Consumer;
export declare const kafkaProducer: import("kafkajs").Producer;
export declare const connectKafkaProducer: () => Promise<void>;
export declare const disconnectKafkaProducer: () => Promise<void>;
export declare const connectKafkaConsumer: () => Promise<void>;
export declare const disconnectKafkaConsumer: () => Promise<void>;
//# sourceMappingURL=kafka.d.ts.map