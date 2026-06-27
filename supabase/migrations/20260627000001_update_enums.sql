-- 1. Update the wallet type constraint
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_type_check;
ALTER TABLE wallets ADD CONSTRAINT wallets_type_check 
  CHECK (type IN ('cash', 'bank', 'credit', 'savings', 'investment', 'e_wallet'));

-- 2. Update the transaction payment method constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_payment_method_check 
  CHECK (payment_method IN ('cash', 'debit_card', 'credit_card', 'e_wallet', 'other', 'transfer', 'qr_code'));
