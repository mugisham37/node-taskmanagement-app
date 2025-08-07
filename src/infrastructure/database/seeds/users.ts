import { prisma } from '../prisma-client';
import { User } from '@prisma/client';
import argon2 from 'argon2';

export async function seedUsers(): Promise<User[]> {
  const users: User[] = [];

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: await argon2.hash('admin123'),
      emailVerified: new Date(),
      mfaEnabled: false,
      timezone: 'UTC',
      avatarColor: '#3B82F6',
    },
  });
  users.push(adminUser);

  // Create demo users
  const demoUsers = [
    {
      email: 'john.doe@example.com',
      name: 'John Doe',
      avatarColor: '#10B981',
    },
    {
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      avatarColor: '#F59E0B',
    },
    {
      email: 'mike.johnson@example.com',
      name: 'Mike Johnson',
      avatarColor: '#EF4444',
    },
    {
      email: 'sarah.wilson@example.com',
      name: 'Sarah Wilson',
      avatarColor: '#8B5CF6',
    },
  ];

  for (const userData of demoUsers) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        passwordHash: await argon2.hash('demo123'),
        emailVerified: new Date(),
        timezone: 'UTC',
      },
    });
    users.push(user);
  }

  return users;
}
