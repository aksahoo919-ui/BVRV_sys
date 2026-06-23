import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import { defaultUsername } from '../utils/password.js';
import dotenv from 'dotenv';

dotenv.config();

passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;
        const avatarUrl = profile.photos?.[0]?.value || null;

        let result = await query(
          'SELECT * FROM users WHERE google_id = $1 OR email = $2',
          [googleId, email]
        );
        let user = result.rows[0];

        if (user) {
          if (!user.google_id) {
            await query(
              'UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3',
              [googleId, avatarUrl, user.id]
            );
          }
          // Always fetch fresh data to get latest status/role
          const freshResult = await query(
            'SELECT * FROM users WHERE id = $1',
            [user.id]
          );
          return done(null, freshResult.rows[0]);
        }

        // New user — create with pending status
        const newId = uuidv4();
        const insertResult = await query(
          `INSERT INTO users (id, google_id, name, email, avatar_url, role, status, username)
           VALUES ($1, $2, $3, $4, $5, NULL, 'pending', $6) RETURNING *`,
          [newId, googleId, name, email, avatarUrl, defaultUsername(email, name)]
        );
        return done(null, insertResult.rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  'google-admin',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_ADMIN_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;
        const avatarUrl = profile.photos?.[0]?.value || null;

        if (email !== process.env.ADMIN_GMAIL) {
          return done(null, false, { message: 'Not authorized as admin' });
        }

        let result = await query('SELECT * FROM users WHERE email = $1', [email]);
        let user = result.rows[0];

        if (!user) {
          const newId = uuidv4();
          const insertResult = await query(
            `INSERT INTO users (id, google_id, name, email, avatar_url, role, status, username)
             VALUES ($1, $2, $3, $4, $5, 'admin', 'active', $6) RETURNING *`,
            [newId, googleId, name, email, avatarUrl, defaultUsername(email, name)]
          );
          user = insertResult.rows[0];
        } else {
          if (!user.google_id) {
            await query('UPDATE users SET google_id=$1, avatar_url=$2 WHERE id=$3', [
              googleId,
              avatarUrl,
              user.id,
            ]);
          }
          // Fetch fresh data to ensure latest status
          const freshResult = await query('SELECT * FROM users WHERE id = $1', [user.id]);
          user = freshResult.rows[0];
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

export default passport;
