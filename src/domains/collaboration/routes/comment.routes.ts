import express from 'express';
import { validate } from '../../../shared/middleware/validate.middleware';
import { authenticate } from '../../../shared/middleware/auth';
import { commentValidators } from '../validators/comment.validator';
import * as commentController from '../controllers/comment.controller';
import { upload } from '../../../shared/middleware/upload.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate());

// Get a comment by ID
router.get(
  '/:id',
  validate(commentValidators.getComment),
  commentController.getComment
);

// Update a comment
router.put(
  '/:id',
  validate(commentValidators.updateComment),
  commentController.updateComment
);

// Delete a comment
router.delete(
  '/:id',
  validate(commentValidators.deleteComment),
  commentController.deleteComment
);

// Add attachment to a comment
router.post(
  '/:id/attachments',
  validate(commentValidators.addCommentAttachment),
  upload.single('attachment'),
  commentController.addCommentAttachment
);

// Remove attachment from a comment
router.delete(
  '/:id/attachments/:attachmentId',
  validate(commentValidators.removeCommentAttachment),
  commentController.removeCommentAttachment
);

export default router;
