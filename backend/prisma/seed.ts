import 'dotenv/config';
import { PrismaClient, AssetCategory, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
const assets: Array<{ assetTag: string; name: string; category: AssetCategory; totalQuantity: number; description: string }> = [
  { assetTag: 'JHUB-COM-001', name: 'Raspberry Pi 4', category: AssetCategory.COMPUTING_PERIPHERALS, totalQuantity: 10, description: 'Single-board computer for edge projects.' },
  { assetTag: 'JHUB-COM-002', name: 'USB-C Docking Station', category: AssetCategory.COMPUTING_PERIPHERALS, totalQuantity: 8, description: 'Multi-port docking station for shared workstations.' },
  { assetTag: 'JHUB-IOT-001', name: 'ESP32 Development Board', category: AssetCategory.IOT_PROTOTYPING, totalQuantity: 20, description: 'Wi-Fi and Bluetooth development board.' },
  { assetTag: 'JHUB-IOT-002', name: 'Arduino Uno R3', category: AssetCategory.IOT_PROTOTYPING, totalQuantity: 18, description: 'Microcontroller platform for rapid prototyping.' },
  { assetTag: 'JHUB-IOT-003', name: 'Ultrasonic Sensor', category: AssetCategory.IOT_PROTOTYPING, totalQuantity: 30, description: 'Distance sensor for embedded projects.' },
  { assetTag: 'JHUB-NET-001', name: 'TP-Link Dual Band Router', category: AssetCategory.NETWORKING_INFRASTRUCTURE, totalQuantity: 8, description: 'Wireless networking equipment.' },
  { assetTag: 'JHUB-NET-002', name: '8-Port Network Switch', category: AssetCategory.NETWORKING_INFRASTRUCTURE, totalQuantity: 6, description: 'Compact managed switch for prototyping network layouts.' },
  { assetTag: 'JHUB-AV-001', name: 'Logitech HD Webcam', category: AssetCategory.AV_PRESENTATION, totalQuantity: 8, description: 'HD webcam for demonstrations.' },
  { assetTag: 'JHUB-AV-002', name: 'Portable Projector', category: AssetCategory.AV_PRESENTATION, totalQuantity: 4, description: 'Compact projector for demonstrations and presentations.' },
  { assetTag: 'JHUB-OFF-001', name: 'Digital Caliper', category: AssetCategory.OFFICE_SUPPLIES, totalQuantity: 10, description: 'Precision caliper for workshop measurements.' },
  { assetTag: 'JHUB-OFF-002', name: 'Precision Toolkit', category: AssetCategory.OFFICE_SUPPLIES, totalQuantity: 6, description: 'Hand tools for electronics assembly and maintenance.' },
  { assetTag: 'JHUB-FUR-001', name: 'ESD Workbench', category: AssetCategory.FURNITURE, totalQuantity: 3, description: 'Anti-static workbench for safe electronics assembly.' },
  { assetTag: 'JHUB-FUR-002', name: 'Adjustable Lab Desk', category: AssetCategory.FURNITURE, totalQuantity: 5, description: 'Adjustable desk for collaborative lab work.' }
];
async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  await prisma.user.upsert({ where: { email: 'admin@jhubafrica.example' }, update: {}, create: { fullName: 'Vault Administrator', email: 'admin@jhubafrica.example', passwordHash, phoneNumber: '+254700000001', identificationId: 'ADMIN-001', department: 'JHUB Africa', role: Role.ADMIN } });
  await prisma.user.upsert({ where: { email: 'innovator@jhubafrica.example' }, update: {}, create: { fullName: 'Demo Innovator', email: 'innovator@jhubafrica.example', passwordHash, phoneNumber: '+254700000002', identificationId: 'INNOVATOR-001', department: 'Innovation and Technology', role: Role.INNOVATOR } });
  for (const asset of assets) await prisma.asset.upsert({ where: { assetTag: asset.assetTag }, update: { totalQuantity: asset.totalQuantity, availableQty: asset.totalQuantity }, create: { ...asset, availableQty: asset.totalQuantity, specifications: {} } });
}
main().finally(() => prisma.$disconnect());
