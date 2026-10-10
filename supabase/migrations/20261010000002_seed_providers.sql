-- The provider catalogue. `mock` is the practice bank every organization gets by default.
insert into providers (code, name, description, api_spec, features, status) values
  ('mock', 'Mock bank', 'Practice bank with test accounts. No real money moves.',
   '{"baseUrl": "internal", "version": "1", "documentation": ""}', array['payments'], 'active'),
  ('token', 'Token.io', 'Pay-by-bank across UK and EU banks.',
   '{"baseUrl": "https://api.token.io", "version": "v2", "documentation": "https://developer.token.io"}', array['payments', 'banks'], 'active'),
  ('yapily', 'Yapily', 'Open banking payments and data.',
   '{"baseUrl": "https://api.yapily.com", "version": "v1", "documentation": "https://docs.yapily.com"}', array['banks'], 'active'),
  ('truelayer', 'TrueLayer', 'Instant bank payments and payouts.',
   '{"baseUrl": "https://api.truelayer.com", "version": "v3", "documentation": "https://docs.truelayer.com"}', array[]::text[], 'inactive'),
  ('tink', 'Tink', 'Account aggregation and payments.',
   '{"baseUrl": "https://api.tink.com", "version": "v1", "documentation": "https://docs.tink.com"}', array[]::text[], 'inactive')
on conflict (code) do nothing;
