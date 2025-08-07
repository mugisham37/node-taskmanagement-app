import { prisma } from '../prisma-client';
import { User } from '@prisma/client';
import argon2 from 'argon2';
import { faker } from '@faker-js/faker';

export async function seedUsers(): Promise<User[]> {
  const users: User[] = [];

  // Create admin user with comprehensive profile
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: await argon2.hash('admin123'),
      emailVerified: new Date(),
      mfaEnabled: true,
      timezone: 'UTC',
      avatarColor: '#3B82F6',
      workHours: {
        start: '08:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5], // Monday to Friday
      },
      taskViewPreferences: {
        defaultView: 'kanban',
        groupBy: 'status',
        sortBy: 'priority',
        showCompleted: false,
      },
      notificationSettings: {
        email: true,
        push: true,
        desktop: true,
        taskAssigned: true,
        taskDue: true,
        mentions: true,
        projectUpdates: true,
      },
      productivitySettings: {
        pomodoroLength: 25,
        breakLength: 5,
        longBreakLength: 15,
        dailyGoal: 8,
      },
      lastLoginAt: new Date(),
      lastLoginIp: '192.168.1.1',
    },
  });
  users.push(adminUser);

  // Create realistic demo users with varied profiles
  const demoUsersData = [
    {
      email: 'john.doe@example.com',
      name: 'John Doe',
      avatarColor: '#10B981',
      timezone: 'America/New_York',
      role: 'Product Manager',
      workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
    },
    {
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      avatarColor: '#F59E0B',
      timezone: 'Europe/London',
      role: 'Senior Developer',
      workHours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] },
    },
    {
      email: 'mike.johnson@example.com',
      name: 'Mike Johnson',
      avatarColor: '#EF4444',
      timezone: 'America/Los_Angeles',
      role: 'UX Designer',
      workHours: { start: '10:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    },
    {
      email: 'sarah.wilson@example.com',
      name: 'Sarah Wilson',
      avatarColor: '#8B5CF6',
      timezone: 'Australia/Sydney',
      role: 'QA Engineer',
      workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
    },
    {
      email: 'alex.chen@example.com',
      name: 'Alex Chen',
      avatarColor: '#06B6D4',
      timezone: 'Asia/Tokyo',
      role: 'DevOps Engineer',
      workHours: { start: '09:30', end: '18:30', days: [1, 2, 3, 4, 5] },
    },
    {
      email: 'maria.garcia@example.com',
      name: 'Maria Garcia',
      avatarColor: '#84CC16',
      timezone: 'Europe/Madrid',
      role: 'Business Analyst',
      workHours: { start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5] },
    },
    {
      email: 'david.brown@example.com',
      name: 'David Brown',
      avatarColor: '#F97316',
      timezone: 'America/Chicago',
      role: 'Frontend Developer',
      workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
    },
    {
      email: 'lisa.taylor@example.com',
      name: 'Lisa Taylor',
      avatarColor: '#EC4899',
      timezone: 'America/Denver',
      role: 'Project Coordinator',
      workHours: { start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5] },
    },
  ];

  for (const userData of demoUsersData) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash: await argon2.hash('demo123'),
        emailVerified: faker.date.past({ years: 1 }),
        timezone: userData.timezone,
        avatarColor: userData.avatarColor,
        workHours: userData.workHours,
        taskViewPreferences: {
          defaultView: faker.helpers.arrayElement([
            'list',
            'kanban',
            'calendar',
          ]),
          groupBy: faker.helpers.arrayElement([
            'status',
            'priority',
            'assignee',
          ]),
          sortBy: faker.helpers.arrayElement([
            'dueDate',
            'priority',
            'created',
          ]),
          showCompleted: faker.datatype.boolean(),
        },
        notificationSettings: {
          email: faker.datatype.boolean({ probability: 0.8 }),
          push: faker.datatype.boolean({ probability: 0.7 }),
          desktop: faker.datatype.boolean({ probability: 0.6 }),
          taskAssigned: true,
          taskDue: faker.datatype.boolean({ probability: 0.9 }),
          mentions: true,
          projectUpdates: faker.datatype.boolean({ probability: 0.7 }),
        },
        productivitySettings: {
          pomodoroLength: faker.helpers.arrayElement([20, 25, 30]),
          breakLength: faker.helpers.arrayElement([5, 10, 15]),
          longBreakLength: faker.helpers.arrayElement([15, 20, 30]),
          dailyGoal: faker.helpers.arrayElement([6, 7, 8, 9]),
        },
        lastLoginAt: faker.date.recent({ days: 7 }),
        lastLoginIp: faker.internet.ip(),
        failedLoginAttempts: faker.helpers.arrayElement([0, 0, 0, 1, 2]), // Mostly 0
        riskScore: faker.number.float({ min: 0, max: 2, fractionDigits: 1 }),
      },
    });
    users.push(user);
  }

  // Create additional users for load testing
  const additionalUsers = [];
  for (let i = 0; i < 20; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({
      firstName,
      lastName,
      provider: 'example.com',
    });

    additionalUsers.push({
      email,
      name: `${firstName} ${lastName}`,
      passwordHash: await argon2.hash('demo123'),
      emailVerified: faker.datatype.boolean({ probability: 0.8 })
        ? faker.date.past({ years: 1 })
        : null,
      timezone: faker.location.timeZone(),
      avatarColor: faker.internet.color(),
      workHours: {
        start: faker.helpers.arrayElement(['08:00', '08:30', '09:00', '09:30']),
        end: faker.helpers.arrayElement([
          '16:00',
          '16:30',
          '17:00',
          '17:30',
          '18:00',
        ]),
        days: faker.helpers.arrayElement([
          [1, 2, 3, 4, 5], // Monday to Friday
          [1, 2, 3, 4, 5, 6], // Monday to Saturday
          [2, 3, 4, 5, 6], // Tuesday to Saturday
        ]),
      },
      taskViewPreferences: {
        defaultView: faker.helpers.arrayElement([
          'list',
          'kanban',
          'calendar',
          'timeline',
        ]),
        groupBy: faker.helpers.arrayElement([
          'status',
          'priority',
          'assignee',
          'project',
        ]),
        sortBy: faker.helpers.arrayElement([
          'dueDate',
          'priority',
          'created',
          'updated',
        ]),
        showCompleted: faker.datatype.boolean(),
      },
      notificationSettings: {
        email: faker.datatype.boolean({ probability: 0.7 }),
        push: faker.datatype.boolean({ probability: 0.6 }),
        desktop: faker.datatype.boolean({ probability: 0.5 }),
        taskAssigned: faker.datatype.boolean({ probability: 0.9 }),
        taskDue: faker.datatype.boolean({ probability: 0.8 }),
        mentions: faker.datatype.boolean({ probability: 0.9 }),
        projectUpdates: faker.datatype.boolean({ probability: 0.6 }),
      },
      productivitySettings: {
        pomodoroLength: faker.helpers.arrayElement([15, 20, 25, 30, 45]),
        breakLength: faker.helpers.arrayElement([5, 10, 15]),
        longBreakLength: faker.helpers.arrayElement([15, 20, 30]),
        dailyGoal: faker.helpers.arrayElement([4, 6, 7, 8, 9, 10]),
      },
      lastLoginAt: faker.datatype.boolean({ probability: 0.7 })
        ? faker.date.recent({ days: 30 })
        : null,
      lastLoginIp: faker.internet.ip(),
      failedLoginAttempts: faker.helpers.weightedArrayElement([
        { weight: 80, value: 0 },
        { weight: 15, value: 1 },
        { weight: 4, value: 2 },
        { weight: 1, value: 3 },
      ]),
      riskScore: faker.number.float({ min: 0, max: 5, fractionDigits: 1 }),
    });
  }

  // Batch create additional users for better performance
  const createdAdditionalUsers = await prisma.user.createMany({
    data: additionalUsers,
  });

  // Fetch the created users to return them
  const allCreatedUsers = await prisma.user.findMany({
    where: {
      email: {
        in: additionalUsers.map(u => u.email),
      },
    },
  });

  users.push(...allCreatedUsers);

  return users;
}
