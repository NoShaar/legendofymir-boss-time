-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "states" JSONB NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);
