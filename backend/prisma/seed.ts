import 'dotenv/config';
import { PrismaClient, AssetCategory, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
const assets: Array<{ assetTag: string; name: string; category: AssetCategory; totalQuantity: number; description: string }> = [
  { assetTag: 'JHUB-IOT-001', name: 'ESP32 Development Board', category: AssetCategory.IOT_PROTOTYPING, totalQuantity: 20, description: 'Wi-Fi and Bluetooth development board.' },
  { assetTag: 'JHUB-IOT-002', name: 'Arduino Uno R3', category: AssetCategory.IOT_PROTOTYPING, totalQuantity: 18, description: 'Microcontroller platform for rapid prototyping.' },
  { assetTag: 'JHUB-IOT-003', name: 'Ultrasonic Sensor', category: AssetCategory.IOT_PROTOTYPING, totalQuantity: 30, description: 'Distance sensor for embedded projects.' },
  { assetTag: 'JHUB-NET-001', name: 'TP-Link Dual Band Router', category: AssetCategory.NETWORKING_INFRASTRUCTURE, totalQuantity: 8, description: 'Wireless networking equipment.' },
  { assetTag: 'JHUB-COM-001', name: 'Raspberry Pi 4', category: AssetCategory.COMPUTING_PERIPHERALS, totalQuantity: 10, description: 'Single-board computer for edge projects.' },
  { assetTag: 'JHUB-AV-001', name: 'Logitech HD Webcam', category: AssetCategory.AV_PRESENTATION, totalQuantity: 8, description: 'HD webcam for demonstrations.' }
];
async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  await prisma.user.upsert({ where: { email: 'admin@jhubafrica.example' }, update: {}, create: { fullName: 'Vault Administrator', email: 'admin@jhubafrica.example', passwordHash, phoneNumber: '+254700000001', identificationId: 'ADMIN-001', department: 'JHUB Africa', role: Role.ADMIN } });
  await prisma.user.upsert({ where: { email: 'innovator@jhubafrica.example' }, update: {}, create: { fullName: 'Demo Innovator', email: 'innovator@jhubafrica.example', passwordHash, phoneNumber: '+254700000002', identificationId: 'INNOVATOR-001', department: 'Innovation and Technology', role: Role.INNOVATOR } });
  for (const asset of assets) await prisma.asset.upsert({ where: { assetTag: asset.assetTag }, update: { totalQuantity: asset.totalQuantity, availableQty: asset.totalQuantity }, create: { ...asset, availableQty: asset.totalQuantity, specifications: {} } });
}
main().finally(() => prisma.$disconnect());
