import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'admin',
  brokers: ['localhost:9092']
});

const admin = kafka.admin();

const run = async () => {
  await admin.connect();
  const created = await admin.createTopics({
    topics: [{ topic: 'trade.settlement', numPartitions: 1 }]
  });
  console.log('Topic created:', created);
  await admin.disconnect();
};

run().then(() => console.log('done')).catch(console.error);
