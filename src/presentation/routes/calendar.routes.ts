import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import * as calendarController from "../controllers/calendar.controller"
import { calendarValidators } from "../validators"
import { Router, Request, Response } from 'express';
import { google } from 'googleapis';

const router = express.Router()

// Apply authentication middleware to all routes
router.use(authenticate())

/**
 * @swagger
 * /calendar/events:
 *   post:
 *     summary: Create a new calendar event
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - startDate
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               allDay:
 *                 type: boolean
 *               location:
 *                 type: string
 *               url:
 *                 type: string
 *               color:
 *                 type: string
 *               taskId:
 *                 type: string
 *                 format: uuid
 *               projectId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Calendar event created successfully
 */
router.post("/events", validate(calendarValidators.createCalendarEvent), calendarController.createCalendarEvent)

/**
 * @swagger
 * /calendar/events:
 *   get:
 *     summary: Get all calendar events for the authenticated user
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Calendar events retrieved successfully
 */
router.get("/events", calendarController.getCalendarEvents)

/**
 * @swagger
 * /calendar/events/{id}:
 *   get:
 *     summary: Get a calendar event by ID
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Calendar event retrieved successfully
 *       404:
 *         description: Calendar event not found
 */
router.get("/events/:id", calendarController.getCalendarEventById)

/**
 * @swagger
 * /calendar/events/{id}:
 *   put:
 *     summary: Update a calendar event
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               allDay:
 *                 type: boolean
 *               location:
 *                 type: string
 *               url:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Calendar event updated successfully
 *       404:
 *         description: Calendar event not found
 */
router.put("/events/:id", validate(calendarValidators.updateCalendarEvent), calendarController.updateCalendarEvent)

/**
 * @swagger
 * /calendar/events/{id}:
 *   delete:
 *     summary: Delete a calendar event
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Calendar event deleted successfully
 *       404:
 *         description: Calendar event not found
 */
router.delete("/events/:id", calendarController.deleteCalendarEvent)

/**
 * @swagger
 * /calendar/events/{id}/respond:
 *   patch:
 *     summary: Respond to a calendar event invitation
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, declined, tentative]
 *     responses:
 *       200:
 *         description: Event invitation response recorded successfully
 *       404:
 *         description: Calendar event not found
 */
// Note: respondToEventInvitation functionality not yet implemented
// router.patch(
//   "/events/:id/respond",
//   validate(calendarValidators.respondToEventInvitation),
//   calendarController.respondToEventInvitation,
// )

router.get('/sync/google', authenticate(), async (req: Request, res: Response) => {
    try {
        // Get user's tokens from DB (assume req.user has tokens)
        const { googleAccessToken, googleRefreshToken } = req.user;
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        oauth2Client.setCredentials({
            access_token: googleAccessToken,
            refresh_token: googleRefreshToken,
        });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const events = await calendar.events.list({
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime',
        });
        // Normalize and store events in your DB, mark as external
        // For demo, just return normalized events
        const normalized = (events.data.items || []).map(e => ({
            id: e.id,
            title: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            external: true,
            source: 'google',
        }));
        res.json({ events: normalized });
    } catch (err) {
        res.status(500).json({ error: 'Failed to sync Google Calendar events.' });
    }
});

export default router
