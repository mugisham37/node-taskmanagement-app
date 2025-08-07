import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '@/infrastructure/repositories/user-repository';
import { User } from '@/domain/entities/user';
import { Email } from '@/domain/value-objects/email';
import { UserName } from '@/domain/value-objects/user-name';
import { Password } from '@/domain/value-objects/password';
import { UserId } from '@/domain/value-objects/user-id';
import { UserBuilder } from '../../infrastructure/test-data-builders';
import { TestAssertions } from '../../infrastructure/test-assertions';

describe('UserRepository Integration', () => {
  let prisma: PrismaClient;
  let userRepository: UserRepository;

  beforeEach(async () => {
    prisma = globalThis.testContext.clients.prisma!;
    userRepository = new UserRepository(prisma);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({});
  });

  describe('create', () => {
    it('should create and persist a new user', async () => {
      const user = User.create({
        email: Email.create('test@example.com'),
        name: UserName.create('Test User'),
        password: Password.create('SecurePassword123!'),
      });

      const createdUser = await userRepository.create(user);

      expect(createdUser).toBeDefined();
      TestAssertions.assertValidUser(createdUser);
      expect(createdUser.email.value).toBe('test@example.com');
      expect(createdUser.name.value).toBe('Test User');

      // Verify persistence
      const persistedUser = await prisma.user.findUnique({
        where: { id: createdUser.id.value },
      });
      expect(persistedUser).toBeDefined();
      expect(persistedUser!.email).toBe('test@example.com');
    });

    it('should throw error when creating user with duplicate email', async () => {
      const email = 'duplicate@example.com';

      const user1 = User.create({
        email: Email.create(email),
        name: UserName.create('User 1'),
        password: Password.create('Password123!'),
      });

      const user2 = User.create({
        email: Email.create(email),
        name: UserName.create('User 2'),
        password: Password.create('Password456!'),
      });

      await userRepository.create(user1);

      await expect(userRepository.create(user2)).rejects.toThrow();
    });

    it('should handle user with all optional fields', async () => {
      const user = User.create({
        email: Email.create('full@example.com'),
        name: UserName.create('Full User'),
        password: Password.create('SecurePassword123!'),
      });

      // Set optional fields
      user.verifyEmail();
      user.enableMfa('JBSWY3DPEHPK3PXP');
      user.updateTimezone('America/New_York');
      user.updateWorkHours({
        start: '08:00',
        end: '16:00',
        days: [1, 2, 3, 4, 5],
      });

      const createdUser = await userRepository.create(user);

      expect(createdUser.isEmailVerified).toBe(true);
      expect(createdUser.isMfaEnabled).toBe(true);
      expect(createdUser.timezone).toBe('America/New_York');
      expect(createdUser.workHours.start).toBe('08:00');
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const userData = await UserBuilder.create().build();
      await prisma.user.create({ data: userData });

      const foundUser = await userRepository.findById(
        UserId.fromString(userData.id)
      );

      expect(foundUser).toBeDefined();
      TestAssertions.assertValidUser(foundUser!);
      expect(foundUser!.id.value).toBe(userData.id);
      expect(foundUser!.email.value).toBe(userData.email);
    });

    it('should return null for non-existent user', async () => {
      const nonExistentId = UserId.create();

      const foundUser = await userRepository.findById(nonExistentId);

      expect(foundUser).toBeNull();
    });

    it('should properly reconstruct domain entity from persistence', async () => {
      const userData = await UserBuilder.create().withMfaEnabled(true).build();
      await prisma.user.create({ data: userData });

      const foundUser = await userRepository.findById(
        UserId.fromString(userData.id)
      );

      expect(foundUser).toBeDefined();
      expect(foundUser!.isMfaEnabled).toBe(true);
      expect(foundUser!.backupCodes).toHaveLength(10);
      expect(foundUser!.totpSecret).toBeTruthy();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData = await UserBuilder.create()
        .withEmail('findme@example.com')
        .build();
      await prisma.user.create({ data: userData });

      const foundUser = await userRepository.findByEmail(
        Email.create('findme@example.com')
      );

      expect(foundUser).toBeDefined();
      expect(foundUser!.email.value).toBe('findme@example.com');
    });

    it('should return null for non-existent email', async () => {
      const foundUser = await userRepository.findByEmail(
        Email.create('nonexistent@example.com')
      );

      expect(foundUser).toBeNull();
    });

    it('should be case insensitive', async () => {
      const userData = await UserBuilder.create()
        .withEmail('CaseSensitive@Example.Com')
        .build();
      await prisma.user.create({ data: userData });

      const foundUser = await userRepository.findByEmail(
        Email.create('casesensitive@example.com')
      );

      expect(foundUser).toBeDefined();
      expect(foundUser!.email.value).toBe('CaseSensitive@Example.Com');
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const userData = await UserBuilder.create().build();
      await prisma.user.create({ data: userData });

      const user = await userRepository.findById(
        UserId.fromString(userData.id)
      );
      user!.updateTimezone('Europe/London');
      user!.updateRiskScore(0.5);

      const updatedUser = await userRepository.update(user!);

      expect(updatedUser.timezone).toBe('Europe/London');
      expect(updatedUser.riskScore).toBe(0.5);

      // Verify persistence
      const persistedUser = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      expect(persistedUser!.timezone).toBe('Europe/London');
      expect(persistedUser!.riskScore).toBe(0.5);
    });

    it('should handle concurrent updates with optimistic locking', async () => {
      const userData = await UserBuilder.create().build();
      await prisma.user.create({ data: userData });

      const user1 = await userRepository.findById(
        UserId.fromString(userData.id)
      );
      const user2 = await userRepository.findById(
        UserId.fromString(userData.id)
      );

      user1!.updateTimezone('America/New_York');
      user2!.updateTimezone('Europe/London');

      await userRepository.update(user1!);

      // Second update should fail due to version mismatch
      await expect(userRepository.update(user2!)).rejects.toThrow();
    });

    it('should update complex nested objects', async () => {
      const userData = await UserBuilder.create().build();
      await prisma.user.create({ data: userData });

      const user = await userRepository.findById(
        UserId.fromString(userData.id)
      );
      user!.updateWorkspacePreferences('workspace-123', {
        theme: 'dark',
        sidebarCollapsed: true,
      });

      const updatedUser = await userRepository.update(user!);

      expect(updatedUser.workspacePreferences['workspace-123']).toEqual({
        theme: 'dark',
        sidebarCollapsed: true,
      });
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const userData = await UserBuilder.create().build();
      await prisma.user.create({ data: userData });

      const userId = UserId.fromString(userData.id);
      await userRepository.delete(userId);

      const deletedUser = await userRepository.findById(userId);
      expect(deletedUser).toBeNull();
    });

    it('should not throw error when deleting non-existent user', async () => {
      const nonExistentId = UserId.create();

      await expect(userRepository.delete(nonExistentId)).resolves.not.toThrow();
    });
  });

  describe('findMany', () => {
    beforeEach(async () => {
      // Create test users
      const users = await Promise.all([
        UserBuilder.create()
          .withName('Alice')
          .withEmail('alice@example.com')
          .build(),
        UserBuilder.create()
          .withName('Bob')
          .withEmail('bob@example.com')
          .build(),
        UserBuilder.create()
          .withName('Charlie')
          .withEmail('charlie@example.com')
          .build(),
      ]);

      await prisma.user.createMany({ data: users });
    });

    it('should find all users without filters', async () => {
      const users = await userRepository.findMany({});

      expect(users).toHaveLength(3);
      users.forEach(user => TestAssertions.assertValidUser(user));
    });

    it('should find users with email filter', async () => {
      const users = await userRepository.findMany({
        email: 'alice@example.com',
      });

      expect(users).toHaveLength(1);
      expect(users[0].email.value).toBe('alice@example.com');
    });

    it('should find users with name search', async () => {
      const users = await userRepository.findMany({
        nameContains: 'Bob',
      });

      expect(users).toHaveLength(1);
      expect(users[0].name.value).toBe('Bob');
    });

    it('should support pagination', async () => {
      const firstPage = await userRepository.findMany({
        limit: 2,
        offset: 0,
      });

      const secondPage = await userRepository.findMany({
        limit: 2,
        offset: 2,
      });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);

      // Ensure no overlap
      const firstPageIds = firstPage.map(u => u.id.value);
      const secondPageIds = secondPage.map(u => u.id.value);
      expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));
    });

    it('should support sorting', async () => {
      const usersAsc = await userRepository.findMany({
        orderBy: { field: 'name', direction: 'asc' },
      });

      const usersDesc = await userRepository.findMany({
        orderBy: { field: 'name', direction: 'desc' },
      });

      expect(usersAsc[0].name.value).toBe('Alice');
      expect(usersAsc[2].name.value).toBe('Charlie');

      expect(usersDesc[0].name.value).toBe('Charlie');
      expect(usersDesc[2].name.value).toBe('Alice');
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      const users = await Promise.all([
        UserBuilder.create().withEmail('user1@example.com').build(),
        UserBuilder.create().withEmail('user2@example.com').build(),
        UserBuilder.create().withEmail('user3@example.com').build(),
      ]);

      await prisma.user.createMany({ data: users });
    });

    it('should count all users', async () => {
      const count = await userRepository.count({});

      expect(count).toBe(3);
    });

    it('should count users with filters', async () => {
      const count = await userRepository.count({
        email: 'user1@example.com',
      });

      expect(count).toBe(1);
    });
  });

  describe('transaction support', () => {
    it('should support database transactions', async () => {
      const user1 = User.create({
        email: Email.create('tx1@example.com'),
        name: UserName.create('TX User 1'),
        password: Password.create('Password123!'),
      });

      const user2 = User.create({
        email: Email.create('tx2@example.com'),
        name: UserName.create('TX User 2'),
        password: Password.create('Password123!'),
      });

      await prisma.$transaction(async tx => {
        const txUserRepository = new UserRepository(tx);

        await txUserRepository.create(user1);
        await txUserRepository.create(user2);
      });

      const users = await userRepository.findMany({});
      expect(users).toHaveLength(2);
    });

    it('should rollback transaction on error', async () => {
      const user1 = User.create({
        email: Email.create('rollback1@example.com'),
        name: UserName.create('Rollback User 1'),
        password: Password.create('Password123!'),
      });

      const user2 = User.create({
        email: Email.create('rollback1@example.com'), // Duplicate email
        name: UserName.create('Rollback User 2'),
        password: Password.create('Password123!'),
      });

      await expect(
        prisma.$transaction(async tx => {
          const txUserRepository = new UserRepository(tx);

          await txUserRepository.create(user1);
          await txUserRepository.create(user2); // This should fail
        })
      ).rejects.toThrow();

      // Verify no users were created
      const users = await userRepository.findMany({});
      expect(users).toHaveLength(0);
    });
  });

  describe('performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();

      // Create 100 users
      const users = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          UserBuilder.create()
            .withEmail(`bulk${i}@example.com`)
            .withName(`Bulk User ${i}`)
            .build()
        )
      );

      await prisma.user.createMany({ data: users });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify all users were created
      const count = await userRepository.count({});
      expect(count).toBe(100);
    });

    it('should use database indexes for efficient queries', async () => {
      // Create users with various emails
      const users = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          UserBuilder.create().withEmail(`indexed${i}@example.com`).build()
        )
      );

      await prisma.user.createMany({ data: users });

      const startTime = Date.now();

      // Query by email (should use index)
      await userRepository.findByEmail(Email.create('indexed25@example.com'));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be very fast with proper indexing
      expect(duration).toBeLessThan(100); // 100ms
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate connection error by using invalid client
      const invalidPrisma = new PrismaClient({
        datasources: {
          db: {
            url: 'postgresql://invalid:invalid@localhost:9999/invalid',
          },
        },
      });

      const invalidRepository = new UserRepository(invalidPrisma);
      const user = User.create({
        email: Email.create('error@example.com'),
        name: UserName.create('Error User'),
        password: Password.create('Password123!'),
      });

      await expect(invalidRepository.create(user)).rejects.toThrow();
    });

    it('should handle constraint violations properly', async () => {
      const userData = await UserBuilder.create()
        .withEmail('constraint@example.com')
        .build();

      await prisma.user.create({ data: userData });

      const duplicateUser = User.create({
        email: Email.create('constraint@example.com'),
        name: UserName.create('Duplicate User'),
        password: Password.create('Password123!'),
      });

      await expect(userRepository.create(duplicateUser)).rejects.toThrow();
    });
  });
});
