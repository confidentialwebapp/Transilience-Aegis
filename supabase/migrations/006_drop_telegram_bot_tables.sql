-- Remove the Telegram-bot ingestion tables.
--
-- The "Telegram Bot Monitor" feature was deprecated because Bot API accounts
-- can't self-join channels — the page was almost always empty. The bot itself
-- and its TELEGRAM_BOT_TOKEN are still used for OUTBOUND notifications
-- (customer_profiles.notify_telegram_chat_id pushes ransomware alerts) so
-- those settings remain.

DROP TABLE IF EXISTS telegram_messages;
DROP TABLE IF EXISTS telegram_channels;
DROP TABLE IF EXISTS telegram_poll_state;
