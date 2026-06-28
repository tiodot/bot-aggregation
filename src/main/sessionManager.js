const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

class SessionManager {
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'sessions.db');
    this.db = new Database(dbPath);
    this._initDb();
  }

  _initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_bots (
        session_id TEXT NOT NULL,
        bot_name TEXT NOT NULL,
        session_url TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, bot_name),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
    `);
  }

  /**
   * Create a new session with a title.
   */
  createSession(title = '新对话') {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(id, title, now, now);
    return { id, title, createdAt: now, updatedAt: now };
  }

  /**
   * Link a bot's session URL to our session.
   */
  linkBotSession(sessionId, botName, sessionUrl) {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO session_bots (session_id, bot_name, session_url, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
      ON CONFLICT(session_id, bot_name) DO UPDATE SET
        session_url = excluded.session_url,
        status = 'active',
        updated_at = excluded.updated_at
    `).run(sessionId, botName, sessionUrl, now, now);
  }

  /**
   * Get all sessions (for history list).
   */
  getSessions(limit = 50) {
    return this.db.prepare(
      'SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?'
    ).all(limit);
  }

  /**
   * Get a session with its bot links.
   */
  getSession(sessionId) {
    const session = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) return null;

    const bots = this.db.prepare(
      'SELECT * FROM session_bots WHERE session_id = ?'
    ).all(sessionId);

    return { ...session, bots };
  }

  /**
   * Get the latest session (for auto-continue).
   */
  getLatestSession() {
    const session = this.db.prepare(
      'SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 1'
    ).get();
    if (!session) return null;
    return this.getSession(session.id);
  }

  /**
   * Update session title.
   */
  updateSessionTitle(sessionId, title) {
    this.db.prepare(
      'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?'
    ).run(title, Date.now(), sessionId);
  }

  /**
   * Update session timestamp (on new activity).
   */
  touchSession(sessionId) {
    this.db.prepare(
      'UPDATE sessions SET updated_at = ? WHERE id = ?'
    ).run(Date.now(), sessionId);
  }

  /**
   * Delete a session and its bot links.
   */
  deleteSession(sessionId) {
    this.db.prepare('DELETE FROM session_bots WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  /**
   * Mark a bot session as error/unavailable.
   */
  markBotSessionError(sessionId, botName) {
    this.db.prepare(
      'UPDATE session_bots SET status = ?, updated_at = ? WHERE session_id = ? AND bot_name = ?'
    ).run('error', Date.now(), sessionId, botName);
  }

  close() {
    this.db.close();
  }
}

module.exports = SessionManager;
