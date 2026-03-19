import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "consumer-settlement",
  brokers: ["localhost:9092"],
});

export const consumer = kafka.consumer({
  groupId: "trade.settlement",
});
