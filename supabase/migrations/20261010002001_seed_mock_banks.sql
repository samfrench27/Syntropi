-- The five practice banks (from the Express stubbed bank service), reachable only through the `mock`
-- provider, which every organization may use. provider_id keeps the old bank_00N ids.
-- Safe to re-run.
with seed(syntropi_id, name, country, logo_url, methods, provider_id) as (values
  ('gb-national-bank-of-test', 'National Bank of Test', 'GB', 'https://example.com/logos/national-bank.png', array['sepa','faster_payments','chaps'], 'bank_001'),
  ('de-european-test-bank',    'European Test Bank',    'DE', 'https://example.com/logos/european-bank.png',  array['sepa','instant_sepa'],             'bank_002'),
  ('se-nordic-bank-test',      'Nordic Bank Test',      'SE', 'https://example.com/logos/nordic-bank.png',    array['sepa','swish'],                    'bank_003'),
  ('us-american-test-bank',    'American Test Bank',    'US', 'https://example.com/logos/american-bank.png',  array['ach','wire'],                      'bank_004'),
  ('gb-financial-trust-test',  'Financial Trust Test',  'GB', 'https://example.com/logos/financial-trust.png', array['faster_payments','bacs'],         'bank_005')
), banks_in as (
  insert into banks (syntropi_id, name, country, logo_url, supported_payment_methods)
  select syntropi_id, name, country, logo_url, methods from seed
  on conflict (syntropi_id) do update set name = excluded.name, logo_url = excluded.logo_url,
    supported_payment_methods = excluded.supported_payment_methods
  returning id, syntropi_id
)
insert into bank_provider_mappings (bank_id, provider_code, provider_id, supported_payment_methods, active, metadata)
select b.id, 'mock', s.provider_id, s.methods, true,
       '{"supportedFeatures": {"accountList": true, "accountBalance": true, "transactionList": true, "singlePayment": true}}'::jsonb
  from seed s join banks_in b on b.syntropi_id = s.syntropi_id
on conflict (bank_id, provider_code) do update set provider_id = excluded.provider_id,
  supported_payment_methods = excluded.supported_payment_methods, active = true, metadata = excluded.metadata;
