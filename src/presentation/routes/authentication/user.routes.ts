import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  deleteProfile,
} from '../controllers/user.controller';
import { authenticate } from '../../../shared/middleware/auth';
import { validate } from '../../../shared/middleware/validate.middleware';
import { authValidators } from '../validators';

const router = Router();

// All user routes require authentication
router.use(authenticate());

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieve the authenticated user's profile information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User profile retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     firstName:
 *                       type: string
 *                       example: "John"
 *                     lastName:
 *                       type: string
 *                       example: "Doe"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "john.doe@example.com"
 *                     username:
 *                       type: string
 *                       example: "johndoe"
 *                     avatar:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                     role:
 *                       type: string
 *                       enum: [admin, user]
 *                     isEmailVerified:
 *                       type: boolean
 *                     preferences:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Authentication required"
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     summary: Update user profile
 *     description: Update the authenticated user's profile information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.updated@example.com"
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 pattern: "^[a-zA-Z0-9_-]+$"
 *                 example: "johndoe_updated"
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: "Required when changing email or password"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]"
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: "Must match newPassword when changing password"
 *               preferences:
 *                 type: object
 *                 properties:
 *                   theme:
 *                     type: string
 *                     enum: [light, dark, system]
 *                   notifications:
 *                     type: object
 *                     properties:
 *                       email:
 *                         type: boolean
 *                       push:
 *                         type: boolean
 *                       inApp:
 *                         type: boolean
 *                   language:
 *                     type: string
 *                     example: "en"
 *                   timezone:
 *                     type: string
 *                     example: "UTC"
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User profile updated successfully"
 *                 data:
 *                   type: object
 *                   description: "Updated user profile data"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Validation failed"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       message:
 *                         type: string
 *       401:
 *         description: Not authenticated or incorrect current password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Current password is incorrect"
 *       409:
 *         description: Email or username already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email already in use"
 */
router.put('/profile', validate(authValidators.updateProfile), updateProfile);

/**
 * @swagger
 * /api/v1/users/profile:
 *   delete:
 *     summary: Delete user account
 *     description: Permanently delete the authenticated user's account and all associated data
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "Current password for account verification"
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: "Optional reason for account deletion"
 *               transferDataTo:
 *                 type: string
 *                 format: uuid
 *                 description: "Optional user ID to transfer ownership of projects/teams"
 *               deleteAllData:
 *                 type: boolean
 *                 default: false
 *                 description: "Whether to delete all user data or anonymize it"
 *     responses:
 *       200:
 *         description: User account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User account deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *                     transferredItems:
 *                       type: object
 *                       properties:
 *                         projects:
 *                           type: integer
 *                         teams:
 *                           type: integer
 *                         tasks:
 *                           type: integer
 *       400:
 *         description: Validation error or invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Password is required"
 *       401:
 *         description: Not authenticated or incorrect password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Incorrect password"
 *       403:
 *         description: Account deletion not allowed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Cannot delete account with active admin roles"
 */
router.delete(
  '/profile',
  validate(authValidators.deleteProfile),
  deleteProfile
);

export default router;
