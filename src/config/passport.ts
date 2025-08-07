import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../db/repositories/user.repository';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_REDIRECT_URI!,
},
    async (accessToken, refreshToken, profile, done) => {
        // Find or create user, store tokens in DB
        let user = await User.findOrCreateByGoogleProfile(profile, accessToken, refreshToken);
        return done(null, user);
    }));

export default passport; 