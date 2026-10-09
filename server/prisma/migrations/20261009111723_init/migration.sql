-- CreateEnum
CREATE TYPE "Role" AS ENUM ('analyst', 'admin');

-- CreateEnum
CREATE TYPE "TxnType" AS ENUM ('cash_in', 'cash_out', 'transfer', 'airtime', 'payment');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('approved', 'declined', 'pending');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('new', 'under_review', 'resolved');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('confirmed_fraud', 'false_positive', 'needs_info');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'analyst',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "txn_type" "TxnType" NOT NULL,
    "merchant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timestamp" TIMESTAMP(0) NOT NULL,
    "device_id" TEXT NOT NULL,
    "sender_msisdn" TEXT NOT NULL,
    "recipient_msisdn" TEXT,
    "agent_id" TEXT,
    "risk_score" INTEGER NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "status" "TxStatus" NOT NULL,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_reasons" (
    "id" SERIAL NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "fraud_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "analyst_id" UUID NOT NULL,
    "decision" "Decision" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "detail" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "transactions_account_id_timestamp_idx" ON "transactions"("account_id", "timestamp");

-- CreateIndex
CREATE INDEX "transactions_review_status_risk_score_idx" ON "transactions"("review_status", "risk_score");

-- CreateIndex
CREATE INDEX "fraud_reasons_transaction_id_idx" ON "fraud_reasons"("transaction_id");

-- CreateIndex
CREATE INDEX "decisions_transaction_id_decided_at_idx" ON "decisions"("transaction_id", "decided_at");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "fraud_reasons" ADD CONSTRAINT "fraud_reasons_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_analyst_id_fkey" FOREIGN KEY ("analyst_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
