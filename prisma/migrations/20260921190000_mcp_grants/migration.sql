CREATE TABLE "McpGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "sessionVersion" INTEGER NOT NULL,
  "resource" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "codeHash" TEXT,
  "codeExpiresAt" TIMESTAMP(3),
  "accessHash" TEXT,
  "accessExpiresAt" TIMESTAMP(3),
  "refreshHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "McpGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "McpGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "McpGrant_codeHash_key" ON "McpGrant"("codeHash");
CREATE UNIQUE INDEX "McpGrant_accessHash_key" ON "McpGrant"("accessHash");
CREATE UNIQUE INDEX "McpGrant_refreshHash_key" ON "McpGrant"("refreshHash");
CREATE INDEX "McpGrant_userId_idx" ON "McpGrant"("userId");
CREATE INDEX "McpGrant_expiresAt_idx" ON "McpGrant"("expiresAt");
