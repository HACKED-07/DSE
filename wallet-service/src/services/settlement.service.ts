import { consumer } from "../consumer";
import prisma from "../lib/prisma";
import { Reason } from "../src/generated/prisma/enums";

export const startBackgroundSettler = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "trade.settlement", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const settlementData = JSON.parse(message.value.toString());
      const ref = settlementData.ref;

      try {
        await prisma.$transaction(async (tx) => {
          // check if trade has already been executed
          const trade = await tx.ledger.findFirst({
            where: { ref },
          });

          if (trade) {
            console.log(`Trade ${ref} already settled, skipping.`);
            return;
          }

          const { buyer, seller } = settlementData;

          // check if the buyer lock exists
          const buyerLock = await tx.lock.findFirst({
            where: { ref: buyer.ref },
          });

          if (!buyerLock || Number(buyerLock.amount) < buyer.amount) {
            throw new Error(`Invalid buyer lock: ${buyer.ref}`);
          }

          // check if the seller lock exists
          const sellerLock = await tx.lock.findFirst({
            where: { ref: seller.ref },
          });

          if (!sellerLock || Number(sellerLock.amount) < seller.amount) {
            throw new Error(`Invalid seller lock: ${seller.ref}`);
          }

          // 1. Debit Seller
          await tx.ledger.create({
            data: {
              userId: seller.id,
              asset: seller.asset,
              change: `-${seller.amount}`,
              reason: Reason.TRADE,
              ref: seller.ref,
            },
          });

          // 2. Debit Buyer
          await tx.ledger.create({
            data: {
              userId: buyer.id,
              asset: buyer.asset,
              change: `-${buyer.amount}`,
              reason: Reason.TRADE,
              ref: buyer.ref,
            },
          });

          // 3. Credit Seller (Buyer's Asset)
          await tx.ledger.create({
            data: {
              userId: seller.id,
              asset: buyer.asset,
              change: `${buyer.amount}`,
              reason: Reason.TRADE,
              ref: ref,
            },
          });

          // 4. Credit Buyer (Seller's Asset)
          await tx.ledger.create({
            data: {
              userId: buyer.id,
              asset: seller.asset,
              change: `${seller.amount}`,
              reason: Reason.TRADE,
              ref: ref,
            },
          });

          // Update/Delete Buyer Lock
          const updatedBuyerAmount = Number(buyerLock.amount) - buyer.amount;
          if (updatedBuyerAmount <= 0) {
            await tx.lock.delete({ where: { ref: buyer.ref } });
          } else {
            await tx.lock.update({
              where: { ref: buyer.ref, id: buyerLock.id },
              data: { amount: String(updatedBuyerAmount) },
            });
          }

          // Update/Delete Seller Lock
          const updatedSellerAmount = Number(sellerLock.amount) - seller.amount;
          if (updatedSellerAmount <= 0) {
            await tx.lock.delete({ where: { ref: seller.ref } });
          } else {
            await tx.lock.update({
              where: { ref: seller.ref, id: sellerLock.id },
              data: { amount: String(updatedSellerAmount) },
            });
          }
        });

        console.log(`Successfully settled trade: ${ref}`);
      } catch (e: any) {
        console.error(`Failed to settle trade ${ref}:`, e.message);
      }
    },
  });
};

export const settleTrade = async (buyer: any, seller: any, ref: string) => {
  await prisma.$transaction(async (tx) => {
    const trade = await tx.ledger.findFirst({
      where: { ref },
    });
    if (trade) throw new Error("Trade already settled");

    const buyerLock = await tx.lock.findFirst({
      where: { userId: buyer.id, ref: buyer.ref },
    });
    if (!buyerLock || Number(buyerLock.amount) < buyer.amount) {
      throw new Error("Invalid buyer lock");
    }
    if (buyerLock.asset !== buyer.asset) {
      throw new Error("Invalid buyer asset");
    }

    const sellerLock = await tx.lock.findFirst({
      where: { userId: seller.id, ref: seller.ref },
    });
    if (!sellerLock || Number(sellerLock.amount) < seller.amount) {
      throw new Error("Invalid seller lock");
    }
    if (sellerLock.asset !== seller.asset) {
      throw new Error("Invalid seller asset");
    }

    await tx.ledger.create({
      data: {
        userId: seller.id,
        asset: seller.asset,
        change: `-${seller.amount}`,
        reason: Reason.TRADE,
        ref: seller.ref,
      },
    });

    await tx.ledger.create({
      data: {
        userId: buyer.id,
        asset: buyer.asset,
        change: `-${buyer.amount}`,
        reason: Reason.TRADE,
        ref: buyer.ref,
      },
    });

    await tx.ledger.create({
      data: {
        userId: seller.id,
        asset: buyer.asset,
        change: `${buyer.amount}`,
        reason: Reason.TRADE,
        ref: ref,
      },
    });

    await tx.ledger.create({
      data: {
        userId: buyer.id,
        asset: seller.asset,
        change: `${seller.amount}`,
        reason: Reason.TRADE,
        ref: ref,
      },
    });

    const updatedBuyerLock = Number(buyerLock.amount) - buyer.amount;
    if (updatedBuyerLock === 0) {
      await tx.lock.delete({
        where: { id: buyerLock.id },
      });
    } else {
      await tx.lock.update({
        where: { id: buyerLock.id },
        data: { amount: String(updatedBuyerLock) },
      });
    }

    const updatedSellerLock = Number(sellerLock.amount) - seller.amount;
    if (updatedSellerLock === 0) {
      await tx.lock.delete({
        where: { id: sellerLock.id },
      });
    } else {
      await tx.lock.update({
        where: { id: sellerLock.id },
        data: { amount: String(updatedSellerLock) },
      });
    }
  });
};

