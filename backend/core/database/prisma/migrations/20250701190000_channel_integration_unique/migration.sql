-- DropForeignKey
ALTER TABLE "IntegrationCredential" DROP CONSTRAINT "IntegrationCredential_channelId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_channelId_provider_key" ON "IntegrationCredential"("channelId", "provider");

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
